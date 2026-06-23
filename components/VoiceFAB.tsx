"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { VoiceWaveform } from "@/components/VoiceWaveform";
import { captureVoiceIntent } from "@/app/(app)/child/voice-capture/actions";
import type { Language } from "@/lib/language-detect";

type FabStage =
  | { kind: "idle" }
  | { kind: "listening" }
  | { kind: "thinking"; transcript: string }
  | { kind: "error"; message: string };

const T = {
  vi: {
    fab: "Nói với Noi",
    hint:
      "Nói bất cứ điều gì — Noi sẽ tự biết tạo việc cần làm, nhật ký, hay câu hỏi.",
    listening: "Đang nghe...",
    thinking: "Đang xử lý...",
    cancel: "Huỷ",
    retry: "Thử lại",
    examplesHeading: "Ví dụ:",
    examples: [
      "Trả thuế đất ngày 15 tháng 8",
      "Sinh nhật Huddy ngày 18 tháng 7",
      "Tại sao tiền điện cao thế?",
    ],
  },
  en: {
    fab: "Talk to Noi",
    hint:
      "Say anything — Noi figures out if it's a to-do, a diary note, or a question.",
    listening: "Listening…",
    thinking: "Working it out…",
    cancel: "Cancel",
    retry: "Try again",
    examplesHeading: "Try saying:",
    examples: [
      "Pay land tax by 15-08-2026",
      "Huddy's birthday dinner 18-07-2026",
      "How do I renew Mum's Medicare card?",
    ],
  },
} as const;

/**
 * Global voice trigger — a floating action button anchored bottom-right
 * of the screen. Tap to start dictating; once you stop, Claude classifies
 * the transcript into one of three intents:
 *
 *   - todo  → inserted into family_todos, redirect to /todos
 *   - diary → inserted into diary_entries, redirect to /diary/{id}
 *   - thread → bounce to /child/new-task with prefilled text
 *
 * Lives only on /child (the helper's home). The parent's home stays as
 * the single-question "New question" flow on /parent — they don't need
 * intent classification because their input is always a question for
 * Noi to answer.
 */
export function VoiceFAB({ language = "en" }: { language?: Language }) {
  const router = useRouter();
  const t = T[language];
  const [stage, setStage] = useState<FabStage>({ kind: "idle" });
  const [pending, startTransition] = useTransition();

  const onTranscript = useCallback((transcript: string) => {
    const trimmed = transcript.trim();
    if (!trimmed) {
      setStage({
        kind: "error",
        message:
          language === "vi"
            ? "Không nghe được — vui lòng thử lại."
            : "Didn't catch that — please try again.",
      });
      return;
    }
    setStage({ kind: "thinking", transcript: trimmed });
    startTransition(async () => {
      const result = await captureVoiceIntent(trimmed);
      if (result.ok) {
        // Close the overlay then navigate — feels snappier than holding
        // the overlay open while the route transition runs.
        setStage({ kind: "idle" });
        router.push(result.redirect);
      } else {
        setStage({ kind: "error", message: result.error });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, router]);

  const { isSupported, isListening, transcript, error, start, stop } =
    useVoiceInput({ language, onTranscript });

  // Open the overlay AND start the mic in one action so the user
  // doesn't have to tap twice.
  const onOpen = () => {
    if (!isSupported) return;
    setStage({ kind: "listening" });
    start();
  };

  const onCancel = () => {
    if (isListening) stop();
    setStage({ kind: "idle" });
  };

  // Translate hook-level errors into the overlay's error stage.
  useEffect(() => {
    if (error && stage.kind === "listening") {
      setStage({ kind: "error", message: error });
    }
  }, [error, stage.kind]);

  // ESC closes the overlay without committing.
  useEffect(() => {
    if (stage.kind === "idle") return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage.kind, isListening]);

  if (!isSupported) return null;

  return (
    <>
      {/* Floating action button — same teal accent as primary CTAs. */}
      <button
        type="button"
        onClick={onOpen}
        aria-label={t.fab}
        className="fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-lg shadow-accent/30 hover:opacity-90 active:scale-95 transition-transform"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          className="h-6 w-6"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"
          />
        </svg>
      </button>

      {stage.kind !== "idle" && (
        <div
          className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-ink/40 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) onCancel();
          }}
        >
          <div className="w-full sm:max-w-md rounded-t-card sm:rounded-card bg-white p-6 space-y-5 shadow-2xl animate-fade-rise">
            {stage.kind === "listening" && (
              <>
                <div className="text-center space-y-1">
                  <div className="text-sm text-muted">{t.listening}</div>
                  <p className="text-xs text-muted/70">{t.hint}</p>
                </div>
                <div className="flex flex-col items-center gap-4">
                  <button
                    type="button"
                    onClick={() => stop()}
                    aria-label={t.cancel}
                    className="relative flex h-20 w-20 items-center justify-center rounded-full bg-accent text-white shadow-lg active:scale-95 transition-transform"
                  >
                    <span className="absolute inset-0 rounded-full bg-accent/40 animate-ping" />
                    <svg
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="h-8 w-8 relative"
                    >
                      <rect x="6" y="6" width="12" height="12" rx="2" />
                    </svg>
                  </button>
                  <VoiceWaveform active />
                </div>
                {transcript && (
                  <p className="text-sm text-ink/80 leading-relaxed text-center px-2">
                    {transcript}
                  </p>
                )}
                {!transcript && (
                  <div className="space-y-2 text-xs text-muted/80">
                    <div className="font-medium">{t.examplesHeading}</div>
                    <ul className="space-y-1 list-disc list-inside">
                      {t.examples.map((ex) => (
                        <li key={ex}>{ex}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}

            {stage.kind === "thinking" && (
              <div className="space-y-4 text-center">
                <div className="text-sm text-muted">{t.thinking}</div>
                <p className="text-sm text-ink/80 leading-relaxed">
                  {stage.transcript}
                </p>
                <div className="flex justify-center">
                  <div className="h-2 w-2 rounded-full bg-accent animate-bounce" />
                </div>
              </div>
            )}

            {stage.kind === "error" && (
              <div className="space-y-4 text-center">
                <p className="text-sm text-red-600">{stage.message}</p>
                <div className="flex justify-center gap-3">
                  <button
                    type="button"
                    onClick={onCancel}
                    className="rounded-card border border-line bg-white px-4 py-2 text-sm hover:border-accent/40"
                    disabled={pending}
                  >
                    {t.cancel}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStage({ kind: "listening" });
                      start();
                    }}
                    className="rounded-card bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                    disabled={pending}
                  >
                    {t.retry}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
