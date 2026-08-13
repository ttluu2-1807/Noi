"use client";

import { useState, useTransition } from "react";
import { toggleTodo, deleteTodo, restoreTodo } from "./actions";
import Link from "next/link";
import { Toast } from "@/components/Toast";
import { TodoActionsMenu } from "@/components/TodoActionsMenu";
import { FilteredEmptyState } from "@/components/FilteredEmptyState";
import { relativeTime } from "@/lib/relative-time";
import { daysUntil, RECURRENCE_LABELS, type Recurrence } from "@/lib/recurrence";
import type { Language } from "@/lib/language-detect";

export interface TodoRow {
  id: string;
  text_vi: string;
  text_en: string;
  due_at: string | null;
  assignee_role: "parent" | "child" | "any" | null;
  is_completed: boolean;
  completed_at: string | null;
  created_at: string;
  created_by: string | null;
  /** null = one-off. Otherwise the cadence — see lib/recurrence. */
  recurrence?: Recurrence | null;
  /** When set, this todo was extracted from a thread — /todos groups
   *  it under a header linking back to that thread. */
  source_thread_id?: string | null;
  /** Specific person responsible; null renders as "Anyone". */
  owner_id?: string | null;
}

interface TodoListProps {
  items: TodoRow[];
  language: Language;
  /** user_id -> display_name. Used for creator + owner labels. */
  memberNames: Record<string, string>;
  /** thread_id -> {title_vi, title_en} for group headers. */
  threadTitles?: Record<string, { title_vi: string | null; title_en: string | null }>;
  /** Base path for thread deep-links — /parent/thread or /child/thread. */
  threadBasePath?: "/parent/thread" | "/child/thread";
}

const T = {
  vi: {
    open: "Đang làm",
    done: "Đã xong",
    empty: "Chưa có việc nào. Hãy thêm một việc bằng micro hoặc gõ chữ.",
    parent: "Cho ba/mẹ",
    child: "Cho con",
    any: "",
    due: "Hạn:",
    delete: "Xoá",
    deleted: "Đã xoá",
    undo: "Hoàn tác",
    by: "bởi",
    overdue: "Quá hạn",
    today: "Hôm nay",
    tomorrow: "Ngày mai",
    inDays: (n: number) => `Còn ${n} ngày`,
    fromThread: "Từ",
    anyone: "Bất kỳ ai",
    forOwner: "Cho",
  },
  en: {
    open: "Open",
    done: "Done",
    empty: "No to-dos yet. Add one with the mic or by typing.",
    parent: "For parent",
    child: "For child",
    any: "",
    due: "Due:",
    delete: "Delete",
    deleted: "Deleted",
    undo: "Undo",
    by: "by",
    overdue: "Overdue",
    today: "Due today",
    tomorrow: "Due tomorrow",
    inDays: (n: number) => `Due in ${n} days`,
    fromThread: "From",
    anyone: "Anyone",
    forOwner: "For",
  },
} as const;

/**
 * Renders the family's to-do list, split into Open (top) and Done
 * (collapsed beneath with a count). Each row toggles complete/un-
 * complete on checkbox tap and can be deleted with confirmation.
 *
 * Optimistic update: checkbox flips immediately, server action runs
 * via transition; if it fails the next router.refresh resets state.
 */
