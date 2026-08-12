import Link from "next/link";
import type { NeedsAttention as NeedsAttentionData, AttentionItem } from "@/lib/insights";
import type { Language } from "@/lib/language-detect";

interface NeedsAttentionProps {
  data: NeedsAttentionData;
  language: Language;
}

const T = {
  vi: {
    heading: "Cần lưu ý",
    allCaught: "Không có việc gấp — mọi thứ đều ổn.",
    overdue: "Quá hạn",
    today: "Hôm nay",
    tomorrow: "Ngày mai",
    inDays: (n: number) => `${n} ngày nữa`,
    unread: "Tin mới",
    event: "Sự kiện",
    todo: "Việc cần làm",
  },
  en: {
    heading: "Needs attention",
    allCaught: "Nothing urgent — you're all caught up.",
    overdue: "Overdue",
    today: "Today",
    tomorrow: "Tomorrow",
    inDays: (n: number) => `In ${n} days`,
    unread: "New reply",
    event: "Event",
    todo: "To-do",
  },
} as const;

/**
 * Home-screen "needs attention" list per the audit T2 spec:
 * items due or unread, never counters. A single flat, ranked list —
 * overdue todos, then today's events, then today's todos, then
 * soon-due, then unread threads. Tap-through takes you straight to
 * the surface that lets you act on it.
 *
 * Data-fetching lives server-side (see fetchNeedsAttention); this
 * is a pure render.
 */
export function NeedsAttention({ data, language }: NeedsAttentionProps) {
  const t = T[language];

  if (data.allCaughtUp) {
    return (
      <section className="rounded-card border border-line bg-surface p-5 space-y-1 animate-fade-rise">
        <h2 className="text-label uppercase tracking-wide text-ink-3">
          {t.heading}
        </h2>
        <p className="text-body text-ink-2">{t.allCaught}</p>
      </section>
    );
  }

  return (
    <section className="space-y-2 animate-fade-rise">
      <h2 className="text-label uppercase tracking-wide text-ink-3 px-1">
        {t.heading}
      </h2>
      <ul className="space-y-2">
        {data.items.map((item) => (
          <li key={`${item.kind}-${item.id}`}>
            <AttentionRow item={item} language={language} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function AttentionRow({ item, language }: { item: AttentionItem; language: Language }) {
  const t = T[language];
  const title = language === "vi" ? item.title_vi || item.title_en : item.title_en || item.title_vi;

  // Per-kind visual + copy — colour signals urgency via clay (person
  // responsibility) for overdue, green (Noi surfacing) for unread threads,
  // ink-2 neutral for everything else.
  const meta = kindMeta(item, language, t);

  return (
    <Link
      href={item.href}
      className="flex items-start gap-3 rounded-card border border-line bg-surface px-4 py-3 transition-all hover:border-green/40 active:scale-[0.995]"
    >
      <span
        aria-hidden
        className={`shrink-0 mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full ${meta.iconWrap}`}
      >
        {meta.icon}
      </span>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-body font-medium text-ink truncate">{title}</p>
        <p className={`text-body-sm ${meta.metaClass}`}>{meta.metaText}</p>
      </div>
    </Link>
  );
}

function kindMeta(
  item: AttentionItem,
  language: Language,
  t: (typeof T)[Language],
): {
  iconWrap: string;
  metaClass: string;
  metaText: string;
  icon: React.ReactNode;
} {
  const bullet = <BulletDot className="h-2.5 w-2.5" />;
  const bell = <BellIcon className="h-4 w-4" />;
  const cal = <CalIcon className="h-4 w-4" />;
  const chat = <ChatIcon className="h-4 w-4" />;

  switch (item.kind) {
    case "todo-overdue":
      return {
        iconWrap: "bg-clay-wash text-clay-deep",
        metaClass: "text-clay-deep font-medium",
        metaText: `${t.todo} · ${t.overdue}`,
        icon: bell,
      };
    case "todo-today":
      return {
        iconWrap: "bg-warn-wash text-clay",
        metaClass: "text-ink-2",
        metaText: `${t.todo} · ${t.today}`,
        icon: bullet,
      };
    case "todo-soon":
      return {
        iconWrap: "bg-line/40 text-ink-3",
        metaClass: "text-ink-3",
        metaText: `${t.todo} · ${daysAway(item.due_at, language, t)}`,
        icon: bullet,
      };
    case "event-today":
      return {
        iconWrap: "bg-warn-wash text-clay",
        metaClass: "text-ink-2",
        metaText: `${t.event} · ${t.today}`,
        icon: cal,
      };
    case "event-soon":
      return {
        iconWrap: "bg-line/40 text-ink-3",
        metaClass: "text-ink-3",
        metaText: `${t.event} · ${daysAway(item.event_date, language, t, true)}`,
        icon: cal,
      };
    case "thread-unread":
      return {
        iconWrap: "bg-green-wash text-green-text",
        metaClass: "text-green-text",
        metaText: t.unread,
        icon: chat,
      };
  }
}

function daysAway(
  iso: string,
  language: Language,
  t: (typeof T)[Language],
  dateOnly = false,
): string {
  const now = new Date();
  const target = new Date(iso);
  if (dateOnly) {
    // Compare Y-M-D only
    const todayStr = now.toISOString().slice(0, 10);
    const targetStr = target.toISOString().slice(0, 10);
    if (targetStr === todayStr) return t.today;
    const diffDays = Math.round(
      (new Date(targetStr).getTime() - new Date(todayStr).getTime()) /
        (24 * 60 * 60 * 1000),
    );
    if (diffDays === 1) return t.tomorrow;
    return t.inDays(diffDays);
  }
  const diffMs = target.getTime() - now.getTime();
  const diffDays = Math.max(0, Math.round(diffMs / (24 * 60 * 60 * 1000)));
  if (diffDays === 0) return t.today;
  if (diffDays === 1) return t.tomorrow;
  return t.inDays(diffDays);
}

function BulletDot({ className }: { className: string }) {
  return <span className={`inline-block rounded-full bg-current ${className}`} />;
}

function BellIcon({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14V11a6 6 0 1 0-12 0v3a2 2 0 0 1-.6 1.6L4 17h5m6 0v1a3 3 0 1 1-6 0v-1m6 0H9" />
    </svg>
  );
}
function CalIcon({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 2v4M16 2v4M3 10h18M5 6h14a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" />
    </svg>
  );
}
function ChatIcon({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.4-4 8-9 8a9.9 9.9 0 0 1-4-.8L3 20l1.3-3.4A7.9 7.9 0 0 1 3 12c0-4.4 4-8 9-8s9 3.6 9 8z" />
    </svg>
  );
}
