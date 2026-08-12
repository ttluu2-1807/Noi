import webpush from "web-push";
import { createServiceRoleClient } from "@/lib/supabase/server";

/**
 * Server-side Web Push helper. All senders (test push, daily digest,
 * deadline nudges, escalation) go through sendPushToUser() —
 * centralised so subscription cleanup on 410 Gone happens in one place.
 *
 * VAPID keys are set at module load. If the env vars aren't populated
 * the send functions will throw at call time with a clear error.
 */

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? "mailto:noi@noi-app.com";

let vapidConfigured = false;

function ensureVapid(): void {
  if (vapidConfigured) return;
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    throw new Error(
      "VAPID keys not configured — set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.",
    );
  }
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
  vapidConfigured = true;
}

export interface PushPayload {
  title: string;
  body: string;
  /** Deep link to open when the user taps the notification. */
  url?: string;
  /** Grouping tag — same tag replaces the previous notification. */
  tag?: string;
}

/**
 * Push every device this user has subscribed. Returns per-endpoint
 * results — successful, gone (auto-cleaned), or errored — so a caller
 * doing bulk delivery (daily digest) can log its own outcome.
 *
 * On HTTP 404 or 410 we delete the subscription (endpoint is gone for
 * good). Other errors are logged + surfaced but the subscription
 * stays so the next send can retry.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<{
  sent: number;
  gone: number;
  errored: number;
}> {
  ensureVapid();
  const admin = createServiceRoleClient();

  const { data: subs, error } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);
  if (error) {
    console.error("[push] fetch subs failed:", error);
    return { sent: 0, gone: 0, errored: 0 };
  }
  if (!subs || subs.length === 0) return { sent: 0, gone: 0, errored: 0 };

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? "/",
    tag: payload.tag ?? "noi-notification",
  });

  let sent = 0;
  let gone = 0;
  let errored = 0;

  await Promise.all(
    subs.map(async (row) => {
      const sub = {
        endpoint: row.endpoint as string,
        keys: {
          p256dh: row.p256dh as string,
          auth: row.auth as string,
        },
      };
      try {
        await webpush.sendNotification(sub, body, { TTL: 60 * 60 * 24 });
        sent++;
        // Best-effort last_seen bump — non-blocking.
        admin
          .from("push_subscriptions")
          .update({ last_seen_at: new Date().toISOString() })
          .eq("id", row.id)
          .then(() => {
            /* noop */
          });
      } catch (err: unknown) {
        const status = (err as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) {
          // Endpoint gone forever — clean up.
          await admin.from("push_subscriptions").delete().eq("id", row.id);
          gone++;
        } else {
          console.warn("[push] send failed:", status, err);
          errored++;
        }
      }
    }),
  );

  return { sent, gone, errored };
}

/**
 * Push every subscribed user in a family space. Used by daily digest
 * + escalation. Returns aggregated counts.
 */
export async function sendPushToFamily(
  familySpaceId: string,
  payload: PushPayload,
): Promise<{ users: number; sent: number; gone: number; errored: number }> {
  ensureVapid();
  const admin = createServiceRoleClient();

  const { data: profiles } = await admin
    .from("profiles")
    .select("id")
    .eq("family_space_id", familySpaceId);
  if (!profiles) return { users: 0, sent: 0, gone: 0, errored: 0 };

  let sent = 0;
  let gone = 0;
  let errored = 0;
  await Promise.all(
    profiles.map(async (p) => {
      const r = await sendPushToUser(p.id as string, payload);
      sent += r.sent;
      gone += r.gone;
      errored += r.errored;
    }),
  );

  return { users: profiles.length, sent, gone, errored };
}
