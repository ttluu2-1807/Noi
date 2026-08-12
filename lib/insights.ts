import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-side fetchers for the dashboard insights panels (FAM-4).
 *
 * Parent and child see different shapes because the JTBDs diverge:
 *
 *   - Parent: "What do I need to do today?" — action-oriented,
 *     minimal cognitive load.
 *   - Child: "Is mum on top of things? What decisions need attention?
 *     What's the family rhythm?" — steward-oriented, slightly richer.
 *
 * Each function makes a handful of parallel queries. Cheap at family
 * scale; if a family ever grows into thousands of rows we'd push some
 * of these into a Postgres function (PERF-2 territory).
 */

const DAY_MS = 24 * 60 * 60 * 1000;

// ------------------------------------------------------------------
// Needs attention (T2 home port)
//
// The audit's "Needs attention" contract: items due or unread, never
// counters. A single flat list, ranked, tap-to-open. Sources:
//   - todos with due_at ≤ now+3d (overdue first, then today, then soon)
//   - diary events (kind=event) with event_date ≤ today+3d
//   - threads updated since the current user last viewed them
//
// The result is small (cap 8) so we can render inline without pagination.
// Ordering matters: overdue → today → next 3 days → unread threads.

export type AttentionItem =
  | {
      kind: "todo-overdue" | "todo-today" | "todo-soon";
      id: string;
      title_en: string;
      title_vi: string;
      due_at: string;
      href: string;
    }
  | {
      kind: "event-today" | "event-soon";
      id: string;
      title_en: string;
      title_vi: string;
      event_date: string;
      href: string;
    }
  | {
      kind: "thread-unread";
      id: string;
      title_en: string;
      title_vi: string;
      updated_at: string;
      href: string;
    };

export interface NeedsAttention {
  items: AttentionItem[];
  /** True when we surveyed all sources and found nothing — "You're all caught up". */
  allCaughtUp: boolean;
}

const ATTENTION_LIMIT = 8;

export async function fetchNeedsAttention(
  supabase: SupabaseClient,
  familySpaceId: string,
  userId: string,
  role: "parent" | "child",
): Promise<NeedsAttention> {
  try {
    const now = new Date();
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);
    const threeDays = new Date(now.getTime() + 3 * DAY_MS);
    threeDays.setHours(23, 59, 59, 999);
    const threadBase =
      role === "parent" ? "/parent/thread" : "/child/thread";

    const [dueTodosRes, upcomingEventsRes, recentThreadsRes, viewsRes] =
      await Promise.all([
        supabase
          .from("family_todos")
          .select("id, text_en, text_vi, due_at")
          .eq("family_space_id", familySpaceId)
          .eq("is_completed", false)
          .is("deleted_at", null)
          .not("due_at", "is", null)
          .lte("due_at", threeDays.toISOString())
          .order("due_at", { ascending: true })
          .limit(20),
        supabase
          .from("diary_entries")
          .select("id, title_en, title_vi, event_date")
          .eq("family_space_id", familySpaceId)
          .eq("kind", "event")
          .is("deleted_at", null)
          .not("event_date", "is", null)
          .gte("event_date", now.toISOString().slice(0, 10))
          .lte("event_date", threeDays.toISOString().slice(0, 10))
          .order("event_date", { ascending: true })
          .limit(10),
        supabase
          .from("threads")
          .select("id, title_en, title_vi, updated_at")
          .eq("family_space_id", familySpaceId)
          .is("deleted_at", null)
          .neq("status", "resolved")
          .order("updated_at", { ascending: false })
          .limit(20),
        supabase
          .from("thread_views")
          .select("thread_id, last_viewed_at")
          .eq("user_id", userId),
      ]);

    const items: AttentionItem[] = [];

    // Todos, bucketed by urgency.
    for (const t of dueTodosRes.data ?? []) {
      const due = new Date(t.due_at as string);
      const kind: AttentionItem["kind"] =
        due < now
          ? "todo-overdue"
          : due <= endOfToday
            ? "todo-today"
            : "todo-soon";
      items.push({
        kind,
        id: t.id as string,
        title_en: (t.text_en ?? "") as string,
        title_vi: (t.text_vi ?? "") as string,
        due_at: t.due_at as string,
        href: "/todos",
      });
    }

    // Diary events happening today or in the next 3 days.
    const todayIso = now.toISOString().slice(0, 10);
    for (const e of upcomingEventsRes.data ?? []) {
      const kind: AttentionItem["kind"] =
        (e.event_date as string) === todayIso ? "event-today" : "event-soon";
      items.push({
        kind,
        id: e.id as string,
        title_en: (e.title_en ?? "") as string,
        title_vi: (e.title_vi ?? "") as string,
        event_date: e.event_date as string,
        href: `/diary/${e.id}`,
      });
    }

    // Unread threads: joined against the current user's thread_views.
    const lastViewedByThread = new Map<string, string>();
    for (const v of viewsRes.data ?? []) {
      lastViewedByThread.set(v.thread_id as string, v.last_viewed_at as string);
    }
    for (const th of recentThreadsRes.data ?? []) {
      const last = lastViewedByThread.get(th.id as string);
      const isUnread = !last || (th.updated_at as string) > last;
      if (!isUnread) continue;
      items.push({
        kind: "thread-unread",
        id: th.id as string,
        title_en: (th.title_en ?? "") as string,
        title_vi: (th.title_vi ?? "") as string,
        updated_at: th.updated_at as string,
        href: `${threadBase}/${th.id}`,
      });
    }

    // Rank: overdue → today → soon → unread threads. Within each bucket,
    // preserve the incoming order (already sorted by due_at / updated_at).
    const rank: Record<AttentionItem["kind"], number> = {
      "todo-overdue": 0,
      "event-today": 1,
      "todo-today": 2,
      "todo-soon": 3,
      "event-soon": 4,
      "thread-unread": 5,
    };
    items.sort((a, b) => rank[a.kind] - rank[b.kind]);

    const capped = items.slice(0, ATTENTION_LIMIT);
    return {
      items: capped,
      allCaughtUp: capped.length === 0,
    };
  } catch (err) {
    console.error("[fetchNeedsAttention] threw:", err);
    return { items: [], allCaughtUp: true };
  }
}


