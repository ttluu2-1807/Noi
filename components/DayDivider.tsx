import type { Language } from "@/lib/language-detect";

const T = {
  vi: {
    today: "Hôm nay",
    yesterday: "Hôm qua",
    locale: "vi-VN",
  },
  en: {
    today: "Today",
    yesterday: "Yesterday",
    locale: "en-AU",
  },
} as const;

interface DayDividerProps {
  iso: string;
  language: Language;
}

/**
 * Small "Today" / "Yesterday" / "5 May" divider inserted between
 * messages from different days inside a thread. Gives long
 * conversations a sense of time — and matches how chat apps elderly
 * users already know (Messenger, Zalo) work.
 */
export function DayDivider({ iso, language }: DayDividerProps) {
  const t = T[language];
  const date = new Date(iso);
  const now = new Date();
  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  const label = isSameDay(date, now)
    ? t.today
    : isSameDay(date, yesterday)
      ? t.yesterday
      : date.toLocaleDateString(t.locale, {
          day: "numeric",
          month: "long",
          year: now.getFullYear() === date.getFullYear() ? undefined : "numeric",
        });

  return (
    <div className="flex items-center gap-3 my-4" role="separator" aria-label={label}>
      <div className="flex-1 h-px bg-line" />
      <span className="text-xs text-muted/80 uppercase tracking-wide">{label}</span>
      <div className="flex-1 h-px bg-line" />
    </div>
  );
}

/**
 * Given an ordered list of messages, returns an array of "items" that
 * alternate between divider markers and the original message rows.
 * Callers map over the result and render each item appropriately.
 */
export function withDayDividers<M extends { created_at: string }>(
  messages: M[],
): Array<{ type: "divider"; iso: string } | { type: "message"; message: M }> {
  const out: Array<{ type: "divider"; iso: string } | { type: "message"; message: M }> = [];
  let lastDay: string | null = null;
  for (const m of messages) {
    const day = m.created_at.slice(0, 10); // YYYY-MM-DD
    if (day !== lastDay) {
      out.push({ type: "divider", iso: m.created_at });
      lastDay = day;
    }
    out.push({ type: "message", message: m });
  }
  return out;
}
