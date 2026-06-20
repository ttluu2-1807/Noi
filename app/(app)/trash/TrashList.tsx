"use client";

import { useState, useTransition } from "react";
import { restoreThread } from "@/app/(app)/child/thread/[id]/actions";
import { restoreTodo } from "@/app/(app)/todos/actions";
import { relativeTime } from "@/lib/relative-time";
import type { Language } from "@/lib/language-detect";

export interface DeletedThread {
  id: string;
  title_vi: string | null;
  title_en: string | null;
  deleted_at: string;
}

export interface DeletedTodo {
  id: string;
  text_vi: string;
  text_en: string;
  deleted_at: string;
}

interface TrashListProps {
  threads: DeletedThread[];
  todos: DeletedTodo[];
  language: Language;
}

const T = {
  vi: {
    threads: "Câu hỏi đã xoá",
    todos: "Việc đã xoá",
    empty: "Thùng rác trống.",
    restore: "Khôi phục",
    deletedAt: "Đã xoá",
  },
  en: {
    threads: "Deleted threads",
    todos: "Deleted to-dos",
    empty: "Nothing in the trash.",
    restore: "Restore",
    deletedAt: "Deleted",
  },
} as const;

/**
 * Client list for soft-deleted threads + todos. Each row has a Restore
 * button that calls the matching server action and removes the row
 * from local state optimistically.
 */
export function TrashList({ threads, todos, language }: TrashListProps) {
  const t = T[language];
  const [localThreads, setLocalThreads] = useState(threads);
  const [localTodos, setLocalTodos] = useState(todos);
  const [, startTransition] = useTransition();

  const total = localThreads.length + localTodos.length;
  if (total === 0) {
    return (
      <section className="rounded-card border border-line bg-white p-8 text-center">
        <p className="text-sm text-muted">{t.empty}</p>
      </section>
    );
  }

  const onRestoreThread = (id: string) => {
    setLocalThreads((prev) => prev.filter((r) => r.id !== id));
    startTransition(async () => {
      await restoreThread(id);
    });
  };

  const onRestoreTodo = (id: string) => {
    setLocalTodos((prev) => prev.filter((r) => r.id !== id));
    startTransition(async () => {
      await restoreTodo(id);
    });
  };

  return (
    <div className="space-y-8">
      {localThreads.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm text-muted uppercase tracking-wide">
            {t.threads} ({localThreads.length})
          </h2>
          <ul className="space-y-2">
            {localThreads.map((row) => {
              const title =
                (language === "vi" ? row.title_vi : row.title_en) ??
                row.title_vi ??
                row.title_en ??
                "—";
              return (
                <li
                  key={row.id}
                  className="flex items-start justify-between gap-3 rounded-card border border-line bg-white p-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink truncate">{title}</p>
                    <p className="text-xs text-muted/80 mt-1">
                      {t.deletedAt} {relativeTime(row.deleted_at, language)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRestoreThread(row.id)}
                    className="shrink-0 rounded-card border border-line bg-white px-3 py-1.5 text-xs text-ink hover:border-accent/40 transition-transform active:scale-95"
                  >
                    {t.restore}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {localTodos.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm text-muted uppercase tracking-wide">
            {t.todos} ({localTodos.length})
          </h2>
          <ul className="space-y-2">
            {localTodos.map((row) => {
              const text = language === "vi" ? row.text_vi : row.text_en;
              return (
                <li
                  key={row.id}
                  className="flex items-start justify-between gap-3 rounded-card border border-line bg-white p-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-ink truncate">{text}</p>
                    <p className="text-xs text-muted/80 mt-1">
                      {t.deletedAt} {relativeTime(row.deleted_at, language)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRestoreTodo(row.id)}
                    className="shrink-0 rounded-card border border-line bg-white px-3 py-1.5 text-xs text-ink hover:border-accent/40 transition-transform active:scale-95"
                  >
                    {t.restore}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
