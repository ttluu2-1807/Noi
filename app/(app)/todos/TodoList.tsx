"use client";

import { useState, useTransition } from "react";
import { toggleTodo, deleteTodo } from "./actions";
import { relativeTime } from "@/lib/relative-time";
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
}

interface TodoListProps {
  items: TodoRow[];
  language: Language;
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
    confirmDelete: "Xoá việc này?",
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
    confirmDelete: "Delete this task?",
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
export function TodoList({ items, language }: TodoListProps) {
  const t = T[language];
  const [rows, setRows] = useState(items);
  const [, startTransition] = useTransition();
  const [showDone, setShowDone] = useState(true);

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
    if (!confirm(t.confirmDelete)) return;
    setRows((prev) => prev.filter((r) => r.id !== id));
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", id);
      await deleteTodo(fd);
    });
  };

  if (rows.length === 0) {
    return (
      <section className="rounded-card border border-line bg-white p-8 text-center">
        <p className="text-sm text-muted">{t.empty}</p>
      </section>
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
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function TodoItem({
  row,
  language,
  onToggle,
  onDelete,
  t,
}: {
  row: TodoRow;
  language: Language;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  t: (typeof T)[Language];
}) {
  const label = language === "vi" ? row.text_vi : row.text_en;
  const assigneeBadge =
    row.assignee_role === "parent"
      ? t.parent
      : row.assignee_role === "child"
        ? t.child
        : "";

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
          <p
            className={`leading-relaxed ${
              row.is_completed ? "text-muted line-through" : "text-ink"
            }`}
          >
            {label}
          </p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted/80">
            {assigneeBadge && (
              <span className="rounded-full bg-accent/10 text-accent px-2 py-0.5">
                {assigneeBadge}
              </span>
            )}
            {row.due_at && (
              <span>
                {t.due} {relativeTime(row.due_at, language)}
              </span>
            )}
            <span>{relativeTime(row.created_at, language)}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            onDelete(row.id);
          }}
          className="shrink-0 text-xs text-muted/60 hover:text-red-600 transition-colors active:scale-95"
          aria-label={t.delete}
        >
          {t.delete}
        </button>
      </label>
    </li>
  );
}
