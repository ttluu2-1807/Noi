import Link from "next/link";
import type { Language } from "@/lib/language-detect";

interface StatusTabsProps {
  /** Base path (e.g. /child or /parent). Tabs append ?status=. */
  basePath: "/child" | "/parent";
  active: "open" | "done";
  language: Language;
  openCount: number;
  doneCount: number;
}

const T = {
  vi: { open: "Đang mở", done: "Đã xong" },
  en: { open: "Open", done: "Done" },
} as const;

/**
 * Top-of-dashboard tab strip that splits the activity list into "Open"
 * and "Done". State lives in the URL (`?status=done`) so deep links
 * preserve the view and the server re-fetches based on the param.
 */
export function StatusTabs({
  basePath,
  active,
  language,
  openCount,
  doneCount,
}: StatusTabsProps) {
  const t = T[language];
  const tabs: Array<{ key: "open" | "done"; label: string; count: number; href: string }> = [
    { key: "open", label: t.open, count: openCount, href: basePath },
    { key: "done", label: t.done, count: doneCount, href: `${basePath}?status=done` },
  ];

  return (
    <div role="tablist" className="inline-flex gap-1 rounded-card border border-line bg-white p-1">
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            role="tab"
            aria-selected={isActive}
            className={`rounded-[8px] px-4 py-1.5 text-sm transition-colors ${
              isActive
                ? "bg-accent text-white font-medium"
                : "text-muted hover:text-ink"
            }`}
          >
            {tab.label}
            <span className={`ml-1.5 text-xs ${isActive ? "opacity-80" : "opacity-60"}`}>
              ({tab.count})
            </span>
          </Link>
        );
      })}
    </div>
  );
}
