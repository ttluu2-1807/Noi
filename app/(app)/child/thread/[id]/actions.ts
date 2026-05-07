"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { translate } from "@/lib/translate";
import { detectLanguage, otherLanguage } from "@/lib/language-detect";

/**
 * Post a direct reply from the child to the parent in a thread.
 * The child writes in English; we translate to Vietnamese and save
 * both versions as a single message row with sender_role='child'.
 * The parent sees the Vietnamese version, the child sees English.
 */
export async function replyToThread(formData: FormData) {
  const threadId = String(formData.get("threadId") ?? "");
  const raw = String(formData.get("message") ?? "").trim();
  if (!threadId || !raw) return { ok: false as const, error: "Missing fields" };

  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Unauthorized" };

  // Verify the thread is in the user's family space (RLS would refuse
  // otherwise, but explicit check gives us a clear error path).
  const { data: thread } = await supabase
    .from("threads")
    .select("id")
    .eq("id", threadId)
    .maybeSingle();
  if (!thread) return { ok: false as const, error: "Thread not found" };

  const inputLang = detectLanguage(raw);
  const otherLang = otherLanguage(inputLang);
  const other = await translate(raw, inputLang, otherLang);

  const { error } = await supabase.from("messages").insert({
    thread_id: threadId,
    sender_id: user.id,
    sender_role: "child",
    content_vi: inputLang === "vi" ? raw : other,
    content_en: inputLang === "en" ? raw : other,
    input_language: inputLang,
    message_type: "query",
  });

  if (error) return { ok: false as const, error: error.message };

  revalidatePath(`/child/thread/${threadId}`);
  revalidatePath(`/parent/thread/${threadId}`);
  return { ok: true as const };
}

/**
 * Change the category tag on a thread. Child-only action — the parent
 * doesn't need this affordance. Categories are free-form strings; we
 * keep the short shortlist from the schema comment as suggestions in
 * the UI but don't enforce it at the DB level.
 *
 * Returns void so this can be bound directly to `<form action={...}>`
 * as well as called from `startTransition`.
 */
export async function setThreadCategory(formData: FormData): Promise<void> {
  const threadId = String(formData.get("threadId") ?? "");
  const category = String(formData.get("category") ?? "").trim() || null;
  if (!threadId) return;

  const supabase = createServerClient();
  await supabase
    .from("threads")
    .update({ category_tag: category })
    .eq("id", threadId);

  revalidatePath(`/child/thread/${threadId}`);
}

/**
 * Toggle a thread between 'open' and 'resolved'. Either role can do
 * this in principle, but the UI surfaces it only on the child side.
 */
export async function setThreadStatus(formData: FormData): Promise<void> {
  const threadId = String(formData.get("threadId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!threadId || !["open", "resolved"].includes(status)) return;

  const supabase = createServerClient();
  await supabase
    .from("threads")
    .update({ status })
    .eq("id", threadId);

  revalidatePath(`/child/thread/${threadId}`);
}
