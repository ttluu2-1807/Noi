import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { fetchNeedsAttention } from "@/lib/insights";
import { sendPushToUser } from "@/lib/push";

/**
 * Daily digest push. Vercel Cron hits this once a day at 21:00 UTC
 * (roughly 7am AEST winter / 8am AEDT summer — a small hour of drift
 * across DST that's acceptable for a morning nudge).
 *
 * For every user who has at least one push subscription, we build a
 * NeedsAttention snapshot for their family and send them a single
 * push summarising it. Users with nothing due/unread get no push
 * (silence beats noise).
 *
 * Auth: Vercel Cron sets an Authorization header with the CRON_SECRET
 * env var — we reject requests without it so the endpoint isn't
 * curl-able by strangers.
 */

// Force this route to always run at request time — no static caching.
export const dynamic = "force-dynamic";
// Give ourselves headroom for large families (each user needs an
// insights fetch + subscription push).
export const maxDuration = 60;

interface DigestCopy {
  title: string;
  body: string;
}

function copyFor(
  language: "vi" | "en",
  overdue: number,
  today: number,
  unread: number,
): DigestCopy | null {
  const total = overdue + today + unread;
  if (total === 0) return null;

  if (language === "vi") {
    const parts: string[] = [];
    if (overdue > 0) parts.push(`${overdue} việc quá hạn`);
    if (today > 0) parts.push(`${today} việc hôm nay`);
    if (unread > 0) parts.push(`${unread} tin mới`);
    return {
      title: overdue > 0 ? "Cần xử lý ngay" : "Chào buổi sáng",
      body: parts.join(" · ") + ".",
    };
  }

  const parts: string[] = [];
  if (overdue > 0) parts.push(`${overdue} overdue`);
  if (today > 0) parts.push(`${today} due today`);
  if (unread > 0) parts.push(`${unread} new ${unread === 1 ? "reply" : "replies"}`);
  return {
    title: overdue > 0 ? "Needs you now" : "Good morning",
    body: parts.join(" · ") + ".",
  };
}

export async function GET(request: Request) {
  // Vercel Cron sends: Authorization: Bearer <CRON_SECRET>
  const auth = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createServiceRoleClient();

  // Pull every user with at least one push subscription. Small query;
  // scales fine for early family life. Aggregated tally returned so
  // we can see it in the Vercel Cron log.
  const { data: profiles, error: profilesError } = await admin
    .from("profiles")
    .select("id, family_space_id, language_preference")
    .not("family_space_id", "is", null);
  if (profilesError) {
    return NextResponse.json({ error: profilesError.message }, { status: 500 });
  }

  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("user_id");
  const subscribedUserIds = new Set((subs ?? []).map((s) => s.user_id as string));

  const eligibleProfiles = (profiles ?? []).filter((p) =>
    subscribedUserIds.has(p.id as string),
  );

  let totalPushed = 0;
  let totalSkipped = 0;
  const errors: string[] = [];

  // Process one at a time — daily digest can be sequential; keeps
  // memory + concurrency simple, and total time even for 50 users
  // stays well under maxDuration.
  for (const p of eligibleProfiles) {
    try {
      const language = (p.language_preference ?? "vi") as "vi" | "en";
      const attention = await fetchNeedsAttention(
        admin,
        p.family_space_id as string,
        p.id as string,
        "child", // role doesn't matter for the digest count — just pick one
      );

      const overdue = attention.items.filter((i) => i.kind === "todo-overdue").length;
      const today = attention.items.filter(
        (i) => i.kind === "todo-today" || i.kind === "event-today",
      ).length;
      const unread = attention.items.filter((i) => i.kind === "thread-unread").length;

      const copy = copyFor(language, overdue, today, unread);
      if (!copy) {
        totalSkipped++;
        continue;
      }

      await sendPushToUser(p.id as string, {
        title: copy.title,
        body: copy.body,
        url: "/",
        tag: `noi-digest-${new Date().toISOString().slice(0, 10)}`,
      });
      totalPushed++;
    } catch (err) {
      errors.push(`${p.id}: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }

  return NextResponse.json({
    ok: true,
    scanned: eligibleProfiles.length,
    pushed: totalPushed,
    skipped: totalSkipped,
    errors,
  });
}
