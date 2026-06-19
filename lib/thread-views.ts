"use server";

import { createServerClient } from "@/lib/supabase/server";

/**
 * Mark a thread as viewed by the current user — bumps `last_viewed_at`
 * to now. Called by the <MarkAsViewed> client component on mount, and
 * by replyToThread after a successful reply (so the user's own
 * message doesn't make the thread look "unread" to themselves).
 *
 * Idempotent: an upsert keyed on (user_id, thread_id) means repeated
 * calls just bump the timestamp.
 */
export async function markThreadViewed(threadId: string): Promise<void> {
  if (!threadId) return;
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("thread_views").upsert(
    {
      user_id: user.id,
      thread_id: threadId,
      last_viewed_at: new Date().toISOString(),
    },
    { onConflict: "user_id,thread_id" },
  );
}
