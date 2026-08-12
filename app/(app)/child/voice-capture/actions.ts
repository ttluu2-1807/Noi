"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { detectLanguage } from "@/lib/language-detect";
import { classifyVoiceIntent, type VoiceIntent } from "@/lib/voice-router";
import { createDiaryEntry } from "@/app/(app)/diary/actions";

/**
 * Result returned to the voice FAB client: a redirect target and a
 * one-line summary the toast can show ("Added: …", "Logged: …").
 * On null/error, the client falls back to sending the user to a
 * generic compose surface.
 *
 * `itemId` is set for todo/diary (the row that was persisted) so the
 * destination page can offer a "Wrong home — move to X" affordance
 * that deletes this row and re-routes to another surface.
 * `originalText` is the raw transcript; useful when moving so we can
 * hand it to /child/new-task or /diary/new as a prefill.
 */
export type VoiceCaptureResult =
  | {
      ok: true;
      intent: VoiceIntent["kind"];
      summary: string;
      redirect: string;
      itemId: string | null;
      originalText: string;
    }
  | { ok: false; error: string };

/**
 * Take a free-form transcript from the global voice FAB, decide what
 * the user meant (todo / diary / thread), persist it appropriately,
 * and return a redirect path so the client can land the user on the
 * right surface to confirm or keep editing.
 *
 * Redirect URLs carry `?captured=<kind>&id=<uuid>&text=<encoded>` so
 * the destination page can render CapturedToast — the "Added to X.
 * Wrong? Move to Y | Z." affordance that recovers a misclassified
 * capture in one tap.
 */
export async function captureVoiceIntent(
  transcript: string,
): Promise<VoiceCaptureResult> {
  const trimmed = transcript.trim();
  if (!trimmed) return { ok: false, error: "Nothing was captured." };

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
  if (!profile?.family_space_id) {
    return { ok: false, error: "Profile not ready" };
  }

  const inputLang = detectLanguage(trimmed);
  let intent: VoiceIntent | null;
  try {
    intent = await classifyVoiceIntent(trimmed, inputLang, new Date().toISOString());
  } catch (err) {
    console.error("[voice-capture classify]", err);
    return { ok: false, error: "Couldn't understand that — please try again." };
  }
  if (!intent) {
    return { ok: false, error: "Couldn't understand that — please try again." };
  }

  if (intent.kind === "todo") {
    const { data, error } = await supabase
      .from("family_todos")
      .insert({
        family_space_id: profile.family_space_id,
        created_by: user.id,
        text_vi: intent.text_vi,
        text_en: intent.text_en,
        due_at: intent.due_at,
        assignee_role: intent.assignee_role,
      })
      .select("id")
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? "Insert failed" };
    revalidatePath("/todos");
    revalidatePath("/child");
    return {
      ok: true,
      intent: "todo",
      summary: intent.text_en || intent.text_vi,
      itemId: data.id as string,
      originalText: trimmed,
      redirect: buildCapturedRedirect("/todos", "todo", data.id as string, trimmed),
    };
  }

  if (intent.kind === "diary") {
    const result = await createDiaryEntry({
      kind: intent.diary_kind,
      title: intent.title,
      body: intent.body,
      context: intent.context,
      event_date: intent.event_date,
      tags: intent.tags,
      attachments: [],
      related_thread_id: null,
    });
    if (!result.ok) return { ok: false, error: result.error };
    revalidatePath("/diary");
    revalidatePath("/child");
    return {
      ok: true,
      intent: "diary",
      summary: intent.title,
      itemId: result.id,
      originalText: trimmed,
      redirect: buildCapturedRedirect(
        `/diary/${result.id}`,
        "diary",
        result.id,
        trimmed,
      ),
    };
  }

  // intent.kind === "thread" — nothing to persist yet; the thread is
  // created via /child/new-task's multi-step flow. No move-to affordance
  // needed on that destination (the user is already reviewing the text).
  return {
    ok: true,
    intent: "thread",
    summary: intent.text,
    itemId: null,
    originalText: trimmed,
    redirect: `/child/new-task?prefill=${encodeURIComponent(intent.text)}`,
  };
}

function buildCapturedRedirect(
  basePath: string,
  kind: "todo" | "diary",
  id: string,
  text: string,
): string {
  const sep = basePath.includes("?") ? "&" : "?";
  const params = new URLSearchParams({
    captured: kind,
    id,
    text,
  });
  return `${basePath}${sep}${params.toString()}`;
}

/**
 * "Wrong home" recovery. Delete the source row (todo or diary) and
 * return the path to redirect to for the new home. For threads there's
 * nothing to delete on the source side (threads aren't auto-created by
 * capture); the caller just navigates to /child/new-task with prefill.
 *
 * We soft-delete via deleted_at so the item is recoverable from /trash
 * for 30 days — mirrors how normal deletes behave everywhere else.
 */
export async function moveCaptured(input: {
  from: "todo" | "diary";
  id: string;
  to: "todo" | "diary" | "thread";
  text: string;
}): Promise<{ ok: true; redirect: string } | { ok: false; error: string }> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  const nowIso = new Date().toISOString();

  // Soft-delete the source. RLS scopes to family; a stray id from
  // another family would silently no-op which is fine.
  if (input.from === "todo") {
    await supabase
      .from("family_todos")
      .update({ deleted_at: nowIso })
      .eq("id", input.id);
    revalidatePath("/todos");
  } else {
    await supabase
      .from("diary_entries")
      .update({ deleted_at: nowIso })
      .eq("id", input.id);
    revalidatePath("/diary");
  }
  revalidatePath("/child");
  revalidatePath("/parent");

  // Build the destination for the new home. For todo/diary we reuse
  // the standard "add via voice" pipeline by re-running captureVoiceIntent
  // with a soft nudge — but simpler: just prefill the composer on the
  // target page and let the user finalise. Fewer moving parts, still
  // one-tap recoverable.
  if (input.to === "thread") {
    return {
      ok: true,
      redirect: `/child/new-task?prefill=${encodeURIComponent(input.text)}`,
    };
  }
  if (input.to === "diary") {
    return {
      ok: true,
      redirect: `/diary/new?prefill=${encodeURIComponent(input.text)}`,
    };
  }
  // to === "todo": run capture again FORCING todo — cleanest way to
  // get dual-language translation + insertion without duplicating code.
  // We do this by re-running captureVoiceIntent; the classifier will
  // likely still classify it as thread/diary based on wording, so we
  // instead just do a direct insert with the text as-is (no fancy
  // translation) — user can always edit on /todos.
  const { data, error } = await supabase
    .from("family_todos")
    .insert({
      family_space_id: (
        await supabase
          .from("profiles")
          .select("family_space_id")
          .eq("id", user.id)
          .maybeSingle()
      ).data?.family_space_id,
      created_by: user.id,
      text_vi: input.text,
      text_en: input.text,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Insert failed" };
  revalidatePath("/todos");
  return { ok: true, redirect: "/todos" };
}
