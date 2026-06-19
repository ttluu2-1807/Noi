"use client";

import { useEffect, useRef } from "react";
import { markThreadViewed } from "@/lib/thread-views";

interface MarkAsViewedProps {
  threadId: string;
}

/**
 * Fires `markThreadViewed(threadId)` once on mount so the user's
 * `thread_views.last_viewed_at` for this thread is set to "now". The
 * dashboard's unread indicator is `thread.updated_at > last_viewed_at`,
 * so visiting a thread clears its unread dot.
 *
 * The useRef guard handles React 18 StrictMode dev double-mounting —
 * we only want to fire once, even though the action itself is
 * idempotent.
 */
export function MarkAsViewed({ threadId }: MarkAsViewedProps) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    markThreadViewed(threadId).catch(() => {
      // best-effort — failure just means the dot stays a little longer
    });
  }, [threadId]);

  return null;
}
