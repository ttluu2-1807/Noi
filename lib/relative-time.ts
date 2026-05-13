import type { Language } from "./language-detect";

const MIN_MS = 60_000;
const HOUR_MS = 60 * MIN_MS;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;

const STRINGS: Record<Language, {
  justNow: string;
  minutes: (n: number) => string;
  hours: (n: number) => string;
  days: (n: number) => string;
  absoluteLocale: string;
}> = {
  vi: {
    justNow: "Vừa xong",
    minutes: (n) => `${n} phút trước`,
    hours: (n) => `${n} giờ trước`,
    days: (n) => `${n} ngày trước`,
    absoluteLocale: "vi-VN",
  },
  en: {
    justNow: "Just now",
    minutes: (n) => (n === 1 ? "1 min ago" : `${n} min ago`),
    hours: (n) => (n === 1 ? "1 hour ago" : `${n} hours ago`),
    days: (n) => (n === 1 ? "1 day ago" : `${n} days ago`),
    absoluteLocale: "en-AU",
  },
};

/**
 * Compact relative time for thread/message timestamps.
 *
 *   < 1 min   → "Just now" / "Vừa xong"
 *   < 1 hour  → "5 min ago" / "5 phút trước"
 *   < 1 day   → "3 hours ago" / "3 giờ trước"
 *   < 1 week  → "3 days ago" / "3 ngày trước"
 *   older     → "5 Mar" / "5 thg 3"
 *
 * Keeps the dashboard scannable — "5 min ago" carries weight that
 * a raw timestamp doesn't, especially for elderly users.
 */
export function relativeTime(iso: string | Date, language: Language): string {
  const t = typeof iso === "string" ? new Date(iso) : iso;
  const now = Date.now();
  const diff = now - t.getTime();
  const s = STRINGS[language];

  if (diff < MIN_MS) return s.justNow;
  if (diff < HOUR_MS) return s.minutes(Math.floor(diff / MIN_MS));
  if (diff < DAY_MS) return s.hours(Math.floor(diff / HOUR_MS));
  if (diff < WEEK_MS) return s.days(Math.floor(diff / DAY_MS));

  return t.toLocaleDateString(s.absoluteLocale, {
    day: "numeric",
    month: "short",
  });
}
