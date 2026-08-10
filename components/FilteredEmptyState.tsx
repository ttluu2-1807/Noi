import Link from "next/link";
import type { Language } from "@/lib/language-detect";

interface FilteredEmptyStateProps {
  /**
   * A short line that names the active filter or context — e.g.
   * "No open threads", "No entries filed under Events yet". The
   * copy should be specific to what the user is looking at, not
   * generic ("Nothing to show").
   */
  title: string;
  /**
   * Optional second line — a hint at where the missing items might
   * be. Common pattern: "There are N entries in other filters." When
   * present, it should include a call to widen the filter.
   */
  hint?: string;
  /**
   * The one action that matches the empty context — e.g. "New entry"
   * on the diary, "Add a to-do" on todos, "Ask a question" on threads.
   * Rendered as a solid green CTA. Provide either href or onClick.
   */
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  /**
   * Optional secondary link — usually "See all entries" to clear the
   * filter, distinct from the primary action of creating something new.
   */
  secondaryAction?: {
    label: string;
    href: string;
  };
  language?: Language;
}

/**
 * A single shared empty-state component covering every list surface —
 * threads (open/done), todos (open/done), diary (by kind), trash. The
 * copy contract per the design doc:
 *   1. Name the active filter in the title
 *   2. Offer the matching action
 *   3. Say whether other entries exist elsewhere
 *
 * This component is deliberately layout-free (only inner padding); the
 * caller wraps it in whatever container fits their page rhythm.
 */
export function FilteredEmptyState({
  title,
  hint,
  action,
  secondaryAction,
}: FilteredEmptyStateProps) {
  return (
    <section className="rounded-card border border-line bg-surface p-8 text-center space-y-4 animate-fade-rise">
      <div className="space-y-1.5">
        <p className="text-body text-ink font-medium">{title}</p>
        {hint && <p className="text-body-sm text-ink-3">{hint}</p>}
      </div>
      {(action || secondaryAction) && (
        <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
          {action &&
            (action.href ? (
              <Link
                href={action.href}
                className="btn-primary rounded-card px-5 py-2.5 text-body-sm"
              >
                {action.label}
              </Link>
            ) : (
              <button
                type="button"
                onClick={action.onClick}
                className="btn-primary rounded-card px-5 py-2.5 text-body-sm"
              >
                {action.label}
              </button>
            ))}
          {secondaryAction && (
            <Link
              href={secondaryAction.href}
              className="text-body-sm text-green-text hover:underline"
            >
              {secondaryAction.label}
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
