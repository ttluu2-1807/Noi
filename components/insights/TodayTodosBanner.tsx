import Link from "next/link";
import type { Language } from "@/lib/language-detect";

interface TodayTodosBannerProps {
  todos: Array<{ id: string; text_vi: string; text_en: string; due_at: string | null }>;
  language: Language;
}

const T = {
  vi: {
    singular: (n: number) => `${n} việc cần làm hôm nay`,
    plural: (n: number) => `${n} việc cần làm hôm nay`,
    seeAll: "Xem tất cả",
  },
  en: {
    singular: (n: number) => "1 thing to do today",
    plural: (n: number) => `${n} things to do today`,
    seeAll: "See all",
  },
} as const;

/**
 * Parent home insight (FAM-4) — only shown when there are todos due
 * today or overdue. Quiet when there's nothing actionable, so the
 * parent's screen stays calm.
 *
 * Single-card layout — a soft accent-tinted block above the mic, with
 * the first 3 items shown and a "See all" link to /todos when there
 * are more.
 */
export function TodayTodosBanner({ todos, language }: TodayTodosBannerProps) {
  if (todos.length === 0) return null;
  const t = T[language];
  const headline = todos.length === 1 ? t.singular(1) : t.plural(todos.length);
  const visible = todos.slice(0, 3);

  return (
    <Link
      href="/todos"
      className="block rounded-card border border-accent/30 bg-accent/5 px-5 py-4 transition-all hover:border-accent/50 active:scale-[0.995] animate-fade-rise"
    >
      <div className="flex items-start gap-3">
        <div
          className="shrink-0 rounded-full bg-accent/15 text-accent flex items-center justify-center h-9 w-9"
          aria-hidden
        >
          {/* Clock-ish icon */}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className="h-5 w-5"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" strokeLinecap="round" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-ink">{headline}</p>
          <ul className="mt-2 space-y-1 text-sm text-muted">
            {visible.map((todo) => (
              <li key={todo.id} className="truncate">
                • {language === "vi" ? todo.text_vi : todo.text_en}
              </li>
            ))}
          </ul>
          {todos.length > visible.length && (
            <p className="mt-2 text-xs text-accent">
              {t.seeAll} ({todos.length}) →
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
