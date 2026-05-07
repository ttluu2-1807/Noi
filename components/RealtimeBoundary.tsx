"use client";

import { useRealtimeRefresh } from "@/hooks/useRealtimeRefresh";

interface RealtimeBoundaryProps {
  /** Supabase tables to watch. */
  tables: Array<"messages" | "threads" | "checklist_items">;
  /** Unique channel name — scope with family id or thread id. */
  channelName: string;
  /** Optional Supabase realtime filter, e.g. `thread_id=eq.<id>`. */
  filter?: string;
  children: React.ReactNode;
}

/**
 * Tiny client wrapper that adds a Supabase Realtime subscription to a
 * Server Component tree. Any row change refreshes the page so the
 * server re-fetches its data. Shared between parent and child sides.
 */
export function RealtimeBoundary({
  tables,
  channelName,
  filter,
  children,
}: RealtimeBoundaryProps) {
  useRealtimeRefresh({ tables, channelName, filter });
  return <>{children}</>;
}
