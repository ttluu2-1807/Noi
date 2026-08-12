import Link from "next/link";
import { ChatIcon, TodoIcon, DiaryIcon } from "./icons";
import type { Language } from "@/lib/language-detect";

interface QuickAccessRowProps {
  language: Language;
  /** Counts to render under each tile. Optional — tile still renders if missing. */
  counts: {
    threads?: number;
    todos?: number;
    diary?: number;
  };
  /** Override the count's accent — eg. "due today" for todos. */
  hints?: {
    threads?: string;
    todos?: string;
    diary?: string;
  };
  /** Where Activity links — different for parent (/parent) vs child (/child). */
  activityHref?: "/parent" | "/child";
}

const T = {
  vi: {
    threads: "Câu hỏi",
    todos: "Việc cần làm",
    diary: "Nhật ký",
  },
  en: {
    threads: "Threads",
    todos: "To-dos",
    diary: "Diary",
  },
} as const;

/**
 * Three-up tile row shown on parent + child home screens. Each tile
 * deeplinks to a surface (Threads / Todos / Diary). Replaces what was
 * previously hidden behind the avatar menu — the user explicitly
 * asked for these to be visible at home.
 *
 * Counts are optional; we hide the count line if undefined. Hints
 * ("3 due today", "12 entries") replace the raw count when set, so
 * the parent's "Today" view can read naturally.
 *
 * Layout: 3 equal columns on any width. Each tile is a Link with
 * active:scale press feedback to match the rest of the app's tactile
 * affordances.
 */
export function QuickAccessRow({
  language,
  counts,
  hints,
  activityHref = "/parent",
}: QuickAccessRowProps) {
  const t = T[language];

  return (
    <div className="grid grid-cols-3 gap-2">
      <Tile
        href={activityHref}
        icon={<ChatIcon className="h-5 w-5" />}
        label={t.threads}
        count={counts.threads}
        hint={hints?.threads}
      />
      <Tile
        href="/todos"
        icon={<TodoIcon className="h-5 w-5" />}
        label={t.todos}
        count={counts.todos}
        hint={hints?.todos}
      />
      <Tile
        href="/diary"
        icon={<DiaryIcon className="h-5 w-5" />}
        label={t.diary}
        count={counts.diary}
        hint={hints?.diary}
      />
    </div>
  );
}

function Tile({
  href,
  icon,
  label,
  count,
  hint,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  count?: number;
  hint?: string;
}) {
  // Tile is icon + label. When there's an unread/pending count, we
  // surface it as a small inbox-style pill in the top-right corner —
  // not as a body-sm caption underneath the label. The audit doesn't
  // want "3 open" prose next to nav; it's fine as a compact badge.
  const showBadge = typeof count === "number" && count > 0;
  return (
    <Link
      href={href}
      className="group relative flex flex-col items-start gap-1.5 rounded-card border border-line bg-surface p-3 hover:border-green/40 hover:shadow-sm active:scale-[0.97] transition-all"
    >
      <span className="text-green group-hover:scale-110 transition-transform">
        {icon}
      </span>
      <span className="text-body-sm font-medium text-ink">{label}</span>
      {hint !== undefined && (
        <span className="text-body-sm text-ink-3 truncate w-full">{hint}</span>
      )}
      {showBadge && (
        <span
          aria-label={`${count} items`}
          className="absolute top-2 right-2 inline-flex min-w-[20px] h-5 items-center justify-center rounded-full bg-green-wash text-green-text text-body-sm font-medium px-1.5"
        >
          {count}
        </span>
      )}
    </Link>
  );
}