export interface ParentInsights {
  /** Todos due today (or overdue) and not yet completed. */
  todayTodos: Array<{
    id: string;
    text_vi: string;
    text_en: string;
    due_at: string | null;
  }>;
}

export interface ChildInsights {
  weekly: {
    threadsCreated: number;
    todosCompleted: number;
    diaryEntriesAdded: number;
  };
  /** Open todos with due_at in the next 7 days. */
  dueSoon: Array<{
    id: string;
    text_en: string;
    due_at: string;
  }>;
  /** Last few diary decisions for retrospective glance. */
  recentDecisions: Array<{
    id: string;
    title_en: string;
    context_en: string | null;
    created_at: string;
  }>;
  /**
   * Days since the parent last initiated a thread. Null = never has,
   * so we don't show the "hasn't asked in N days" nudge. The signal
   * helps the child see whether mum/dad is actively engaging.
   */
  parentLastActiveDays: number | null;
}

export async function fetchParentInsights(
  supabase: SupabaseClient,
  familySpaceId: string,
): Promise<ParentInsights> {
  // Wrapped defensively — if anything throws (Supabase quirk, missing
  // table during migration, RLS surprise), we degrade to no insights
  // rather than blowing up the entire home page render.
  try {
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const { data, error } = await supabase
      .from("family_todos")
      .select("id, text_vi, text_en, due_at")
      .eq("family_space_id", familySpaceId)
      .eq("is_completed", false)
      .is("deleted_at", null)
      .not("due_at", "is", null)
      .lte("due_at", endOfToday.toISOString())
      .order("due_at", { ascending: true })
      .limit(10);

    if (error) {
      console.error("[fetchParentInsights] query error:", error);
      return { todayTodos: [] };
    }
    return { todayTodos: (data ?? []) as ParentInsights["todayTodos"] };
  } catch (err) {
    console.error("[fetchParentInsights] threw:", err);
    return { todayTodos: [] };
  }
}

const EMPTY_CHILD_INSIGHTS: ChildInsights = {
  weekly: { threadsCreated: 0, todosCompleted: 0, diaryEntriesAdded: 0 },
  dueSoon: [],
  recentDecisions: [],
  parentLastActiveDays: null,
};

export async function fetchChildInsights(
  supabase: SupabaseClient,
  familySpaceId: string,
): Promise<ChildInsights> {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * DAY_MS).toISOString();
    const sevenDaysAhead = new Date(Date.now() + 7 * DAY_MS).toISOString();

    const [
      threadsCount,
      todosCount,
      diaryCount,
      dueSoonResult,
      recentDecisionsResult,
      lastParentResult,
    ] = await Promise.all([
    supabase
      .from("threads")
      .select("*", { count: "exact", head: true })
      .eq("family_space_id", familySpaceId)
      .gte("created_at", sevenDaysAgo)
      .is("deleted_at", null),
    supabase
      .from("family_todos")
      .select("*", { count: "exact", head: true })
      .eq("family_space_id", familySpaceId)
      .eq("is_completed", true)
      .gte("completed_at", sevenDaysAgo)
      .is("deleted_at", null),
    supabase
      .from("diary_entries")
      .select("*", { count: "exact", head: true })
      .eq("family_space_id", familySpaceId)
      .gte("created_at", sevenDaysAgo)
      .is("deleted_at", null),
    supabase
      .from("family_todos")
      .select("id, text_en, due_at")
      .eq("family_space_id", familySpaceId)
      .eq("is_completed", false)
      .is("deleted_at", null)
      .not("due_at", "is", null)
      .lte("due_at", sevenDaysAhead)
      .order("due_at", { ascending: true })
      .limit(5),
    supabase
      .from("diary_entries")
      .select("id, title_en, context_en, created_at")
      .eq("family_space_id", familySpaceId)
      .eq("kind", "decision")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(3),
    // Most recent thread initiated by the parent — proxy for "is the
    // parent engaging with the app?". A simple count would conflate
    // many engagements in one day; we want days-since-last.
    supabase
      .from("threads")
      .select("created_at")
      .eq("family_space_id", familySpaceId)
      .eq("initiated_by_role", "parent")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

    const lastParentAt = lastParentResult.data?.created_at as string | undefined;
    const parentLastActiveDays = lastParentAt
      ? Math.floor((Date.now() - new Date(lastParentAt).getTime()) / DAY_MS)
      : null;

    return {
      weekly: {
        threadsCreated: threadsCount.count ?? 0,
        todosCompleted: todosCount.count ?? 0,
        diaryEntriesAdded: diaryCount.count ?? 0,
      },
      dueSoon: (dueSoonResult.data ?? []) as ChildInsights["dueSoon"],
      recentDecisions: (recentDecisionsResult.data ?? []) as ChildInsights["recentDecisions"],
      parentLastActiveDays,
    };
  } catch (err) {
    console.error("[fetchChildInsights] threw:", err);
    return EMPTY_CHILD_INSIGHTS;
  }
}
