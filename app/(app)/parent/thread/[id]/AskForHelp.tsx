"use client";

import { useState, useTransition } from "react";
import { escalateThread, resolveEscalation } from "./escalate-actions";
import type { Language } from "@/lib/language-detect";

interface AskForHelpProps {
  threadId: string;
  language: Language;
  /** ISO timestamp if already escalated; null otherwise. */
  escalatedAt: string | null;
  /** Note passed with the escalation, if any. */
  escalationNote: string | null;
}

const T = {
  vi: {
    ask: "Con ơi, mẹ/ba cần giúp",
    active: "Đang chờ con giúp",
    modalTitle: "Nhắn cho các con",
    modalHint:
      "Con sẽ nhận thông báo với câu hỏi này, ảnh đã chụp, và những gì Noi đã trả lời. Có thể thêm chú thích ngắn (không bắt buộc).",
    placeholder: "Ví dụ: Bước 3 con giải thích giúp mẹ.",
    send: "Gửi",
    sending: "Đang gửi...",
    cancel: "Huỷ",
    cancelEscalation: "Bỏ yêu cầu",
    cancelling: "Đang bỏ...",
    error: "Có lỗi xảy ra. Vui lòng thử lại.",
  },
  en: {
    ask: "Ask my child for help",
    active: "Waiting for help",
    modalTitle: "Message the family",
    modalHint:
      "They'll get a push with the question, any photo, and what Noi has answered so far. Add a short note (optional).",
    placeholder: "e.g. Can you explain step 3?",
    send: "Send",
    sending: "Sending…",
    cancel: "Cancel",
    cancelEscalation: "Cancel request",
    cancelling: "Cancelling…",
    error: "Something went wrong. Please try again.",
  },
} as const;

/**
 * "I need help with this" affordance on a parent thread page.
 *
 * Two states surfaced:
 *   idle       — a compact clay-tinted button in the thread header
 *   escalated  — an inline card showing the request is waiting + a
 *                cancel link if the parent changes their mind
 *
 * Escalating fires a push to every child in the family (via the
 * escalate-actions server action). Payload includes the parent's
 * name, the thread title, and the optional note. The push deep-links
 * to /child/thread/{id} so the child lands on the full context.
 */
export function AskForHelp({
  threadId,
  language,
  escalatedAt,
  escalationNote,
}: AskForHelpProps) {
  const t = T[language];
  const [modalOpen, setModalOpen] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const isEscalated = !!escalatedAt;

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const result = await escalateThread({
        threadId,
        note: note.trim() || null,
      });
      if (!result.ok) {
        setError(result.error || t.error);
        return;
      }
      setModalOpen(false);
      setNote("");
    });
  };

  const cancel = () => {
    setError(null);
    startTransition(async () => {
      const result = await resolveEscalation({ threadId });
      if (!result.ok) setError(result.error || t.error);
    });
  };

  if (isEscalated) {
    return (
      <section className="rounded-card border border-clay/40 bg-clay-wash p-4 space-y-2 animate-fade-rise">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="shrink-0 mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-clay text-white"
          >
            <BellIcon />
          </span>
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="text-label uppercase tracking-wide text-clay-deep">
              {t.active}
            </p>
            {escalationNote && (
              <p className="text-body text-ink italic">
                &ldquo;{escalationNote}&rdquo;
              </p>
            )}
          </div>
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={cancel}
            disabled={pending}
            className="text-body-sm text-clay-deep underline underline-offset-2 hover:opacity-80"
          >
            {pending ? t.cancelling : t.cancelEscalation}
          </button>
        </div>
      </section>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="inline-flex items-center gap-2 rounded-full border border-clay/40 bg-clay-wash px-4 py-2 text-body-sm font-medium text-clay-deep hover:bg-clay-wash/80 active:scale-[0.98] transition-transform"
      >
        <BellIcon />
        {t.ask}
      </button>

      {modalOpen && (
        <div
          className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-ink/40 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget && !pending) setModalOpen(false);
          }}
        >
          <div
            style={{
              paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)",
            }}
            className="w-full sm:max-w-md rounded-t-sheet-top sm:rounded-card bg-surface p-6 pt-6 space-y-4 shadow-2xl animate-fade-rise"
          >
            <div className="space-y-1">
              <h2 className="text-title font-medium text-ink">
                {t.modalTitle}
              </h2>
              <p className="text-body-sm text-ink-3">{t.modalHint}</p>
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder={t.placeholder}
              disabled={pending}
              autoFocus
              className="w-full rounded-card border border-line bg-surface px-4 py-3 text-body focus:border-green focus:outline-none resize-none"
            />
            {error && (
              <p className="text-body-sm text-danger" role="alert">
                {error}
              </p>
            )}
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                disabled={pending}
                className="rounded-card border border-line bg-surface px-4 py-2 text-body-sm text-ink-3 hover:text-ink"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={pending}
                className="btn-primary rounded-card px-4 py-2 text-body-sm"
              >
                {pending ? t.sending : t.send}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14V11a6 6 0 1 0-12 0v3a2 2 0 0 1-.6 1.6L4 17h5m6 0v1a3 3 0 1 1-6 0v-1m6 0H9"
      />
    </svg>
  );
}
