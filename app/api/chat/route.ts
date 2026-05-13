import { NextResponse, type NextRequest } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { anthropic, MODEL } from "@/lib/anthropic";
import { NOI_SYSTEM_PROMPT } from "@/lib/system-prompt";
import { detectLanguage, otherLanguage, type Language } from "@/lib/language-detect";
import { translate } from "@/lib/translate";
import { extractChecklist } from "@/lib/checklist-extract";
import { generateThreadTitles } from "@/lib/thread-title";
import { createServerClient, createServiceRoleClient } from "@/lib/supabase/server";

/** MIME types Anthropic vision accepts. Matches our storage bucket allow-list. */
const VISION_MIMES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type VisionMime = (typeof VISION_MIMES)[number];

interface AttachmentInput {
  path: string;
  mime: string;
  name?: string;
  width?: number;
  height?: number;
}

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
  /**
   * Optional attached images (already uploaded to Supabase Storage by the
   * client). The server fetches each via the service role, base64-encodes
   * it, and includes it as an image content block on the latest user turn
   * when calling Claude.
   *
   * History images from previous turns are NOT re-sent to Claude — only
   * the images attached to THIS turn. Keeps token cost predictable.
   */
  attachments?: AttachmentInput[];
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

  // --- 2. Validate attachments + save the user message ------------------
  // Only keep attachments whose paths live inside the caller's family
  // folder. Storage RLS already enforces this, but it's a useful belt-
  // and-braces check that also normalises the data we persist.
  const rawAttachments: AttachmentInput[] = Array.isArray(body.attachments)
    ? body.attachments
    : [];
  const attachments = rawAttachments.filter(
    (a): a is AttachmentInput =>
      typeof a?.path === "string" &&
      typeof a?.mime === "string" &&
      a.path.startsWith(`${profile.family_space_id}/`) &&
      (VISION_MIMES as readonly string[]).includes(a.mime),
  );

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
    attachments,
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

  const textOnlyHistory: Array<{ role: "user" | "assistant"; content: string }> = (history ?? [])
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
  const collapsed: typeof textOnlyHistory = [];
  for (const msg of textOnlyHistory) {
    const prev = collapsed[collapsed.length - 1];
    if (prev && prev.role === "user" && msg.role === "user") {
      prev.content = `${prev.content}\n\n${msg.content}`;
    } else {
      collapsed.push(msg);
    }
  }

  // --- 3b. Convert to Anthropic message params, attaching images to the
  // latest user turn if the caller uploaded any. We don't re-send history
  // images — only the ones uploaded with THIS request.
  const claudeMessages: Anthropic.MessageParam[] = collapsed.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  if (attachments.length > 0 && claudeMessages.length > 0) {
    const imageBlocks = await fetchImageBlocks(attachments);
    if (imageBlocks.length > 0) {
      const lastIdx = claudeMessages.length - 1;
      const last = claudeMessages[lastIdx];
      // Only attach to a user turn (server-only contract; we just built
      // collapsed so the last user message is the current question).
      if (last.role === "user" && typeof last.content === "string") {
        claudeMessages[lastIdx] = {
          role: "user",
          content: [
            ...imageBlocks,
            { type: "text", text: last.content || describeImagesPrompt(inputLang) },
          ],
        };
      }
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
          messages: claudeMessages,
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

/**
 * Fetch each attachment from Supabase Storage and turn it into an
 * Anthropic image content block. Service-role client bypasses RLS
 * because we already verified the path lives in the caller's family
 * folder (see `attachments` filtering in the POST handler).
 *
 * Bad / missing files are skipped silently — we still want to answer
 * the user's text question even if one image failed to load.
 */
async function fetchImageBlocks(
  attachments: AttachmentInput[],
): Promise<Anthropic.ImageBlockParam[]> {
  const admin = createServiceRoleClient();
  const blocks: Anthropic.ImageBlockParam[] = [];

  for (const att of attachments) {
    try {
      const { data, error } = await admin.storage
        .from("attachments")
        .download(att.path);
      if (error || !data) {
        console.warn("[api/chat] could not fetch attachment", att.path, error?.message);
        continue;
      }
      const buf = Buffer.from(await data.arrayBuffer());
      blocks.push({
        type: "image",
        source: {
          type: "base64",
          media_type: att.mime as VisionMime,
          data: buf.toString("base64"),
        },
      });
    } catch (err) {
      console.warn("[api/chat] attachment fetch threw", att.path, err);
    }
  }

  return blocks;
}

/**
 * Default text for image-only turns (the user attached photos but typed
 * nothing). Phrased so Claude knows it's expected to interpret the image.
 */
function describeImagesPrompt(lang: Language): string {
  return lang === "vi"
    ? "Quý vị có thể giải thích giúp tôi nội dung trong hình ảnh này không?"
    : "Could you explain what's in this image for me?";
}
