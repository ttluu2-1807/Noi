"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Thin teal progress sliver at the top of the page that animates while
 * a client-side route transition is in flight, then completes when the
 * new page mounts.
 *
 * Next 14's App Router doesn't expose a "navigation in progress" hook
 * directly — we approximate by intercepting same-origin link clicks at
 * the document level, showing the bar, and clearing it once the
 * pathname or search params change. Cheap, no dependencies.
 */
export function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [active, setActive] = useState(false);

  // Hide the bar whenever the URL settles.
  useEffect(() => {
    setActive(false);
  }, [pathname, search]);

  // Show the bar on any same-origin link click. Skipped for new-tab
  // (cmd/ctrl/middle), modified, prevented, or external clicks.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return;
      }
      const el = (e.target as HTMLElement)?.closest("a");
      if (!el) return;
      const href = el.getAttribute("href");
      if (!href || href.startsWith("http") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("#")) {
        return;
      }
      if (el.target && el.target !== "_self") return;
      setActive(true);
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return (
    <div
      aria-hidden
      className={`fixed top-0 left-0 right-0 h-0.5 z-50 pointer-events-none transition-opacity ${
        active ? "opacity-100" : "opacity-0"
      }`}
    >
      <div
        className={`h-full bg-accent ${active ? "animate-nav-progress" : ""}`}
        style={{ width: active ? "70%" : "0" }}
      />
    </div>
  );
}
