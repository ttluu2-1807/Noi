import type { SupabaseClient } from "@supabase/supabase-js";
import type { LatestMessageSummary } from "@/components/ThreadCard";

/**
 * Fetch the latest message per thread for a set of thread ids, returning
 * a map keyed by thread id. RLS still applies — only messages in the
 * user's family space come back.
 *
 * We pull all matching messages in a single query ordered by created_at
 * desc, then take the first occurrence per thread id. For a dashboard
 * limited to 50 threads with a typical handful of messages each, this
 * is cheaper than firing one query per thread.
 *
 * Returns an empty map if `threadIds` is empty (skips the round trip).
 */
export async function fetchLatestMessagePerThread(
  supabase: SupabaseClient,
  threadIds: string[],
): Promise<Record<string, LatestMessageSummary>> {
  if (threadIds.length === 0) return {};

  const { data, error } = await supabase
    .from("messages")
    .select("thread_id, content_vi, content_en, sender_role, attachments, created_at")
    .in("thread_id", threadIds)
    .order("created_at", { ascending: false });

  if (error || !data) return {};

  const result: Record<string, LatestMessageSummary> = {};
  for (const row of data) {
    const tid = row.thread_id as string;
    if (result[tid]) continue; // already have the latest for this thread
    const attachments = Array.isArray(row.attachments) ? row.attachments : [];
    result[tid] = {
      content_vi: row.content_vi as string | null,
      content_en: row.content_en as string | null,
      sender_role: row.sender_role as LatestMessageSummary["sender_role"],
      has_attachment: attachments.length > 0,
    };
  }
  return result;
}
