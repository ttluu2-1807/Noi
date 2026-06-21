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
