"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoadingDots } from "@/components/LoadingDots";
import { updateTodo } from "../../actions";
import type { Language } from "@/lib/language-detect";

interface TodoEditFormProps {
  id: string;
  initialText: string;
  initialDueAt: string | null;
  language: Language;
}

const T = {
  vi: {
    text: "Nội dung",
    due: "Hạn (không bắt buộc)",
    save: "Lưu",
    saving: "Đang lưu…",
    cancel: "Huỷ",
    empty: "Vui lòng nhập nội dung.",
  },
  en: {
    text: "Text",
    due: "Due date (optional)",
    save: "Save",
    saving: "Saving…",
    cancel: "Cancel",
    empty: "Please enter the task text.",
  },
} as const;

/**
 * Form for editing an existing todo's text + due date. Text edits flow
 * through Claude (via updateTodo → extractTodos) so the other-language
 * column is regenerated. Date is replaced as-is — caller can clear it
 * by submitting with the date field empty.
 *
 * Inline edit was rejected for elderly UX — a focused full-screen edit
 * matches the diary edit pattern and is easier to use on phones.
 */
export function TodoEditForm({
  id,
  initialText,
  initialDueAt,
  language,
}: TodoEditFormProps) {
  const t = T[language];
  const router = useRouter();
  const [text, setText] = useState(initialText);
  // ISO date → yyyy-mm-dd for the <input type="date">; null → empty.
  const [dueAt, setDueAt] = useState(
    initialDueAt ? initialDueAt.slice(0, 10) : "",
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onSave = () => {
    if (!text.trim()) {
      setError(t.empty);
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await updateTodo({
        id,
        text: text.trim(),
        due_at: dueAt ? new Date(dueAt).toISOString() : null,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push("/todos");
    });
  };

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <label className="block text-sm text-muted">{t.text}</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          disabled={pending}
          className="w-full rounded-card border border-line bg-white px-4 py-3 leading-relaxed focus:border-accent focus:outline-none resize-none"
        />
      </section>

      <section className="space-y-2">
        <label className="block text-sm text-muted">{t.due}</label>
        <input
          type="date"
          value={dueAt}
          onChange={(e) => setDueAt(e.target.value)}
          disabled={pending}
          className="rounded-card border border-line bg-white px-4 py-2 focus:border-accent focus:outline-none"
        />
      </section>

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          disabled={pending}
          className="text-sm text-muted hover:text-ink transition-colors"
        >
          {t.cancel}
        </button>
        <div className="flex items-center gap-3">
          {pending && <LoadingDots />}
          <button
            type="button"
            onClick={onSave}
            disabled={pending || !text.trim()}
            className="rounded-card bg-accent px-5 py-3 font-medium text-white disabled:opacity-40 hover:opacity-90 transition-transform active:scale-[0.98]"
          >
            {pending ? t.saving : t.save}
          </button>
        </div>
      </div>
    </div>
  );
}
