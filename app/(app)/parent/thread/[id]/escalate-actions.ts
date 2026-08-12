"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { sendPushToUser } from "@/lib/push";
import { createServiceRoleClient } from "@/lib/supabase/server";

/**
 * "I need help with this" — the parent escalates a thread to family
 * members with a child role. Sets the escalation columns on threads
 * and fires a push to every child in the family. Idempotent: taps
 * to escalate an already-escalated thread just refresh the note +
 * timestamp (no duplicate row).
 */
export async function escalateThread(input: {
  threadId: string;
  note?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  const nowIso = new Date().toISOString();
  const note = (input.note ?? "").trim() || null;

  const { data: thread, error } = await supabase
    .from("threads")
    .update({
      escalated_at: nowIso,
      escalated_by: user.id,
      escalation_note: note,
    })
    .eq("id", input.threadId)
    .select("id, family_space_id, title_vi, title_en")
    .single();
  if (error || !thread) {
    return { ok: false, error: error?.message ?? "Could not escalate" };
  }

  revalidatePath(`/parent/thread/${input.threadId}`);
  revalidatePath(`/child/thread/${input.threadId}`);
  revalidatePath("/parent");
  revalidatePath("/child");

  // Fan out push to every child in the family. Use service-role to
  // dodge RLS on profiles look-up.
  fanOutEscalationPush({
    threadId: input.threadId,
    familySpaceId: thread.family_space_id as string,
    escalatedByUserId: user.id,
    titleVi: thread.title_vi as string | null,
    titleEn: thread.title_en as string | null,
    note,
  }).catch((err) => console.error("[escalate] push fan-out failed:", err));

  return { ok: true };
}

/**
 * Child (or parent) marks the escalation resolved. Clears the columns
 * and pushes the escalator back so they see it landed.
 */
export async function resolveEscalation(input: {
  threadId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  // Grab who escalated + display name of the resolver so the push has
  // a name in it — cheap two-part fetch, RLS-scoped.
  const [threadRes, resolverRes] = await Promise.all([
    supabase
      .from("threads")
      .select("escalated_by, title_vi, title_en, family_space_id")
      .eq("id", input.threadId)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle(),
  ]);
  const thread = threadRes.data;
  if (!thread) return { ok: false, error: "Thread not found" };
  const escalatedBy = thread.escalated_by as string | null;

  const { error } = await supabase
    .from("threads")
    .update({
      escalated_at: null,
      escalated_by: null,
      escalation_note: null,
    })
    .eq("id", input.threadId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/parent/thread/${input.threadId}`);
  revalidatePath(`/child/thread/${input.threadId}`);
  revalidatePath("/parent");
  revalidatePath("/child");

  // Push back to the original escalator that someone's on it.
  if (escalatedBy && escalatedBy !== user.id) {
    const resolverName =
      (resolverRes.data?.display_name as string | null) ?? "Family";
    const title = (thread.title_en ?? thread.title_vi ?? "").toString();
    sendPushToUser(escalatedBy, {
      title: `${resolverName} is helping`,
      body: title,
      url: `/parent/thread/${input.threadId}`,
      tag: `noi-escalation-${input.threadId}`,
    }).catch((err) => console.error("[escalate] resolve push failed:", err));
  }

  return { ok: true };
}

async function fanOutEscalationPush(input: {
  threadId: string;
  familySpaceId: string;
  escalatedByUserId: string;
  titleVi: string | null;
  titleEn: string | null;
  note: string | null;
}): Promise<void> {
  const admin = createServiceRoleClient();

  const [actorRes, childrenRes] = await Promise.all([
    admin
      .from("profiles")
      .select("display_name")
      .eq("id", input.escalatedByUserId)
      .maybeSingle(),
    admin
      .from("profiles")
      .select("id, language_preference")
      .eq("family_space_id", input.familySpaceId)
      .eq("role", "child"),
  ]);

  const actorName =
    (actorRes.data?.display_name as string | null) ?? "Parent";
  const children = childrenRes.data ?? [];
  if (children.length === 0) return;

  await Promise.all(
    children.map(async (c) => {
      const language = (c.language_preference ?? "en") as "vi" | "en";
      const threadTitle =
        (language === "vi" ? input.titleVi : input.titleEn) ??
        input.titleEn ??
        input.titleVi ??
        "";
      const title =
        language === "vi"
          ? `${actorName} cần con giúp`
          : `${actorName} needs your help`;
      const body = input.note
        ? `${threadTitle} — ${input.note}`
        : threadTitle;

      await sendPushToUser(c.id as string, {
        title,
        body,
        url: `/child/thread/${input.threadId}`,
        tag: `noi-escalation-${input.threadId}`,
      });
    }),
  );
}
