"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Toast } from "./Toast";
import {
  softDeleteThread,
  restoreThread,
} from "@/app/(app)/child/thread/[id]/actions";
import type { Language } from "@/lib/language-detect";

interface ThreadActionsMenuProps {
  threadId: string;
  language: Language;
  /** What to call this thing in the menu label — usually "thread". */
  threadTitle?: string;
}

const T = {
  vi: {
    open: "Tuỳ chọn",
    delete: "Xoá",
    deleted: "Đã xoá",
    undo: "Hoàn tác",
  },
  en: {
    open: "Options",
    delete: "Delete",
    deleted: "Deleted",
    undo: "Undo",
  },
} as const;

/**
 * Three-dot menu rendered in the corner of a ThreadCard. Tapping the
 * button opens a small dropdown with a Delete option (only one item
 * for now; more can join later). Stops Link navigation on click via
 * preventDefault.
 *
 * Delete flow:
 *   1. Optimistically remove the card by calling onAfterDelete? No —
 *      we revalidate the dashboard route after the server action, so
 *      the card disappears on the next render.
 *   2. Show an undo Toast for ~8 seconds.
 *   3. Tap Undo → restoreThread → toast dismisses early, card returns
 *      on the next refresh.
 *
 * The toast is rendered by this component (fixed positioning so its
 * place in the DOM tree doesn't matter), so each menu owns its own
 * lifecycle.
 */
export function ThreadActionsMenu({
  threadId,
  language,
  threadTitle,
}: ThreadActionsMenuProps) {
  const t = T[language];
  const [open, setOpen] = useState(false);
  const [toastKey, setToastKey] = useState(0);
  const [showToast, setShowToast] = useState(false);
  const [, startTransition] = useTransition();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape, same pattern as HeaderMenu.
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

  const onDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(false);
    startTransition(async () => {
      await softDeleteThread(threadId);
      setToastKey((k) => k + 1);
      setShowToast(true);
    });
  };

  const onUndo = () => {
    startTransition(async () => {
      await restoreThread(threadId);
      setShowToast(false);
    });
  };

  return (
    <>
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
            // Don't let bubbling clicks trigger the Link beneath.
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <button
            type="button"
            onClick={onDelete}
            className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-bg active:bg-line transition-colors"
          >
            {t.delete}
          </button>
        </div>
      )}

      {showToast && (
        <Toast
          key={toastKey}
          message={
            threadTitle ? `${t.deleted}: ${threadTitle}` : t.deleted
          }
          actionLabel={t.undo}
          onAction={onUndo}
          onDismiss={() => setShowToast(false)}
        />
      )}
    </>
  );
}
