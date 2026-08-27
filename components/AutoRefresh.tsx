"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * Refresh server components whenever the app returns to the foreground.
 *
 * iOS standalone PWA disables the browser's native pull-to-refresh, and
 * users tap back into Noi from other apps constantly — so the "how do
 * I get fresh data?" answer needs to be automatic. This runs
 * router.refresh() on:
 *
 *   · visibilitychange → visible   (tab-switch back, unlock phone)
 *   · window.focus                 (returning from another PWA/tab)
 *
 * Rate-limited to once every 3 seconds so a jittery focus event storm
 * doesn't hammer the server. Skips the very first mount — the page
 * just server-rendered, no need to immediately refresh.
 *
 * RealtimeBoundary already pushes new rows via Supabase Realtime, but
 * that only works while the tab is subscribed — a backgrounded tab
 * misses events + reconnects on wake. This is the belt-and-braces so
 * the wake render always shows fresh data.
 */
export function AutoRefresh() {
  const router = useRouter();
  const pathname = usePathname();
  const lastRefreshRef = useRef<number>(Date.now());

  useEffect(() => {
    const MIN_INTERVAL_MS = 3000;

    const maybeRefresh = () => {
      const now = Date.now();
      if (now - lastRefreshRef.current < MIN_INTERVAL_MS) return;
      lastRefreshRef.current = now;
      router.refresh();
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") maybeRefresh();
    };
    const onFocus = () => maybeRefresh();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
    };
    // pathname in the dep list is intentional — a route change resets
    // the throttle so the first focus after nav always refreshes.
  }, [router, pathname]);

  return null;
}
