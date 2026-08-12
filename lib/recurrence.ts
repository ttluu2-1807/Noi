/**
 * Recurring-deadline helpers for family_todos (roadmap #4).
 *
 * The schema keeps recurrence data as two small columns:
 *   · recurrence: 'fortnightly' | 'monthly' | 'quarterly' | 'annually'
 *   · rollover:   'reset' | 'spawn'
 *
 * "reset"  — on complete, the SAME row's due_at rolls forward. History
 *            stays in one place; a small counter shows completions.
 * "spawn"  — on complete, mark row completed AND insert a fresh row
 *            with the next due_at. Advanced users only; more churn.
 *
 * "Next due" preserves cadence: it's computed from the current due_at
 * plus the interval, NOT from `now`, so a task completed two days late
 * still slots back onto its schedule. A floor of tomorrow prevents an
 * instantly-overdue task from immediately reappearing red.
 */

export type Recurrence =
  | "fortnightly"
  | "monthly"
  | "quarterly"
  | "annually";

export type Rollover = "reset" | "spawn";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Given a current due_at (ISO) and a recurrence, return the ISO of the
 * next occurrence. `now` defaults to Date() but is injectable for tests.
 *
 * Floor: if the computed next date is still in the past (task was
 * badly overdue), we push out to tomorrow so the recurring todo doesn't
 * pop up already-overdue on the next render.
 */
export function nextDueAt(
  currentIso: string | null | undefined,
  recurrence: Recurrence,
  now: Date = new Date(),
): string {
  const from = currentIso ? new Date(currentIso) : new Date(now);
  const bumped = new Date(from);

  switch (recurrence) {
    case "fortnightly":
      bumped.setDate(bumped.getDate() + 14);
      break;
    case "monthly":
      bumped.setMonth(bumped.getMonth() + 1);
      break;
    case "quarterly":
      bumped.setMonth(bumped.getMonth() + 3);
      break;
    case "annually":
      bumped.setFullYear(bumped.getFullYear() + 1);
      break;
  }

  // Never return a next-due in the past; push to tomorrow at earliest.
  const tomorrow = new Date(now.getTime() + DAY_MS);
  return bumped < tomorrow ? tomorrow.toISOString() : bumped.toISOString();
}

/**
 * Days-until helper used by the row pill and urgency banner. Returns
 * a signed integer (negative = overdue, 0 = today, positive = future).
 * Uses Y-M-D comparison so a task "due today at 09:00" is still 0 even
 * once it's 10am.
 */
export function daysUntil(iso: string, now: Date = new Date()): number {
  const target = new Date(iso);
  const targetDay = new Date(
    target.getFullYear(),
    target.getMonth(),
    target.getDate(),
  );
  const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((targetDay.getTime() - nowDay.getTime()) / DAY_MS);
}

/**
 * Bilingual labels for the recurrence picker + row badges.
 */
export const RECURRENCE_LABELS = {
  vi: {
    fortnightly: "Hai tuần một lần",
    monthly: "Hàng tháng",
    quarterly: "Hàng quý",
    annually: "Hàng năm",
  },
  en: {
    fortnightly: "Fortnightly",
    monthly: "Monthly",
    quarterly: "Quarterly",
    annually: "Annually",
  },
} as const;

export const ROLLOVER_LABELS = {
  vi: {
    reset: "Đặt lại việc này cho lần tới",
    spawn: "Tạo việc mới cho lần tới",
  },
  en: {
    reset: "Reset this to-do for next time",
    spawn: "Create a fresh to-do next time",
  },
} as const;
