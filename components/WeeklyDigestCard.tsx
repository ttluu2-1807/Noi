"use client";

import { useRef, useState, useTransition } from "react";
import { playWeeklyDigest } from "@/app/(app)/digest/actions";
import type { Language } from "@/lib/language-detect";

const T = {
  vi: {
    heading: "Tóm tắt tuần này",
    subtitle: "Nghe tóm tắt ngắn về tuần của gia đình.",
    listen: "Nghe tóm tắt",
    generating: "Đang chuẩn bị tóm tắt...",
    loading: "Đang tải...",
    pause: "Tạm dừng",
    play: "Phát lại",
    notEnough: "Chưa có đủ thông tin tuần này.",
    error: "Có lỗi xảy ra. Vui lòng thử lại.",
  },
  en: {
    heading: "Your week, in a minute",
    subtitle: "Listen to a short summary of what's on for the family.",
    listen: "Listen",
    generating: "Writing your digest…",
    loading: "Loading audio…",
    pause: "Pause",
    play: "Play again",
    notEnough: "Not enough activity yet this week.",
    error: "Something went wrong. Please try again.",
  },
} as const;

type Phase =
  | { kind: "idle" }
  | { kind: "generating" } // Claude is writing the script (first tap)
  | { kind: "loading" }    // audio URL fetched, <audio> is buffering
  | { kind: "playing" }
  | { kind: "paused" }
  | { kind: "error"; message: string };

/**
 * Home-screen card that plays a ~120-word ElevenLabs narration of the
 * family's last 7 days. First tap of the week is slower (Claude writes
 * the script + TTS synthesis + Storage upload — ~5s); subsequent taps
 * pull a cached signed URL (~100ms).
 *
 * The card lives above the existing InsightsRow on both dashboards.
 * It complements the highlights row rather than replacing it — quick
 * glance at concrete numbers + deeper narrated context. The card is
 * always rendered; if there isn't enough data this week, the play
 * action returns a friendly "not enough yet" message which we surface.
 */
export function WeeklyDigestCard({ language }: { language: Language }) {
  const t = T[language];
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [script, setScript] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const isBusy = pending || phase.kind === "generating" || phase.kind === "loading";

  const onPlay = () => {
    // If audio is already loaded, resume.
    if (audioRef.current && (phase.kind === "paused" || phase.kind === "playing")) {
      if (phase.kind === "playing") {
        audioRef.current.pause();
        setPhase({ kind: "paused" });
      } else {
        audioRef.current.play();
        setPhase({ kind: "playing" });
      }
      return;
    }

    setPhase({ kind: "generating" });
    startTransition(async () => {
      const result = await playWeeklyDigest(language);
      if (!result.ok) {
        setPhase({ kind: "error", message: result.error });
        return;
      }
      setScript(result.script);
      setPhase({ kind: "loading" });

      // Hand the URL to <audio> via a new element each time so the
      // src swap is clean (no stale state from a previous week).
      const el = new Audio(result.signedUrl);
      audioRef.current = el;
      el.onplaying = () => setPhase({ kind: "playing" });
      el.onpause = () => {
        // Distinguish a user-initiated pause from the natural end:
        // the ended event fires AFTER pause when the file finishes.
        if (!el.ended) setPhase({ kind: "paused" });
      };
      el.onended = () => setPhase({ kind: "paused" });
      el.onerror = () => setPhase({ kind: "error", message: t.error });
      el.play().catch(() => setPhase({ kind: "error", message: t.error }));
    });
  };

  const buttonLabel = () => {
    switch (phase.kind) {
      case "generating":
        return t.generating;
      case "loading":
        return t.loading;
      case "playing":
        return t.pause;
      case "paused":
        return t.play;
      default:
        return t.listen;
    }
  };

  const isPlayingOrLoading =
    phase.kind === "playing" ||
    phase.kind === "loading" ||
    phase.kind === "generating";

  return (
    <section className="rounded-card border border-line bg-gradient-to-br from-accent/5 to-white p-5 space-y-3 animate-fade-rise">
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5 h-10 w-10 rounded-full bg-accent/10 flex items-center justify-center">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            className="h-5 w-5 text-accent"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zm12-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"
            />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-medium text-ink">{t.heading}</h2>
          <p className="text-sm text-muted mt-0.5">{t.subtitle}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onPlay}
          disabled={isBusy}
          className="inline-flex items-center gap-2 rounded-card bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 transition-transform active:scale-[0.98]"
        >
          {isPlayingOrLoading ? (
            <span className="inline-block h-2 w-2 rounded-full bg-white animate-pulse" />
          ) : (
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-3.5 w-3.5"
            >
              <path d="M6 4l14 8L6 20V4z" />
            </svg>
          )}
          <span>{buttonLabel()}</span>
        </button>
      </div>

      {phase.kind === "error" && (
        <p className="text-sm text-red-600">{phase.message}</p>
      )}

      {script && phase.kind !== "error" && (
        <details className="text-sm text-muted/80 group">
          <summary className="cursor-pointer hover:text-ink transition-colors list-none flex items-center gap-1">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className="h-3 w-3 transition-transform group-open:rotate-90"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            {language === "vi" ? "Đọc bản chữ" : "Read transcript"}
          </summary>
          <p className="mt-2 leading-relaxed whitespace-pre-wrap">{script}</p>
        </details>
      )}
    </section>
  );
}
