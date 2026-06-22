"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { buildDualLanguage } from "@/lib/diary-translate";
import { extractDiaryEntry, type ExtractedDiaryEntry } from "@/lib/diary-extract";
import { detectLanguage } from "@/lib/language-detect";
import type { Attachment } from "@/lib/storage";

/**
 * Server actions for FAM-1 diary entries.
 *
 * Schema captures three "kinds" — event, decision, note — in one
 * table with a discriminator column. The compose UI emphasises
 * different fields per kind but the storage is unified.
 *
 * Translation is automatic on write: the user types in their
 * preferred language; we run title / body / context through Claude
 * in parallel to populate the other-language columns. The user can
 * tweak either side via inline edit in the detail view later.
 */

export type DiaryKind = "event" | "decision" | "note";

export interface CreateDiaryInput {
  kind: DiaryKind;
  title: string;
  body: string | null;
  context: string | null;
  event_date: string | null;
  tags: string[];
  attachments: Attachment[];
  related_thread_id: string | null;
}

export async function createDiaryEntry(
  input: CreateDiaryInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const title = input.title.trim();
  if (!title) return { ok: false, error: "Title is required" };

  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("family_space_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.family_space_id) return { ok: false, error: "Profile not ready" };

  // Dual-language fan-out for the three text fields.
  let dual;
  try {
    dual = await buildDualLanguage({
      title,
      body: input.body?.trim() || null,
      context: input.context?.trim() || null,
    });
  } catch (err) {
    console.error("[diary.create translate]", err);
    return { ok: false, error: "Translation failed — please try again" };
  }

  // Normalise tags — same rules as the threads tag system.
  const cleanedTags = Array.from(
    new Set(
      (input.tags ?? [])
        .map((t) => (typeof t === "string" ? t.trim().toLowerCase() : ""))
        .filter((t) => t.length > 0 && t.length <= 30),
    ),
  ).slice(0, 20);

  const { data, error } = await supabase
    .from("diary_entries")
    .insert({
      family_space_id: profile.family_space_id,
      created_by: user.id,
      kind: input.kind,
      ...dual,
      event_date: input.event_date,
      tags: cleanedTags,
      attachments: input.attachments ?? [],
      related_thread_id: input.related_thread_id,
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? "Could not save" };

  revalidatePath("/diary");
  return { ok: true, id: data.id };
}

/**
 * Update an existing diary entry. We re-translate fields whose
 * input-language version changed, leaving the manually-edited
 * other-language version alone unless the user explicitly resets it.
 *
 * For simplicity in phase 1: caller provides the full text fields in
 * one language at edit time and we re-translate them. To preserve a
 * manual translation, the caller passes `skipRetranslate: true`.
 */
export interface UpdateDiaryInput {
  id: string;
  kind?: DiaryKind;
  title?: string;
  body?: string | null;
  context?: string | null;
  event_date?: string | null;
  tags?: string[];
  attachments?: Attachment[];
  related_thread_id?: string | null;
  skipRetranslate?: boolean;
}

export async function updateDiaryEntry(
  input: UpdateDiaryInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!input.id) return { ok: false, error: "Missing id" };

  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  const updates: Record<string, unknown> = {};
  if (input.kind) updates.kind = input.kind;
  if (input.event_date !== undefined) updates.event_date = input.event_date;
  if (input.tags) {
    updates.tags = Array.from(
      new Set(
        input.tags
          .map((t) => (typeof t === "string" ? t.trim().toLowerCase() : ""))
          .filter((t) => t.length > 0 && t.length <= 30),
      ),
    ).slice(0, 20);
  }
  if (input.attachments !== undefined) updates.attachments = input.attachments;
  if (input.related_thread_id !== undefined) {
    updates.related_thread_id = input.related_thread_id;
  }

  const wantsTextUpdate =
    input.title !== undefined ||
    input.body !== undefined ||
    input.context !== undefined;

  if (wantsTextUpdate) {
    if (input.skipRetranslate) {
      // No retranslate — set the values directly on whichever side
      // they came in. Not used in phase 1 but kept as an escape hatch.
      if (input.title !== undefined) updates.title_vi = input.title;
      if (input.title !== undefined) updates.title_en = input.title;
      if (input.body !== undefined) updates.body_vi = input.body;
      if (input.body !== undefined) updates.body_en = input.body;
      if (input.context !== undefined) updates.context_vi = input.context;
      if (input.context !== undefined) updates.context_en = input.context;
    } else {
      try {
        const dual = await buildDualLanguage({
          title: input.title ?? "",
          body: input.body ?? null,
          context: input.context ?? null,
        });
        if (input.title !== undefined) {
          updates.title_vi = dual.title_vi;
          updates.title_en = dual.title_en;
        }
        if (input.body !== undefined) {
          updates.body_vi = dual.body_vi;
          updates.body_en = dual.body_en;
        }
        if (input.context !== undefined) {
          updates.context_vi = dual.context_vi;
          updates.context_en = dual.context_en;
        }
      } catch (err) {
        console.error("[diary.update translate]", err);
        return { ok: false, error: "Translation failed — please try again" };
      }
    }
  }

  const { error } = await supabase
    .from("diary_entries")
    .update(updates)
    .eq("id", input.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/diary");
  revalidatePath(`/diary/${input.id}`);
  return { ok: true };
}

/**
 * Voice-intelligent extraction. Called by DiaryComposer when the user
 * uses the mic on the new-entry page. Instead of dumping the transcript
 * into the body textarea, we run it through Claude to extract structured
 * fields (kind, title, body, context, event_date, tags). The composer
 * populates the form with the extracted values for the user to review.
 *
 * Failure mode is graceful: returns null on any extraction error and
 * the composer falls back to dumping the raw transcript into the body
 * field — same behaviour as before this feature existed.
 */
export async function extractDiaryFromVoice(
  transcript: string,
): Promise<{ ok: true; extracted: ExtractedDiaryEntry } | { ok: false; error: string }> {
  const text = transcript.trim();
  if (!text) return { ok: false, error: "Transcript is empty" };

  // Auth check so unauthenticated callers can't burn our Anthropic quota.
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  const inputLang = detectLanguage(text);
  try {
    const extracted = await extractDiaryEntry(
      text,
      inputLang,
      new Date().toISOString(),
    );
    if (!extracted) return { ok: false, error: "Could not understand that" };
    return { ok: true, extracted };
  } catch (err) {
    console.error("[diary.extract]", err);
    return { ok: false, error: "Could not understand that" };
  }
}

export async function softDeleteDiaryEntry(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!id) return { ok: false, error: "Missing id" };
  const supabase = createServerClient();
  const { error } = await supabase
    .from("diary_entries")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/diary");
  revalidatePath("/trash");
  return { ok: true };
}

export async function restoreDiaryEntry(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!id) return { ok: false, error: "Missing id" };
  const supabase = createServerClient();
  const { error } = await supabase
    .from("diary_entries")
    .update({ deleted_at: null })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/diary");
  revalidatePath("/trash");
  return { ok: true };
}

