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
 */
export type VoiceCaptureResult =
  | {
      ok: true;
      intent: VoiceIntent["kind"];
      summary: string;
      redirect: string;
    }
  | { ok: false; error: string };

/**
 * Take a free-form transcript from the global voice FAB, decide what
 * the user meant (todo / diary / thread), persist it appropriately,
 * and return a redirect path so the client can land the user on the
 * right surface to confirm or keep editing.
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
    const { error } = await supabase.from("family_todos").insert({
      family_space_id: profile.family_space_id,
      created_by: user.id,
      text_vi: intent.text_vi,
      text_en: intent.text_en,
      due_at: intent.due_at,
      assignee_role: intent.assignee_role,
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/todos");
    revalidatePath("/child");
    return {
      ok: true,
      intent: "todo",
      summary: intent.text_en || intent.text_vi,
      redirect: "/todos",
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
      redirect: `/diary/${result.id}`,
    };
  }

  // intent.kind === "thread" — we don't auto-create a thread because
  // that's a multi-step flow (translate → preview → confirm). Bounce to
  // /child/new-task with the prefill, where the existing flow takes over.
  return {
    ok: true,
    intent: "thread",
    summary: intent.text,
    redirect: `/child/new-task?prefill=${encodeURIComponent(intent.text)}`,
  };
}
