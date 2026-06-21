import Link from "next/link";
import type { ChildInsights } from "@/lib/insights";
import { relativeTime } from "@/lib/relative-time";
import { ThinkingIcon } from "@/components/icons";

interface ChildInsightsRowProps {
  insights: ChildInsights;
}

/**
 * Three-card insights row above the child's activity list (FAM-4).
 *
 * Cards:
 *   1. This week — counts of threads asked, todos completed, diary
 *      entries logged. Family rhythm at a glance.
 *   2. Due soon — open todos with due_at inside the next 7 days. The
 *      action queue. Links into /todos.
 *   3. Recent decisions — last 3 diary decisions. The "why" excerpts
 *      surface so retrospective scanning works at a glance. Links into
 *      the diary filter.
 *
 * Each card collapses gracefully when there's no data — we don't show
 * empty placeholders. If the entire row would be empty (new family, no
 * activity), the row hides itself entirely.
 */
export function ChildInsightsRow({ insights }: ChildInsightsRowProps) {
  const { weekly, dueSoon, recentDecisions, parentLastActiveDays } = insights;
  const hasWeekly =
    weekly.threadsCreated + weekly.todosCompleted + weekly.diaryEntriesAdded > 0;
  const hasDueSoon = dueSoon.length > 0;
  const hasDecisions = recentDecisions.length > 0;

  if (!hasWeekly && !hasDueSoon && !hasDecisions) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-sm text-muted uppercase tracking-wide">Highlights</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Card 1 — This week summary. Linked to /child so the user can
            drill into the activity stream from the highlight. */}
        {hasWeekly && (
          <Link
            href="/child"
            className="block rounded-card border border-line bg-white p-4 space-y-2 hover:border-accent/40 hover:shadow-sm transition-all active:scale-[0.995] animate-fade-rise"
          >
            <h3 className="text-xs text-muted uppercase tracking-wide">
              This week
            </h3>
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-muted">Questions asked</dt>
                <dd className="font-medium">{weekly.threadsCreated}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted">To-dos done</dt>
                <dd className="font-medium">{weekly.todosCompleted}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted">Diary entries</dt>
                <dd className="font-medium">{weekly.diaryEntriesAdded}</dd>
              </div>
            </dl>
            {parentLastActiveDays !== null && parentLastActiveDays >= 7 && (
              <p className="text-xs text-amber-700 pt-1 border-t border-line">
                Parent hasn&apos;t asked anything in {parentLastActiveDays} days
              </p>
            )}
          </Link>
        )}

        {/* Card 2 — Due soon */}
        {hasDueSoon && (
          <Link
            href="/todos"
            className="block rounded-card border border-line bg-white p-4 space-y-2 hover:border-accent/40 hover:shadow-sm transition-all active:scale-[0.995] animate-fade-rise"
          >
            <h3 className="text-xs text-muted uppercase tracking-wide">
              Due soon
            </h3>
            <ul className="space-y-1 text-sm">
              {dueSoon.slice(0, 3).map((t) => (
                <li key={t.id} className="space-y-0.5">
                  <p className="text-ink line-clamp-1">{t.text_en}</p>
                  <p className="text-xs text-muted">
                    {relativeTime(t.due_at, "en")}
                  </p>
                </li>
              ))}
            </ul>
            {dueSoon.length > 3 && (
              <p className="text-xs text-accent">
                See all ({dueSoon.length}) →
              </p>
            )}
          </Link>
        )}

        {/* Card 3 — Recent decisions */}
        {hasDecisions && (
          <Link
            href="/diary?kind=decision"
            className="block rounded-card border border-line bg-white p-4 space-y-2 hover:border-accent/40 hover:shadow-sm transition-all active:scale-[0.995] animate-fade-rise"
          >
            <h3 className="text-xs text-muted uppercase tracking-wide">
              Recent decisions
            </h3>
            <ul className="space-y-2 text-sm">
              {recentDecisions.map((d) => (
                <li key={d.id} className="space-y-0.5">
                  <p className="text-ink font-medium line-clamp-1 flex items-center gap-1.5">
                    <ThinkingIcon className="h-3.5 w-3.5 text-accent shrink-0" />
                    <span className="truncate">{d.title_en}</span>
                  </p>
                  {d.context_en && (
                    <p className="text-xs text-muted italic line-clamp-2">
                      {d.context_en}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </Link>
        )}
      </div>
    </section>
  );
}
