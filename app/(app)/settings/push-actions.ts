"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { sendPushToUser } from "@/lib/push";

/**
 * Persist a browser push subscription server-side. The client generates
 * the subscription via serviceWorker.pushManager.subscribe() and posts
 * the serialised object here. We upsert on endpoint so a re-subscribe
 * from the same device (e.g. after the user cleared browser data) just
 * updates in place instead of duplicating.
 */
export async function savePushSubscription(input: {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        user_id: user.id,
        endpoint: input.endpoint,
        p256dh: input.p256dh,
        auth: input.auth,
        user_agent: input.userAgent ?? null,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" },
    );

  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings");
  return { ok: true };
}

export async function deletePushSubscription(
  endpoint: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("endpoint", endpoint);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings");
  return { ok: true };
}

/**
 * Fire a "hello" push to the calling user's own subscriptions so they
 * can verify end-to-end that the permission grant + subscribe +
 * service worker + VAPID keys are all wired up correctly.
 */
export async function sendTestPush(): Promise<
  { ok: true; sent: number; gone: number; errored: number }
  | { ok: false; error: string }
> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  try {
    const result = await sendPushToUser(user.id, {
      title: "Noi test",
      body: "Push notifications are working. You'll see gentle nudges here.",
      url: "/",
      tag: "noi-test",
    });
    return { ok: true, ...result };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Push send failed",
    };
  }
}

/** Whether the calling user has at least one active subscription. */
export async function hasPushSubscription(): Promise<boolean> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { count } = await supabase
    .from("push_subscriptions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);
  return (count ?? 0) > 0;
}