export function TodoList({
  items,
  language,
  memberNames,
  threadTitles = {},
  threadBasePath = "/child/thread",
}: TodoListProps) {
  const t = T[language];
  const [rows, setRows] = useState(items);
  const [, startTransition] = useTransition();
  const [showDone, setShowDone] = useState(true);
  // Track the most-recently deleted item so the undo toast can restore
  // it. Bumped key forces a fresh Toast mount when multiple deletes
  // happen in quick succession.
  const [undoState, setUndoState] = useState<
    { id: string; label: string; key: number } | null
  >(null);

  const open = rows.filter((r) => !r.is_completed);
  const done = rows.filter((r) => r.is_completed);

  const onToggle = (id: string) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, is_completed: !r.is_completed } : r)),
    );
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", id);
      await toggleTodo(fd);
    });
  };

  const onDelete = (id: string) => {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    const label = language === "vi" ? row.text_vi : row.text_en;

    // Optimistic remove + queue an undo toast.
    setRows((prev) => prev.filter((r) => r.id !== id));
    setUndoState({ id, label, key: (undoState?.key ?? 0) + 1 });

    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", id);
      await deleteTodo(fd);
    });
  };

  const onUndoDelete = () => {
    if (!undoState) return;
    const idToRestore = undoState.id;
    setUndoState(null);
    startTransition(async () => {
      const r = await restoreTodo(idToRestore);
      // No optimistic add-back — the realtime refresh in the parent
      // page will surface the restored row on the next render.
      if (!r.ok) return;
    });
  };

  // Render the toast regardless of whether the list is empty — a user
  // might delete their last item.
  const undoToast = undoState ? (
    <Toast
      key={undoState.key}
      message={`${t.deleted}: ${undoState.label}`}
      actionLabel={t.undo}
      onAction={onUndoDelete}
      onDismiss={() => setUndoState(null)}
    />
  ) : null;

  if (rows.length === 0) {
    return (
      <>
        <FilteredEmptyState
          title={t.empty}
          hint={
            language === "vi"
              ? "Dùng micro ở trên, hoặc gõ một dòng nhanh."
              : "Use the mic above, or type a quick line."
          }
        />
        {undoToast}
      </>
    );
  }

  return (
    <section className="space-y-6">
      {open.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm text-muted uppercase tracking-wide">
            {t.open}{" "}
            <span className="text-muted/60">({open.length})</span>
          </h2>
          <ul className="space-y-2">
            {open.map((row) => (
              <TodoItem
                key={row.id}
                row={row}
                language={language}
                onToggle={onToggle}
                onDelete={onDelete}
                t={t}
                memberNames={memberNames}
                threadTitles={threadTitles}
                threadBasePath={threadBasePath}
              />
            ))}
          </ul>
        </div>
      )}

      {done.length > 0 && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setShowDone((v) => !v)}
            className="text-sm text-muted uppercase tracking-wide hover:text-ink transition-colors flex items-center gap-1"
          >
            <span>
              {t.done}{" "}
              <span className="text-muted/60">({done.length})</span>
            </span>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className={`h-3 w-3 transition-transform ${showDone ? "rotate-180" : ""}`}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {showDone && (
            <ul className="space-y-2">
              {done.map((row) => (
                <TodoItem
                  key={row.id}
                  row={row}
                  language={language}
                  onToggle={onToggle}
                  onDelete={onDelete}
                  t={t}
                  memberNames={memberNames}
                  threadTitles={threadTitles}
                  threadBasePath={threadBasePath}
                />
              ))}
            </ul>
          )}
        </div>
      )}
      {undoToast}
    </section>
  );
}

