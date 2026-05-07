"use server";

import { anthropic, MODEL } from "@/lib/anthropic";
import { NOI_SYSTEM_PROMPT } from "@/lib/system-prompt";
import { translate } from "@/lib/translate";
import { extractChecklist, type ChecklistItem } from "@/lib/checklist-extract";
import { generateThreadTitles } from "@/lib/thread-title";
import { createServerClient } from "@/lib/supabase/server";

export interface TaskPreview {
  taskVi: string;
  taskEn: string;
  responseVi: string;
  responseEn: string;
  checklist: ChecklistItem[];
}

/**
 * Step 1 of the new-task flow. The child has typed an English task
 * like "renew Mum's Medicare card". We produce:
 *   - a Vietnamese version of the task (so the parent sees it in their
 *     language)
 *   - Claude's Vietnamese step-by-step instructions for the parent
 *   - an English version of those instructions (so the child can
 *     review before sending)
 *   - any checklist items extracted from the steps
 *
 * Nothing is saved yet — the child gets to review and either submit or
 * edit before anything lands in the database.
 */
export async function generateTaskPreview(
  englishTask: string,
): Promise<{ ok: true; preview: TaskPreview } | { ok: false; error: string }> {
  const task = englishTask.trim();
  if (!task) return { ok: false, error: "Task is empty" };

  try {
    // Rewrite the task as a question the parent might ask Noi, in
    // Vietnamese — this gives Claude clean input for generating steps.
    const taskVi = await translate(task, "en", "vi");

    // Ask Claude for Vietnamese step-by-step guidance as if the parent
    // had asked this question directly.
    const completion = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: NOI_SYSTEM_PROMPT,
      messages: [{ role: "user", content: taskVi }],
    });
    const block = completion.content[0];
    if (block?.type !== "text") {
      return { ok: false, error: "Unexpected response from AI" };
    }
    const responseVi = block.text;

    const [responseEn, checklist] = await Promise.all([
      translate(responseVi, "vi", "en"),
      extractChecklist(responseVi),
    ]);

    return {
      ok: true,
      preview: { taskVi, taskEn: task, responseVi, responseEn, checklist },
    };
  } catch (err) {
    console.error("[new-task preview]", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not generate preview",
    };
  }
}

/**
 * Step 2 of the new-task flow. After the child reviews the preview,
 * they hit Send and we persist:
 *   - a new thread (initiated_by_role='child')
 *   - a copilot_task message with both languages of the task
 *   - an assistant response message with the steps
 *   - checklist rows
 *   - a generated thread title (so the parent home shows a nice title
 *     right away, not "Processing…")
 */
export async function submitTask(
  preview: TaskPreview,
): Promise<{ ok: true; threadId: string } | { ok: false; error: string }> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("family_space_id, role")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.family_space_id) {
    return { ok: false, error: "Profile not ready" };
  }

  // Titles in both languages up front so the parent's home screen
  // renders a meaningful label immediately.
  const titles = await generateThreadTitles(preview.taskEn, preview.responseEn);

  const { data: thread, error: threadError } = await supabase
    .from("threads")
    .insert({
      family_space_id: profile.family_space_id,
      created_by: user.id,
      initiated_by_role: profile.role,
      status: "open",
      title_vi: titles.title_vi,
      title_en: titles.title_en,
    })
    .select("id")
    .single();

  if (threadError || !thread) {
    return { ok: false, error: threadError?.message ?? "Could not create thread" };
  }

  // The task from the child (message_type='copilot_task').
  await supabase.from("messages").insert({
    thread_id: thread.id,
    sender_id: user.id,
    sender_role: "child",
    content_vi: preview.taskVi,
    content_en: preview.taskEn,
    input_language: "en",
    message_type: "copilot_task",
  });

  // Noi's response with the steps.
  const { data: assistantMsg } = await supabase
    .from("messages")
    .insert({
      thread_id: thread.id,
      sender_id: null,
      sender_role: "assistant",
      content_vi: preview.responseVi,
      content_en: preview.responseEn,
      input_language: null,
      message_type: "response",
    })
    .select("id")
    .single();

  if (preview.checklist.length > 0 && assistantMsg) {
    await supabase.from("checklist_items").insert(
      preview.checklist.map((item, idx) => ({
        thread_id: thread.id,
        message_id: assistantMsg.id,
        text_vi: item.text_vi,
        text_en: item.text_en,
        sort_order: idx,
      })),
    );
  }

  return { ok: true, threadId: thread.id };
}
