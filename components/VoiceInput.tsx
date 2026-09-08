"use client";

import { useEffect, useState } from "react";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { VoiceWaveform } from "@/components/VoiceWaveform";
import type { Language } from "@/lib/language-detect";

interface VoiceInputProps {
  language: Language;
  /**
   * Called when the user has finished speaking — either auto-finalised
   * after silence, or because they tapped the mic again to stop.
   * Receives the full transcript. The caller typically populates a
   * textarea so the user can review/edit before pressing Send.
   *
   * Speech recognition for Vietnamese is unreliable across browsers
   * (often emits no "final" results), so DO NOT auto-submit on the
   * caller side — let the user confirm.
   */
  onTranscript: (transcript: string) => void;
  /** Hint text shown while listening if no transcript has appeared yet. */
  placeholder?: string;
  disabled?: boolean;
}

/**
 * Big circular mic button. While listening: a pulsing ring animates
 * around it and the live transcript is shown below. Tap once to start;
 * tap again to stop and deliver the transcript. Hides itself silently
 * if the browser doesn't support SpeechRecognition.
 */
export function VoiceInput({
  language,
  onTranscript,
  placeholder,
  disabled,
}: VoiceInputProps) {
  const { isSupported, isListening, transcript, error, start, stop } = useVoiceInput({
    language,
    onTranscript,
  });

  // Show "preparing" state briefly after tap so the user sees feedback
  // before the mic actually engages.
  const [preparing, setPreparing] = useState(false);
  useEffect(() => {
    if (isListening) setPreparing(false);
  }, [isListening]);

  if (!isSupported) return null;

  const active = isListening || preparing;

  return (
    <div className="flex flex-col items-center gap-4">
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (isListening) {
            stop();
          } else {
            setPreparing(true);
            start();
          }
        }}
        aria-label={isListening ? "Stop recording" : "Start recording"}
        className={`relative h-28 w-28 rounded-full transition-colors shadow-lg focus:outline-none disabled:opacity-40 ${
          active
            ? "bg-accent text-white"
            : "bg-white text-accent hover:bg-accent/5 border border-line"
        }`}
      >
        {active && (
          <>
            <span
              aria-hidden
              className="absolute inset-0 rounded-full bg-accent/30 animate-pulse-ring"
            />
            <span
              aria-hidden
              className="absolute inset-0 rounded-full bg-accent/20 animate-pulse-ring [animation-delay:0.4s]"
            />
          </>
        )}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          className="relative mx-auto h-10 w-10"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3m0 0h3m-3 0h-3m0-19.5a3 3 0 013 3v5.25a3 3 0 01-6 0V6a3 3 0 013-3z"
          />
        </svg>
      </button>

      {/* Live waveform under the mic — reassures the user that the mic
          is actually engaged. Synthetic but alive. */}
      <VoiceWaveform active={active} />

      <div className="min-h-[3rem] max-w-md text-center text-muted">
        {transcript ? (
          <p className="text-ink">{transcript}</p>
        ) : active ? (
          <p>{placeholder ?? (language === "vi" ? "Đang nghe..." : "Listening...")}</p>
        ) : (
          <p className="text-body-sm text-muted/80">
            {language === "vi"
              ? "Nhấn để nói. Nhấn lần nữa để dừng."
              : "Tap to speak. Tap again to stop."}
          </p>
        )}
        {error && (
          <MicErrorMessage error={error} language={language} />
        )}
      </div>
    </div>
  );
}

/**
 * Turn a raw SpeechRecognition error code ("service-not-allowed",
 * "not-allowed", "network", "audio-capture", "language-not-supported")
 * into human-readable, action-oriented copy in the user's language.
 *
 * Elderly users see "service-not-allowed" and freeze. We tell them
 * exactly what to check + where in Settings, so they can self-recover
 * without asking their child.
 */
function MicErrorMessage({
  error,
  language,
}: {
  error: string;
  language: Language;
}) {
  const copy = friendlyMicError(error, language);
  return (
    <div className="text-body-sm text-danger mt-2 space-y-1 text-left">
      <p className="font-medium">{copy.title}</p>
      {copy.fix && <p className="text-ink-2">{copy.fix}</p>}
    </div>
  );
}

function friendlyMicError(
  raw: string,
  language: Language,
): { title: string; fix: string | null } {
  const T = language === "vi";
  // The code appears either as the raw event.error string ("not-allowed")
  // or as our reset error message; match on substring.
  const e = raw.toLowerCase();

  // Permission denied — most common. iOS Safari has two separate
  // permission surfaces (per-site Safari settings AND Privacy →
  // Microphone at the OS level), so we mention both.
  if (
    e.includes("not-allowed") ||
    e.includes("service-not-allowed") ||
    e.includes("permission")
  ) {
    return {
      title: T
        ? "Noi không truy cập được micro."
        : "Noi can't use the microphone.",
      fix: T
        ? "Vào Cài đặt điện thoại → Safari → Micro → chọn 'Cho phép'. Sau đó tắt và mở lại Noi."
        : "Open iPhone Settings → Safari → Microphone → set to 'Allow'. Then close and reopen Noi.",
    };
  }
  if (e.includes("audio-capture")) {
    return {
      title: T ? "Không nhận được micro." : "No microphone detected.",
      fix: T
        ? "Vui lòng gõ câu hỏi thay vì nói."
        : "Please type your question instead.",
    };
  }
  if (e.includes("network")) {
    return {
      title: T
        ? "Mất kết nối mạng khi đang nghe."
        : "Lost network connection while listening.",
      fix: T
        ? "Kiểm tra Wi-Fi hoặc dữ liệu di động, rồi thử lại."
        : "Check your Wi-Fi or mobile data, then try again.",
    };
  }
  if (e.includes("language-not-supported")) {
    return {
      title: T
        ? "Trình duyệt này không hỗ trợ tiếng Việt bằng giọng nói."
        : "This browser doesn't support voice input for this language.",
      fix: T ? "Vui lòng gõ câu hỏi." : "Please type your question instead.",
    };
  }
  // Fallback — still human, but generic.
  return {
    title: T
      ? "Có lỗi với micro. Vui lòng thử lại."
      : "Something went wrong with the microphone. Please try again.",
    fix: null,
  };
}
