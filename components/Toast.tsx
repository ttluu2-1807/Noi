"use client";

import { useEffect, useState } from "react";

interface ToastProps {
  /** Message body. */
  message: string;
  /** Label for the action button (e.g. "Undo"). Omit for info-only. */
  actionLabel?: string;
  /** Called when the action button is tapped. */
  onAction?: () => void;
  /** Called when the toast auto-dismisses. */
  onDismiss?: () => void;
  /** Auto-dismiss after this many ms. Default 8000. */
  durationMs?: number;
}

/**
 * Small toast for undo-style affordances. Floats at the bottom of the
 * viewport, animates up on mount, fades out either when the action is
 * tapped or after `durationMs` elapses.
 *
 * Used by the soft-delete affordance: deleting a thread or to-do
 * triggers an optimistic UI update + this toast — tap "Undo" within
 * the window to restore. Otherwise the delete sticks (and the row
 * sits in the trash for 30 days).
 *
 * Stateless aside from the auto-dismiss timer — caller owns the
 * mounting decision (typically a useState<{key, message, onAction} | null>).
 */
export function Toast({
  message,
  actionLabel,
  onAction,
  onDismiss,
  durationMs = 8000,
}: ToastProps) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLeaving(true);
      // Wait for the leave animation before letting the parent unmount.
      setTimeout(() => onDismiss?.(), 200);
    }, durationMs);
    return () => clearTimeout(timer);
  }, [durationMs, onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed left-1/2 -translate-x-1/2 bottom-6 z-50 ${
        leaving ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"
      } transition-all duration-200`}
    >
      <div className="flex items-center gap-3 rounded-full bg-ink text-white px-4 py-3 shadow-lg max-w-sm">
        <span className="text-sm">{message}</span>
        {actionLabel && (
          <button
            type="button"
            onClick={() => {
              onAction?.();
              setLeaving(true);
              setTimeout(() => onDismiss?.(), 200);
            }}
            className="text-sm font-medium text-accent hover:opacity-80 transition-opacity active:scale-95"
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}
