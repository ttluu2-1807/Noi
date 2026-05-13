import Link from "next/link";
import type { Language } from "@/lib/language-detect";

interface ThreadTabsProps {
  threadId: string;
  basePath: "/parent/thread" | "/child/thread";
  active: "chat" | "actions";
  language: Language;
  actionCount: number;
  messageCount: number;
}

const T = {
  vi: { chat: "Trò chuyện", actions: "Việc cần làm" },
  en: { chat: "Conversation", actions: "Action items" },
} as const;

/**
 * Tab strip shown inside an open thread. Splits the scroll into the
 * conversation (messages + composer) and the action items (checklist).
 *
 * Tabs are plain `<Link>` components — tab state lives in the URL
 * (`?tab=actions`), so the page is a Server Component that re-fetches
 * appropriately on tab change. Counts in parentheses give the user
 * a sense of what's where.
 */
export function ThreadTabs({
  threadId,
  basePath,
  active,
  language,
  actionCount,
  messageCount,
}: ThreadTabsProps) {
  const t = T[language];
  const tabs: Array<{ key: "chat" | "actions"; label: string; count: number; href: string }> = [
    {
      key: "chat",
      label: t.chat,
      count: messageCount,
      href: `${basePath}/${threadId}`,
    },
    {
      key: "actions",
      label: t.actions,
      count: actionCount,
      href: `${basePath}/${threadId}?tab=actions`,
    },
  ];

  return (
    <div
      role="tablist"
      className="flex gap-1 rounded-card border border-line bg-white p-1"
    >
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            role="tab"
            aria-selected={isActive}
            className={`flex-1 text-center rounded-[8px] px-3 py-2 text-sm transition-colors ${
              isActive
                ? "bg-accent text-white font-medium"
                : "text-muted hover:text-ink"
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span
                className={`ml-1.5 text-xs ${
                  isActive ? "opacity-80" : "opacity-60"
                }`}
              >
                ({tab.count})
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
