"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { MarkdownContent } from "@/components/MarkdownContent";
import { splitAnswerAnatomy } from "@/lib/answer-anatomy";
import { addTodo } from "@/app/(app)/todos/actions";
import type { Language } from "@/lib/language-detect";

interface AnswerContentProps {
  /** Raw markdown from Claude — the whole answer, including the
   *  "### Add to your list" section if the model produced one. */
  children: string;
  language: Language;
}

const T = {
  vi: {
    addHeading: "Thêm vào danh sách",
    addOne: "Thêm",
    added: "Đã thêm",
    adding: "Đang thêm...",
    addFailed: "Không thêm được — thử lại?",
  },
  en: {
    addHeading: "Add to your list",
    addOne: "Add",
    added: "Added",
    adding: "Adding…",
    addFailed: "Couldn't add — try again?",
  },
} as const;

/**
 * Renderer for an assistant answer that follows the audit's "Answer
 * anatomy": summary line, numbered steps, callout, links, then an
 * optional "### Add to your list" section which we lift out and render
 * as tap-to-add chips beneath the body.
 *
 * The body itself flows through MarkdownContent unchanged — the
 * anatomy is enforced primarily via the system prompt (see
 * lib/system-prompt.ts). The renderer's job here is the chip strip:
 * one tap on a chip inserts the item into family_todos and switches
 * the chip to a "Added" state; can be undone by tapping again is
 * intentionally NOT supported here (the /todos page's undo toast
 * covers the recover path if the user changes their mind).
 */
export function AnswerContent({ children, language }: AnswerContentProps) {
  const t = T[language];
  const { body, suggestedTodos } = useMemo(
    () => splitAnswerAnatomy(children ?? ""),
    [children],
  );

  return (
    <div className="space-y-4">
      <MarkdownContent>{body}</MarkdownContent>
      {suggestedTodos.length > 0 && (
        <SuggestedTodos items={suggestedTodos} t={t} />
      )}
    </div>
  );
}

type ChipState = "idle" | "adding" | "added" | "error";

function SuggestedTodos({
  items,
  t,
}: {
  items: string[];
  t: (typeof T)[Language];
}) {
  return (
    <section className="rounded-card border border-line bg-green-wash/40 p-4 space-y-2.5">
      <h3 className="text-label uppercase tracking-wide text-green-text">
        {t.addHeading}
      </h3>
      <ul className="flex flex-wrap gap-2">
        {items.map((text, i) => (
          <li key={`${i}-${text}`}>
            <AddChip text={text} t={t} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function AddChip({
  text,
  t,
}: {
  text: string;
  t: (typeof T)[Language];
}) {
  const [state, setState] = useState<ChipState>("idle");
  const [pending, startTransition] = useTransition();

  const onAdd = useCallback(() => {
    if (state !== "idle") return;
    setState("adding");
    startTransition(async () => {
      const fd = new FormData();
      fd.set("text", text);
      const result = await addTodo(fd);
      if (result.ok) {
        setState("added");
      } else {
        setState("error");
      }
    });
  }, [state, text]);

  const disabled = state !== "idle" || pending;

  return (
    <button
      type="button"
      onClick={onAdd}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-body-sm transition-colors active:scale-95 disabled:cursor-default disabled:active:scale-100 ${
        state === "added"
          ? "border-green bg-green text-white"
          : state === "error"
            ? "border-danger text-danger bg-surface"
            : "border-green/40 bg-surface text-green-text hover:bg-green-wash"
      }`}
    >
      {state === "adding" ? (
        <>
          <SpinnerDot />
          {t.adding}
        </>
      ) : state === "added" ? (
        <>
          <CheckIcon />
          <span className="line-clamp-1">{text}</span>
        </>
      ) : state === "error" ? (
        <>{t.addFailed}</>
      ) : (
        <>
          <PlusIcon />
          <span className="line-clamp-1">{text}</span>
        </>
      )}
    </button>
  );
}

function SpinnerDot() {
  return <span className="inline-block h-2 w-2 rounded-full bg-current animate-pulse" />;
}
function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-3.5 w-3.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-3.5 w-3.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
    </svg>
  );
}
