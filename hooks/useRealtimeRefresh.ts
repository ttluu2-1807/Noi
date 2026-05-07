"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Options {
  /** Supabase tables to watch. Any change triggers router.refresh(). */
  tables: Array<"messages" | "threads" | "checklist_items">;
  /** Unique channel name — use thread id / family id to scope. */
  channelName: string;
  /** Optional filter string, e.g. `thread_id=eq.<id>`. */
  filter?: string;
}

/**
 * Subscribes to postgres_changes on the given tables and calls
 * router.refresh() whenever any event fires. Simplest way to keep a
 * Server Component page live — re-fetches its data on each change.
 *
 * RLS is still enforced on the realtime channel, so we only ever see
 * events for rows the user is allowed to read.
 */
export function useRealtimeRefresh({ tables, channelName, filter }: Options) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(channelName);

    for (const table of tables) {
      channel.on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        "postgres_changes" as any,
        {
          event: "*",
          schema: "public",
          table,
          ...(filter ? { filter } : {}),
        },
        () => router.refresh(),
      );
    }

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tables.join(","), channelName, filter, router]);
}
