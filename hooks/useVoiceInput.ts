"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Language } from "@/lib/language-detect";

// The Web Speech API isn't in the default DOM lib types. These interfaces
// cover only what we use — not a full re-implementation.
interface SRResult {
  isFinal: boolean;
  [index: number]: { transcript: string };
}
interface SREvent {
  resultIndex: number;
  results: ArrayLike<SRResult>;
}
interface SRError {
  error: string;
}
interface SRInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: SRError) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type SRCtor = new () => SRInstance;

function getSRConstructor(): SRCtor | null {
  if (typeof window === "undefined") return null;
  // Chrome/Edge/Safari expose this under webkit prefix.
  return (
    (window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor })
      .SpeechRecognition ??
    (window as unknown as { webkitSpeechRecognition?: SRCtor })
      .webkitSpeechRecognition ??
    null
  );
}

const LANG_CODE: Record<Language, string> = {
  vi: "vi-VN",
  en: "en-AU",
};

export interface UseVoiceInputOptions {
  language: Language;
  /**
   * Auto-finalise after N ms of silence after the first final result.
   * Some browsers — notably Vietnamese recognition — never emit a "final"
   * result, so we ALSO finalise on user-initiated stop. Either way the
   * caller receives the latest transcript via `onTranscript`.
   */
  silenceMs?: number;
  /**
   * Called when speech is "done" — either silence triggered finalisation,
   * or the user tapped to stop and there's something to deliver.
   * Receives the full transcript so far (final + any pending interim).
   * Caller decides whether to put it in a textarea, submit it, etc.
   */
  onTranscript: (transcript: string) => void;
}

export interface UseVoiceInputResult {
  isSupported: boolean;
  isListening: boolean;
  transcript: string;
  error: string | null;
  start: () => void;
  stop: () => void;
  reset: () => void;
}

/**
 * Wrap the browser's SpeechRecognition API. Updates `transcript` live as
 * the user speaks, and calls `onSubmit` once there's been `silenceMs` of
 * quiet after a final result.
 *
 * Graceful degradation: if the API is missing, `isSupported` stays false
 * and the UI should fall back to text input silently.
 */
export function useVoiceInput({
  language,
  silenceMs = 2000,
  onTranscript,
}: UseVoiceInputOptions): UseVoiceInputResult {
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SRInstance | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finalTranscriptRef = useRef("");
  const interimTranscriptRef = useRef("");
  // Track whether we've already delivered this session's transcript so a
  // user-tap-stop after auto-finalise doesn't fire onTranscript twice.
  const deliveredRef = useRef(false);
  // Hold the latest callback in a ref so starting/stopping doesn't force
  // callers to memoise it.
  const onTranscriptRef = useRef(onTranscript);
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  useEffect(() => {
    setIsSupported(getSRConstructor() !== null);
  }, []);

  const clearSilenceTimer = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  };

  const deliverTranscript = () => {
    if (deliveredRef.current) return;
    const text = (finalTranscriptRef.current + interimTranscriptRef.current).trim();
    if (text) {
      deliveredRef.current = true;
      onTranscriptRef.current(text);
    }
  };

  const reset = useCallback(() => {
    setTranscript("");
    setError(null);
    finalTranscriptRef.current = "";
    interimTranscriptRef.current = "";
    deliveredRef.current = false;
    clearSilenceTimer();
  }, []);

  const stop = useCallback(() => {
    clearSilenceTimer();
    // User-initiated stop — deliver whatever we have, even if the
    // recogniser never emitted a "final" result. This is the path that
    // matters for Vietnamese, where most browsers stream interim only.
    deliverTranscript();
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
  }, []);

  const start = useCallback(() => {
    const Ctor = getSRConstructor();
    if (!Ctor) {
      setError("Voice input is not supported in this browser.");
      return;
    }
    reset();

    const rec = new Ctor();
    rec.lang = LANG_CODE[language];
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (event) => {
      let interim = "";
      let gotFinal = false;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        const text = res[0]?.transcript ?? "";
        if (res.isFinal) {
          finalTranscriptRef.current += text;
          gotFinal = true;
        } else {
          interim += text;
        }
      }

      interimTranscriptRef.current = interim;
      setTranscript((finalTranscriptRef.current + interim).trim());

      if (gotFinal) {
        clearSilenceTimer();
        silenceTimerRef.current = setTimeout(() => {
          deliverTranscript();
          stop();
        }, silenceMs);
      }
    };

    rec.onerror = (event) => {
      // "no-speech" fires when the user opens the mic but doesn't speak —
      // treat it as a soft stop, not a user-visible error.
      if (event.error && event.error !== "no-speech" && event.error !== "aborted") {
        setError(event.error);
      }
    };

    rec.onend = () => {
      clearSilenceTimer();
      // If the engine itself decided to stop (e.g. a quiet pause that
      // looked like end-of-speech) and we haven't delivered yet,
      // deliver now so the transcript isn't lost.
      deliverTranscript();
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = rec;
    setIsListening(true);
    try {
      rec.start();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setIsListening(false);
      recognitionRef.current = null;
    }
  }, [language, silenceMs, reset, stop]);

  useEffect(() => {
    return () => {
      clearSilenceTimer();
      recognitionRef.current?.abort();
    };
  }, []);

  return { isSupported, isListening, transcript, error, start, stop, reset };
}