function TodoItem({
  row,
  language,
  onToggle,
  onDelete,
  t,
  memberNames,
  threadTitles,
  threadBasePath,
}: {
  row: TodoRow;
  language: Language;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  t: (typeof T)[Language];
  memberNames: Record<string, string>;
  threadTitles: Record<string, { title_vi: string | null; title_en: string | null }>;
  threadBasePath: "/parent/thread" | "/child/thread";
}) {
  const label = language === "vi" ? row.text_vi : row.text_en;
  const assigneeBadge =
    row.assignee_role === "parent"
      ? t.parent
      : row.assignee_role === "child"
        ? t.child
        : "";
  const creatorName = row.created_by ? memberNames[row.created_by] : null;
  // Owner rendering — specific person if we know them, "Anyone" as
  // a real value if no owner is set (audit: not null-rendering).
  const ownerName = row.owner_id ? memberNames[row.owner_id] : null;
  // Source thread — small "From: <title> →" line above the label that
  // deep-links to the thread the item was extracted from.
  const sourceThread = row.source_thread_id
    ? threadTitles[row.source_thread_id]
    : null;
  const sourceTitle = sourceThread
    ? language === "vi"
      ? sourceThread.title_vi || sourceThread.title_en
      : sourceThread.title_en || sourceThread.title_vi
    : null;

  return (
    <li>
      <label
        className={`flex cursor-pointer items-start gap-4 rounded-card border bg-white p-4 transition-colors hover:border-accent/40 has-[:checked]:bg-accent/5 has-[:checked]:border-accent/60 ${
          row.is_completed ? "border-line/60" : "border-line"
        }`}
      >
        <input
          type="checkbox"
          checked={row.is_completed}
          onChange={() => onToggle(row.id)}
          className="mt-1 h-5 w-5 shrink-0 accent-[#1D9E75] transition-transform active:scale-90"
          aria-label={label}
        />
        <div className="min-w-0 flex-1 space-y-1">
          {sourceTitle && row.source_thread_id && (
            // Deep-link back to the thread the item was extracted from.
            // stopPropagation so tapping the link doesn't ALSO toggle
            // the checkbox that wraps the row.
            <Link
              href={`${threadBasePath}/${row.source_thread_id}`}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-body-sm text-green-text hover:underline"
            >
              <span className="text-ink-3">{t.fromThread}:</span>
              <span className="truncate max-w-[200px]">{sourceTitle}</span>
              <span aria-hidden>→</span>
            </Link>
          )}
          <p
            className={`leading-relaxed ${
              row.is_completed ? "text-muted line-through" : "text-ink"
            }`}
          >
            {label}
          </p>
          <div className="flex flex-wrap items-center gap-2 text-body-sm text-muted/80">
            {/* Owner pill — always render if we can name a person, or
                render "Anyone" when the owner is deliberately unset
                (per audit: "Anyone" is a real value, not null-rendering). */}
            <span
              className={`rounded-full px-2 py-0.5 ${
                ownerName
                  ? "bg-clay-wash text-clay-deep"
                  : "bg-line/40 text-ink-3"
              }`}
            >
              {t.forOwner} {ownerName ?? t.anyone}
            </span>
            {assigneeBadge && (
              <span className="rounded-full bg-green-wash text-green-text px-2 py-0.5">
                {assigneeBadge}
              </span>
            )}
            {row.recurrence && (
              <span
                aria-label={`Recurring: ${RECURRENCE_LABELS[language][row.recurrence]}`}
                className="inline-flex items-center gap-1 rounded-full bg-line/60 text-ink-3 px-2 py-0.5"
              >
                <RecurIcon />
                {RECURRENCE_LABELS[language][row.recurrence]}
              </span>
            )}
            {row.due_at && !row.is_completed && (
              <DueBadge iso={row.due_at} t={t} />
            )}
            {row.due_at && row.is_completed && (
              <span>
                {t.due} {relativeTime(row.due_at, language)}
              </span>
            )}
            <span>
              {relativeTime(row.created_at, language)}
              {creatorName ? ` · ${t.by} ${creatorName}` : ""}
            </span>
          </div>
        </div>
        <TodoActionsMenu
          todoId={row.id}
          language={language}
          onDelete={() => onDelete(row.id)}
        />
      </label>
    </li>
  );
}

/**
 * Colored due-date pill. Only shown for open todos with a due_at.
 * Urgency ladder:
 *   overdue → clay-wash + clay-deep (loud, "you missed this")
 *   today   → warn-wash + clay (attention, not alarm)
 *   ≤ 7d    → warn-wash + ink-2 (soft heads-up)
 *   > 7d    → line/40 + ink-3 (informational)
 */
function DueBadge({
  iso,
  t,
}: {
  iso: string;
  t: (typeof T)[Language];
}) {
  const n = daysUntil(iso);
  let label: string;
  let className: string;

  if (n < 0) {
    label = t.overdue;
    className = "bg-clay-wash text-clay-deep font-medium";
  } else if (n === 0) {
    label = t.today;
    className = "bg-warn-wash text-clay font-medium";
  } else if (n === 1) {
    label = t.tomorrow;
    className = "bg-warn-wash text-clay";
  } else if (n <= 7) {
    label = t.inDays(n);
    className = "bg-warn-wash text-ink-2";
  } else {
    label = t.inDays(n);
    className = "bg-line/40 text-ink-3";
  }

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${className}`}>
      {n <= 2 && <DotIcon />}
      {label}
    </span>
  );
}

function RecurIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3 w-3">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v6h6M20 20v-6h-6M20 4l-6 6M4 20l6-6" />
    </svg>
  );
}
function DotIcon() {
  return <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />;
}
