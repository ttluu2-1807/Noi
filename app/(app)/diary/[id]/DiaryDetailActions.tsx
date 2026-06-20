"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Toast } from "@/components/Toast";
import { softDeleteDiaryEntry, restoreDiaryEntry } from "../actions";
import type { Language } from "@/lib/language-detect";

const T = {
  vi: {
    options: "Tuỳ chọn",
    edit: "Sửa",
    delete: "Xoá",
    deleted: "Đã xoá",
    undo: "Hoàn tác",
  },
  en: {
    options: "Options",
    edit: "Edit",
    delete: "Delete",
    deleted: "Deleted",
    undo: "Undo",
  },
} as const;

/**
 * Three-dot menu in the corner of a diary detail view.
 * Mirrors ThreadActionsMenu but slightly simpler — only Delete needed
 * here since the dedicated edit route handles edits.
 */
export function DiaryDetailActions({
  id,
  language,
}: {
  id: string;
  language: Language;
}) {
  const t = T[language];
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastKey, setToastKey] = useState(0);
  const [, startTransition] = useTransition();
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

  const onDelete = () => {
    setOpen(false);
    startTransition(async () => {
      await softDeleteDiaryEntry(id);
      // Navigate back to the timeline; the toast carries the undo.
      router.push("/diary");
      setToastKey((k) => k + 1);
      setShowToast(true);
    });
  };

  const onUndo = () => {
    startTransition(async () => {
      await restoreDiaryEntry(id);
      setShowToast(false);
      router.push(`/diary/${id}`);
    });
  };

  return (
    <div className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t.options}
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center rounded-full text-muted hover:text-ink hover:bg-line/40 active:scale-90 transition-all"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden>
          <circle cx="5" cy="12" r="1.6" />
          <circle cx="12" cy="12" r="1.6" />
          <circle cx="19" cy="12" r="1.6" />
        </svg>
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          className="absolute right-0 top-10 z-30 w-36 rounded-card border border-line bg-white shadow-lg overflow-hidden"
        >
          <Link
            href={`/diary/${id}/edit`}
            onClick={() => setOpen(false)}
            className="block px-4 py-2.5 text-sm hover:bg-bg transition-colors"
          >
            {t.edit}
          </Link>
          <button
            type="button"
            onClick={onDelete}
            className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-bg transition-colors border-t border-line"
          >
            {t.delete}
          </button>
        </div>
      )}

      {showToast && (
        <Toast
          key={toastKey}
          message={t.deleted}
          actionLabel={t.undo}
          onAction={onUndo}
          onDismiss={() => setShowToast(false)}
        />
      )}
    </div>
  );
}
