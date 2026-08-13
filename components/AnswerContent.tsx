"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { MarkdownContent } from "@/components/MarkdownContent";
import { CallPrepCard } from "@/components/CallPrepCard";
import { splitAnswerAnatomy, type VocabTerm } from "@/lib/answer-anatomy";
import { detectCallInAnswer } from "@/lib/call-prep";
import { addTodo } from "@/app/(app)/todos/actions";
import type { Language } from "@/lib/language-detect";

interface AnswerContentProps {
  /** Raw markdown from Claude — the whole answer, including the
   *  "### Add to your list" section if the model produced one. */
  children: string;
  language: Language;
  /** When set, "Add to your list" chips write with source_thread_id set
   *  so the resulting todo groups under this thread on /todos. Null on
   *  the initial home-screen stream where no thread exists yet. */
  threadId?: string | null;
}

const T = {
  vi: {
    addHeading: "Thêm vào danh sách",
    addOne: "Thêm",
    added: "Đã thêm",
    adding: "Đang thêm...",
    addFailed: "Không thêm được — thử lại?",
    vocabHeading: "Từ cần biết",
  },
  en: {
    addHeading: "Add to your list",
    addOne: "Add",
    added: "Added",
    adding: "Adding…",
    addFailed: "Couldn't add — try again?",
    vocabHeading: "Words to know",
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
export function AnswerContent({ children, language, threadId }: AnswerContentProps) {
  const t = T[language];
  const { body, suggestedTodos, vocab } = useMemo(
    () => splitAnswerAnatomy(children ?? ""),
    [children],
  );
  // Auto-surface a "Prepare to call" affordance whenever the answer
  // recommends an Australian institution phone number. Only when we
  // have a threadId — the home-screen initial stream doesn't yet have
  // one to attach the plan to.
  const detectedCall = useMemo(
    () => (threadId ? detectCallInAnswer(body) : null),
    [threadId, body],
  );

  return (
    <div className="space-y-4">
      <MarkdownContent>{body}</MarkdownContent>
      {suggestedTodos.length > 0 && (
        <SuggestedTodos items={suggestedTodos} t={t} threadId={threadId ?? null} />
      )}
      {vocab.length > 0 && <VocabPanel items={vocab} heading={t.vocabHeading} />}
      {detectedCall && threadId && (
        <CallPrepCard
          threadId={threadId}
          service={detectedCall.service}
          phone={detectedCall.phone}
          language={language}
        />
      )}
    </div>
  );
}

type ChipState = "idle" | "adding" | "added" | "error";

function SuggestedTodos({
  items,
  t,
  threadId,
}: {
  items: string[];
  t: (typeof T)[Language];
  threadId: string | null;
}) {
  return (
    <section className="rounded-card border border-line bg-green-wash/40 p-4 space-y-2.5">
      <h3 className="text-label uppercase tracking-wide text-green-text">
        {t.addHeading}
      </h3>
      <ul className="flex flex-wrap gap-2">
        {items.map((text, i) => (
          <li key={`${i}-${text}`}>
            <AddChip text={text} t={t} threadId={threadId} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function AddChip({
  text,
  t,
  threadId,
}: {
  text: string;
  t: (typeof T)[Language];
  threadId: string | null;
}) {
  const [state, setState] = useState<ChipState>("idle");
  const [pending, startTransition] = useTransition();

  const onAdd = useCallback(() => {
    if (state !== "idle") return;
    setState("adding");
    startTransition(async () => {
      const fd = new FormData();
      fd.set("text", text);
      // Link back to the thread the chip came from, so the todo groups
      // under that thread's header on /todos.
      if (threadId) fd.set("sourceThreadId", threadId);
      const result = await addTodo(fd);
      if (result.ok) {
        setState("added");
      } else {
        setState("error");
      }
    });
  }, [state, text, threadId]);

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

/**
 * Words-to-know panel — Vocabulary Level 1.
 *
 * Rendered beneath every assistant answer that introduces new terms.
 * Deliberately small: no controls, no tap targets, just a
 * side-by-side glossary so vocabulary is always visible in context.
 * Every interaction teaches → dependence drops over time.
 *
 * Level 2 (parked): per-user tracking (seen count, first-seen date,
 *   /vocab browse page, home tile with total count).
 * Level 3 (parked): spaced-repetition prompts + practice.
 */
function VocabPanel({
  items,
  heading,
}: {
  items: VocabTerm[];
  heading: string;
}) {
  return (
    <section className="rounded-card border border-line bg-paper p-4 space-y-2">
      <h3 className="text-label uppercase tracking-wide text-ink-3">
        {heading}
      </h3>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
        {items.map((term, i) => (
          <div key={`${i}-${term.en}`} className="flex items-baseline gap-2 min-w-0">
            <dt className="text-body font-medium text-ink truncate">
              {term.en}
            </dt>
            <dd className="text-body-sm text-ink-3 truncate">
              {term.vi}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
