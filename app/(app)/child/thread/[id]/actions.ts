"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { translate } from "@/lib/translate";
import { detectLanguage, otherLanguage } from "@/lib/language-detect";

interface AttachmentMeta {
  path: string;
  mime: string;
  name?: string;
  width?: number;
  height?: number;
}

/**
 * Post a direct reply from the child to the parent in a thread.
 * The child writes in English; we translate to Vietnamese and save
 * both versions as a single message row with sender_role='child'.
 * The parent sees the Vietnamese version, the child sees English.
 *
 * Optionally attaches images (parsed from the hidden `attachments`
 * form field, which the client posts as a JSON string). Images go
 * straight to the message row — they are not sent to Claude here
 * because a child→parent reply is a direct family message, not an
 * AI request.
 */
export async function replyToThread(formData: FormData) {
  const threadId = String(formData.get("threadId") ?? "");
  const raw = String(formData.get("message") ?? "").trim();
  const attachmentsJson = String(formData.get("attachments") ?? "[]");

  // Either text or at least one attachment is required.
  let attachments: AttachmentMeta[] = [];
  try {
    const parsed = JSON.parse(attachmentsJson);
    if (Array.isArray(parsed)) {
      attachments = parsed.filter(
        (a): a is AttachmentMeta =>
          typeof a?.path === "string" && typeof a?.mime === "string",
      );
    }
  } catch {
    // Malformed JSON — ignore, treat as no attachments.
  }

  if (!threadId || (!raw && attachments.length === 0)) {
    return { ok: false as const, error: "Missing fields" };
  }

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

  // Filter attachments to ones in the user's family folder.
  const { data: profile } = await supabase
    .from("profiles")
    .select("family_space_id")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.family_space_id) {
    attachments = attachments.filter((a) =>
      a.path.startsWith(`${profile.family_space_id}/`),
    );
  }

  // Translation: only needed if the user wrote text. An image-only
  // reply has empty content_vi / content_en.
  let contentVi = "";
  let contentEn = "";
  let inputLang: "vi" | "en" | null = null;
  if (raw) {
    inputLang = detectLanguage(raw);
    const otherLang = otherLanguage(inputLang);
    const other = await translate(raw, inputLang, otherLang);
    contentVi = inputLang === "vi" ? raw : other;
    contentEn = inputLang === "en" ? raw : other;
  }

  const { error } = await supabase.from("messages").insert({
    thread_id: threadId,
    sender_id: user.id,
    sender_role: "child",
    content_vi: contentVi,
    content_en: contentEn,
    input_language: inputLang,
    message_type: "query",
    attachments,
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
