import { NextResponse, type NextRequest } from "next/server";
import { anthropic, MODEL } from "@/lib/anthropic";
import { NOI_SYSTEM_PROMPT } from "@/lib/system-prompt";
import { detectLanguage, otherLanguage, type Language } from "@/lib/language-detect";
import { translate } from "@/lib/translate";
import { extractChecklist } from "@/lib/checklist-extract";
import { generateThreadTitles } from "@/lib/thread-title";
import { createServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
// Give the full pipeline (stream + 2× translate + extract + title) room to run.
export const maxDuration = 60;

interface ChatRequest {
  threadId: string | null;
  message: string;
  /** Override of detected language. Optional — falls back to detection. */
  language?: Language;
  /**
   * How to treat this message.
   *  - "query"           : normal user question (parent asks, or child asks)
   *  - "copilot_comment" : the child is adding context to a prior question.
   *                        The message is saved as a comment and, when sent
   *                        to Claude, is wrapped as "[Context from family
   *                        member: ...]" so Claude updates its prior advice
   *                        rather than treating it as a fresh question.
   */
  messageType?: "query" | "copilot_comment";
}

/**
 * Streaming AI endpoint. Pipeline per request:
 *   1. Save the user's message (both languages)
 *   2. Create the thread if needed
 *   3. Stream Claude's response to the client in real-time
 *   4. Once streaming completes (still inside the same HTTP response,
 *      before the stream closes): translate, extract checklist, save
 *      assistant message, generate thread title if new
 *
 * The client sees the response render live. The extra post-processing
 * happens before the stream closes, so by the time the client's
 * fetch resolves, all DB rows are populated and a simple refetch or
 * realtime event surfaces them.
 *
 * The response body is plain UTF-8 text (not SSE). The new or existing
 * thread ID is returned via the X-Thread-Id header so the client can
 * navigate or refetch.
 */
export async function POST(request: NextRequest) {
  const supabase = createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: ChatRequest;
  try {
    body = (await request.json()) as ChatRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const message = String(body.message ?? "").trim();
  if (!message) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  // Load profile (for role + family_space_id).
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, family_space_id, language_preference")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.family_space_id) {
    return NextResponse.json({ error: "Profile not ready" }, { status: 400 });
  }

  // Resolve input language. Prefer explicit override; else detect.
  const inputLang: Language = body.language ?? detectLanguage(message);
  const otherLang = otherLanguage(inputLang);

  // --- 1. Resolve thread -----------------------------------------------
  let threadId: string = body.threadId ?? "";
  let threadIsNew = false;
  if (threadId === "") {
    const { data: thread, error: threadError } = await supabase
      .from("threads")
      .insert({
        family_space_id: profile.family_space_id,
        created_by: user.id,
        initiated_by_role: profile.role,
        status: "open",
      })
      .select("id")
      .single();
    if (threadError || !thread) {
      return NextResponse.json(
        { error: threadError?.message ?? "Could not create thread" },
        { status: 500 },
      );
    }
    threadId = thread.id;
    threadIsNew = true;
  } else {
    // Confirm the thread belongs to this family space.
    const { data: existing } = await supabase
      .from("threads")
      .select("id, title_vi, title_en")
      .eq("id", threadId)
      .maybeSingle();
    if (!existing) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }
    threadIsNew = !existing.title_vi || !existing.title_en;
  }

  // --- 2. Translate + save the user message ----------------------------
  const userOther = await translate(message, inputLang, otherLang);
  const messageType = body.messageType === "copilot_comment" ? "copilot_comment" : "query";

  await supabase.from("messages").insert({
    thread_id: threadId,
    sender_id: user.id,
    sender_role: profile.role,
    content_vi: inputLang === "vi" ? message : userOther,
    content_en: inputLang === "en" ? message : userOther,
    input_language: inputLang,
    message_type: messageType,
  });

  // --- 3. Build Claude's message history -------------------------------
  // We feed Claude the thread in the input language so it stays in that
  // language naturally. Child-added context is appended inline on the
  // latest user message rather than shown as a separate turn — matches
  // the "[Context from family member: …]" convention in the system prompt.
  const { data: history } = await supabase
    .from("messages")
    .select("sender_role, content_vi, content_en, message_type")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });

  const claudeMessages: Array<{ role: "user" | "assistant"; content: string }> = (history ?? [])
    .map((m) => {
      const role = m.sender_role === "assistant" ? ("assistant" as const) : ("user" as const);
      const raw = (inputLang === "vi" ? m.content_vi : m.content_en) ?? "";
      // Wrap copilot comments in the bracketed marker so Claude reads them
      // as background context rather than a new question, per the system
      // prompt's convention.
      const content =
        m.message_type === "copilot_comment" && role === "user"
          ? `[Context from family member: ${raw}]`
          : raw;
      return { role, content };
    })
    .filter((m) => m.content.length > 0);

  // Collapse consecutive user messages into one turn — the Anthropic API
  // requires strict user/assistant alternation. A copilot comment right
  // after a parent's query should be attached to that query, not sent
  // as a second consecutive user message.
  const collapsed: typeof claudeMessages = [];
  for (const msg of claudeMessages) {
    const prev = collapsed[collapsed.length - 1];
    if (prev && prev.role === "user" && msg.role === "user") {
      prev.content = `${prev.content}\n\n${msg.content}`;
    } else {
      collapsed.push(msg);
    }
  }

  // --- 4. Stream Claude's response -------------------------------------
  const encoder = new TextEncoder();

  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      let full = "";
      try {
        const stream = anthropic.messages.stream({
          model: MODEL,
          system: NOI_SYSTEM_PROMPT,
          max_tokens: 1500,
          messages: collapsed,
        });

        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            const chunk = event.delta.text;
            full += chunk;
            controller.enqueue(encoder.encode(chunk));
          }
        }
      } catch (err) {
        controller.enqueue(
          encoder.encode(
            `\n\n${inputLang === "vi"
              ? "Xin lỗi, có lỗi xảy ra. Vui lòng thử lại."
              : "Something went wrong. Please try again."}`,
          ),
        );
        controller.close();
        // Nothing to save if we didn't get a response.
        console.error("[api/chat] stream error:", err);
        return;
      }

      // --- 5. Post-processing: translate, save, extract, title -----------
      // Runs while the HTTP stream is still open so client's fetch resolves
      // only after all DB writes complete.
      try {
        const [responseOther, checklistItems] = await Promise.all([
          translate(full, inputLang, otherLang),
          extractChecklist(full),
        ]);

        const { data: assistantMessage } = await supabase
          .from("messages")
          .insert({
            thread_id: threadId,
            sender_id: null,
            sender_role: "assistant",
            content_vi: inputLang === "vi" ? full : responseOther,
            content_en: inputLang === "en" ? full : responseOther,
            input_language: null,
            message_type: "response",
          })
          .select("id")
          .single();

        if (checklistItems.length > 0 && assistantMessage) {
          await supabase.from("checklist_items").insert(
            checklistItems.map((item, idx) => ({
              thread_id: threadId,
              message_id: assistantMessage.id,
              text_vi: item.text_vi,
              text_en: item.text_en,
              sort_order: idx,
            })),
          );
        }

        if (threadIsNew) {
          const titles = await generateThreadTitles(message, full);
          await supabase
            .from("threads")
            .update({
              title_vi: titles.title_vi,
              title_en: titles.title_en,
            })
            .eq("id", threadId);
        }
      } catch (err) {
        console.error("[api/chat] post-processing error:", err);
        // We don't surface this to the user — the streamed response is
        // already visible. Worst case: the message/checklist/title are
        // missing, which the UI handles gracefully.
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Thread-Id": threadId,
    },
  });
}
