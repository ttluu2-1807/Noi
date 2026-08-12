import Link from "next/link";
import type { NeedsAttention, AttentionItem } from "@/lib/insights";
import type { Language } from "@/lib/language-detect";

interface UrgentBannerProps {
  data: NeedsAttention;
  language: Language;
}

const T = {
  vi: {
    heading: "Cần xử lý ngay",
    one: (label: string) => `${label} — quá hạn.`,
    many: (n: number) => `${n} việc đã quá hạn.`,
    todayOne: (label: string) => `${label} — hôm nay.`,
    todayMany: (n: number) => `${n} việc đến hạn hôm nay.`,
    escOne: (label: string, name: string | null) =>
      name ? `${name} cần giúp: ${label}` : `Cần giúp: ${label}`,
    escMany: (n: number) => `${n} yêu cầu giúp.`,
    view: "Xem",
  },
  en: {
    heading: "Needs you now",
    one: (label: string) => `${label} — overdue.`,
    many: (n: number) => `${n} overdue items.`,
    todayOne: (label: string) => `${label} — due today.`,
    todayMany: (n: number) => `${n} due today.`,
    escOne: (label: string, name: string | null) =>
      name ? `${name} needs help: ${label}` : `Needs help: ${label}`,
    escMany: (n: number) => `${n} escalations waiting.`,
    view: "View",
  },
} as const;

/**
 * Top-of-home banner shown ONLY when there's something the family
 * needs to look at right now — overdue items or items due today.
 * Sits above the QuickAccessRow / greeting so it's the first thing
 * on the page. If nothing's urgent, the component renders null and
 * the layout is unaffected.
 *
 * Complements NeedsAttention (below-the-fold ranked list). This
 * banner is the "urgency escalation" surface: one item = name it
 * inline, many items = compact count + tap-through.
 */
export function UrgentBanner({ data, language }: UrgentBannerProps) {
  const t = T[language];

  const escalations = data.items.filter(isEscalation);
  const overdue = data.items.filter(isOverdue);
  const today = data.items.filter(isToday);

  if (
    escalations.length === 0 &&
    overdue.length === 0 &&
    today.length === 0
  ) {
    return null;
  }

  // Precedence: escalations (loudest) → overdue → today. First bucket
  // with any item wins the banner's framing + palette.
  const showEscalated = escalations.length > 0;
  const showOverdue = !showEscalated && overdue.length > 0;
  const primary = showEscalated ? escalations : showOverdue ? overdue : today;
  const singleLabel =
    primary.length === 1
      ? (language === "vi"
          ? primary[0].title_vi || primary[0].title_en
          : primary[0].title_en || primary[0].title_vi) ?? ""
      : "";
  const escalatorName =
    showEscalated && primary.length === 1 && primary[0].kind === "thread-escalated"
      ? primary[0].escalated_by_name
      : null;
  const line =
    primary.length === 1
      ? showEscalated
        ? t.escOne(singleLabel, escalatorName)
        : showOverdue
          ? t.one(singleLabel)
          : t.todayOne(singleLabel)
      : showEscalated
        ? t.escMany(primary.length)
        : showOverdue
          ? t.many(primary.length)
          : t.todayMany(primary.length);
  const primaryHref = primary[0].href;
  // Escalations get the strongest clay treatment — they're the
  // human-urgency signal, distinct from time-urgency.
  const paletteLoud = showEscalated || showOverdue;

  return (
    <section
      role="status"
      aria-label={t.heading}
      className={`flex items-start gap-3 rounded-card border p-4 animate-fade-rise ${
        paletteLoud
          ? "border-clay/40 bg-clay-wash"
          : "border-lantern/60 bg-warn-wash"
      }`}
    >
      <span
        aria-hidden
        className={`shrink-0 mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full ${
          paletteLoud ? "bg-clay text-white" : "bg-lantern text-ink"
        }`}
      >
        <BellIcon />
      </span>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-label uppercase tracking-wide text-ink-2">
          {t.heading}
        </p>
        <p className="text-body text-ink truncate">{line}</p>
      </div>
      <Link
        href={primaryHref}
        className={`shrink-0 self-center rounded-full border px-3 py-1 text-body-sm font-medium transition-transform active:scale-95 ${
          paletteLoud
            ? "border-clay-deep/30 bg-surface text-clay-deep hover:bg-clay-wash"
            : "border-ink/20 bg-surface text-ink hover:bg-line/40"
        }`}
      >
        {t.view} →
      </Link>
    </section>
  );
}

function isEscalation(item: AttentionItem): boolean {
  return item.kind === "thread-escalated";
}
function isOverdue(item: AttentionItem): boolean {
  return item.kind === "todo-overdue";
}
function isToday(item: AttentionItem): boolean {
  return item.kind === "todo-today" || item.kind === "event-today";
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14V11a6 6 0 1 0-12 0v3a2 2 0 0 1-.6 1.6L4 17h5m6 0v1a3 3 0 1 1-6 0v-1m6 0H9"
      />
    </svg>
  );
}
