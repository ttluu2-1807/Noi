"use client";

import { useRef, useState, useTransition } from "react";
import { VoiceInput } from "@/components/VoiceInput";
import { LoadingDots } from "@/components/LoadingDots";
import { dictateTodos, addTodo } from "./actions";
import type { Language } from "@/lib/language-detect";

interface TodoComposerProps {
  language: Language;
}

const T = {
  vi: {
    title: "Thêm việc cần làm",
    voiceHint:
      "Nhấn micro và đọc cả danh sách — Noi sẽ tách thành từng việc.",
    or: "Hoặc",
    placeholder: "Gõ một việc cần làm…",
    add: "Thêm",
    processing: "Đang chia thành các việc…",
    added: (n: number) => `Đã thêm ${n} việc.`,
    error: "Có lỗi xảy ra. Quý vị thử lại nhé.",
  },
  en: {
    title: "Add a to-do",
    voiceHint:
      "Tap the mic and read the whole list — Noi will split it into items.",
    or: "Or",
    placeholder: "Type a single task…",
    add: "Add",
    processing: "Splitting into items…",
    added: (n: number) => `Added ${n} ${n === 1 ? "item" : "items"}.`,
    error: "Something went wrong. Please try again.",
  },
} as const;

/**
 * Composer for the family to-do list. Two paths in:
 *   - Voice: tap mic → dictate one or many items → transcript flows
 *     into a textarea for review → "Process" runs Claude to split into
 *     discrete tasks and inserts them all.
 *   - Text: type a single task → "Add" inserts directly (also goes
 *     through Claude for dual-language + date extraction).
 *
 * Both paths surface a small success/error line for confirmation.
 * Realtime in the parent page picks up the new rows automatically.
 */
export function TodoComposer({ language }: TodoComposerProps) {
  const t = T[language];
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<
    | { ok: true; message: string }
    | { ok: false; message: string }
    | null
  >(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const onDictate = () => {
    if (!text.trim()) return;
    const transcript = text;
    setFeedback(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("transcript", transcript);
      const r = await dictateTodos(fd);
      if (r.ok) {
        setFeedback({ ok: true, message: t.added(r.count) });
        setText("");
      } else {
        setFeedback({ ok: false, message: r.error || t.error });
      }
    });
  };

  const onSingleAdd = () => {
    if (!text.trim()) return;
    const single = text;
    setFeedback(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("text", single);
      const r = await addTodo(fd);
      if (r.ok) {
        setFeedback({ ok: true, message: t.added(1) });
        setText("");
      } else {
        setFeedback({ ok: false, message: r.error || t.error });
      }
    });
  };

  return (
    <section className="rounded-card border border-line bg-white p-5 space-y-4">
      <div>
        <h2 className="text-sm uppercase tracking-wide text-muted">
          {t.title}
        </h2>
        <p className="text-xs text-muted/80 mt-1">{t.voiceHint}</p>
      </div>

      <VoiceInput
        language={language}
        onTranscript={(transcript) => {
          setText(transcript);
          textareaRef.current?.focus();
        }}
      />

      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder={t.placeholder}
        disabled={pending}
        className="w-full rounded-card border border-line bg-white px-4 py-3 leading-relaxed focus:border-accent focus:outline-none resize-none"
      />

      <div className="flex flex-wrap items-center justify-end gap-2">
        {pending && <LoadingDots />}
        <button
          type="button"
          onClick={onSingleAdd}
          disabled={pending || !text.trim()}
          className="rounded-card border border-line bg-white px-4 py-2 text-sm text-ink disabled:opacity-40 hover:border-accent/40 transition-transform active:scale-[0.98]"
        >
          {t.add}
        </button>
        <button
          type="button"
          onClick={onDictate}
          disabled={pending || !text.trim()}
          className="rounded-card bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-40 hover:opacity-90 transition-transform active:scale-[0.98]"
        >
          {pending ? t.processing : language === "vi" ? "Chia thành các việc" : "Split into items"}
        </button>
      </div>

      {feedback && (
        <p
          className={`text-sm ${
            feedback.ok ? "text-accent" : "text-red-600"
          }`}
          role={feedback.ok ? "status" : "alert"}
        >
          {feedback.message}
        </p>
      )}
    </section>
  );
}
