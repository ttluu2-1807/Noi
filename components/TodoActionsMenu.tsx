"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Language } from "@/lib/language-detect";

interface TodoActionsMenuProps {
  todoId: string;
  language: Language;
  /** Called when Delete is tapped (parent owns the optimistic UI + undo toast). */
  onDelete: () => void;
}

const T = {
  vi: {
    open: "Tuỳ chọn",
    edit: "Sửa",
    delete: "Xoá",
  },
  en: {
    open: "Options",
    edit: "Edit",
    delete: "Delete",
  },
} as const;

/**
 * Three-dot menu shown on each todo row. Mirrors ThreadActionsMenu's
 * pattern: tap → dropdown with Edit (→ /todos/[id]/edit) + Delete
 * (calls back into parent for soft-delete + undo toast).
 *
 * Replaces the inline "Delete" text button that was previously the only
 * affordance — both edit and delete now hide behind the same menu, with
 * delete styled as destructive.
 */
export function TodoActionsMenu({
  todoId,
  language,
  onDelete,
}: TodoActionsMenuProps) {
  const t = T[language];
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (
        menuRef.current?.contains(e.target as Node) ||
        buttonRef.current?.contains(e.target as Node)
      ) {
        return;
      }
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const onDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(false);
    onDelete();
  };

  return (
    <div className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-label={t.open}
        aria-expanded={open}
        className="flex h-7 w-7 items-center justify-center rounded-full text-muted hover:text-ink hover:bg-line/40 active:scale-90 transition-all"
      >
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          className="h-4 w-4"
          aria-hidden
        >
          <circle cx="5" cy="12" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="19" cy="12" r="1.5" />
        </svg>
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          className="absolute right-0 top-9 z-30 w-36 rounded-card border border-line bg-white shadow-lg overflow-hidden"
          onClick={(e) => {
            // Don't bubble — the <label> wrapping the row would toggle
            // the checkbox otherwise.
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <Link
            href={`/todos/${todoId}/edit`}
            onClick={() => setOpen(false)}
            className="block px-4 py-2.5 text-sm hover:bg-bg transition-colors"
          >
            {t.edit}
          </Link>
          <button
            type="button"
            onClick={onDeleteClick}
            className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-bg transition-colors border-t border-line"
          >
            {t.delete}
          </button>
        </div>
      )}
    </div>
  );
}