/**
 * Server-action wrapper used directly by `<form action={...}>` in the
 * composer page. Reads from FormData, calls createDiaryEntry, redirects
 * to the new entry's detail page on success.
 */
export async function submitNewDiaryEntry(formData: FormData): Promise<void> {
  const kindRaw = String(formData.get("kind") ?? "note");
  const kind: DiaryKind =
    kindRaw === "event" || kindRaw === "decision" ? kindRaw : "note";

  const tagsRaw = String(formData.get("tags") ?? "");
  const attachmentsRaw = String(formData.get("attachments") ?? "[]");

  let tags: string[] = [];
  try {
    const parsed = JSON.parse(tagsRaw);
    if (Array.isArray(parsed)) tags = parsed.filter((t) => typeof t === "string");
  } catch {
    tags = [];
  }

  let attachments: Attachment[] = [];
  try {
    const parsed = JSON.parse(attachmentsRaw);
    if (Array.isArray(parsed)) attachments = parsed as Attachment[];
  } catch {
    attachments = [];
  }

  const result = await createDiaryEntry({
    kind,
    title: String(formData.get("title") ?? ""),
    body: String(formData.get("body") ?? "") || null,
    context: String(formData.get("context") ?? "") || null,
    event_date: String(formData.get("event_date") ?? "") || null,
    tags,
    attachments,
    related_thread_id: String(formData.get("related_thread_id") ?? "") || null,
  });

  if (!result.ok) {
    // For form actions we don't have a great error channel — redirect
    // back to the new-entry page with the error in the URL.
    redirect(`/diary/new?error=${encodeURIComponent(result.error)}`);
  }
  redirect(`/diary/${result.id}`);
}
