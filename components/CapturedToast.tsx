"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { moveCaptured } from "@/app/(app)/child/voice-capture/actions";
import type { Language } from "@/lib/language-detect";

type CapturedKind = "todo" | "diary";
type TargetKind = "todo" | "diary" | "thread";

interface CapturedToastProps {
  /** Only render on the home surface that matches — todo toast on
   *  /todos, diary toast on the diary detail page. Prevents cross-
   *  page bleed when query params leak (they shouldn't, but defensive). */
  expected: CapturedKind;
  /** Language for the toast copy. */
  language: Language;
}

const T = {
  vi: {
    addedTodo: "Đã thêm vào danh sách việc.",
    addedDiary: "Đã thêm vào nhật ký.",
    wrong: "Sai chỗ?",
    moveTodo: "Chuyển sang Việc",
    moveDiary: "Chuyển sang Nhật ký",
    moveThread: "Chuyển sang Hỏi Noi",
    moving: "Đang chuyển...",
    dismiss: "Đóng",
  },
  en: {
    addedTodo: "Added to your to-do list.",
    addedDiary: "Added to your diary.",
    wrong: "Wrong home?",
    moveTodo: "Move to To-dos",
    moveDiary: "Move to Diary",
    moveThread: "Ask Noi instead",
    moving: "Moving…",
    dismiss: "Dismiss",
  },
} as const;

/**
 * Recovery affordance for the voice FAB / global capture flow.
 *
 * When captureVoiceIntent classifies a transcript into todo/diary and
 * redirects to that surface with `?captured=<kind>&id=<uuid>&text=…`,
 * this toast pops on the destination with two move buttons pointing at
 * the OTHER kinds. Tapping one soft-deletes the source row and lands
 * the user on the new destination (composer prefilled for diary/thread,
 * or an inserted todo row for the todo case).
 *
 * The toast auto-dismisses after 15s. Once the user takes any action
 * (dismiss or move), we strip the captured params from the URL so
 * back/forward or a refresh doesn't re-trigger the same toast.
 */
export function CapturedToast({ expected, language }: CapturedToastProps) {
  const t = T[language];
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [dismissed, setDismissed] = useState(false);

  const captured = searchParams.get("captured") as CapturedKind | null;
  const id = searchParams.get("id");
  const text = searchParams.get("text");

  const isMatch = captured === expected && !!id && !!text;

  // Auto-dismiss after 15s of no interaction.
  useEffect(() => {
    if (!isMatch || dismissed) return;
    const timer = setTimeout(() => {
      dismiss();
    }, 15000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMatch, dismissed]);

  const dismiss = () => {
    setDismissed(true);
    // Strip the captured params from the URL so the toast doesn't
    // re-appear on refresh / back-forward.
    const next = new URLSearchParams(searchParams.toString());
    next.delete("captured");
    next.delete("id");
    next.delete("text");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const move = (to: TargetKind) => {
    if (!id || !text || !captured) return;
    startTransition(async () => {
      const result = await moveCaptured({ from: captured, id, to, text });
      if (result.ok) {
        router.push(result.redirect);
      } else {
        // Show error inline. Rare — most failures are RLS-scoped no-ops.
        // For now we just fall back to dismissing so the user isn't stuck.
        console.error("[CapturedToast] moveCaptured failed:", result.error);
        dismiss();
      }
    });
  };

  const heading = useMemo(() => {
    if (captured === "todo") return t.addedTodo;
    if (captured === "diary") return t.addedDiary;
    return "";
  }, [captured, t]);

  if (!isMatch || dismissed) return null;

  const otherTargets: TargetKind[] =
    captured === "todo" ? ["diary", "thread"] : ["todo", "thread"];

  return (
    <div
      role="status"
      aria-live="polite"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 24px)" }}
      className="fixed left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4"
    >
      <div className="rounded-card bg-ink text-white shadow-lg p-4 space-y-3 animate-fade-rise">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 shrink-0 inline-flex h-6 w-6 items-center justify-center rounded-full bg-green">
            <CheckIcon />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-body-sm font-medium">{heading}</p>
            <p className="text-body-sm text-white/70 line-clamp-2">{text}</p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label={t.dismiss}
            className="shrink-0 text-white/60 hover:text-white transition-colors"
          >
            <XIcon />
          </button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-body-sm text-white/70">{t.wrong}</span>
          {otherTargets.map((to) => (
            <button
              key={to}
              type="button"
              onClick={() => move(to)}
              disabled={pending}
              className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-body-sm hover:bg-white/20 transition-colors disabled:opacity-60"
            >
              {pending
                ? t.moving
                : to === "todo"
                  ? t.moveTodo
                  : to === "diary"
                    ? t.moveDiary
                    : t.moveThread}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className="h-3.5 w-3.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
