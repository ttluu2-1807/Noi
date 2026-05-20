"use client";

import type { Language } from "./language-detect";

/**
 * Text-to-speech client. Two-tier strategy:
 *
 *   1. Primary — POST /api/tts → ElevenLabs MP3 (server-cached in
 *      Supabase Storage). Natural per-language voices in both
 *      Vietnamese and English. ~300–800ms first byte; cache hits
 *      are instant.
 *   2. Fallback — browser SpeechSynthesis. Used if /api/tts errors
 *      (network down, quota exceeded, ElevenLabs outage).
 *
 * ## Singleton playback rule
 *
 * Only ONE audio source can play at a time across the whole app.
 * Tapping "Nghe" on a different message — or pressing Stop — must
 * cancel any prior playback AND any in-flight fetch that hasn't
 * resolved yet. Without this, rapid-fire taps would race: two
 * fetches resolve, both play, you hear overlap.
 *
 * We enforce singleton by:
 *   - Bumping a `currentRequestId` on every speak() and stopSpeaking().
 *   - Aborting the in-flight fetch via AbortController.
 *   - Comparing the captured `myRequestId` after each await point —
 *     if we've been superseded, we exit quietly AND fire `onEnd` so
 *     the caller's UI ("Listen" ↔ "Stop") clears its state.
 *
 * Without that onEnd-on-supersession step, a rapid tap leaves the
 * first button stuck on "Stop" forever (its onEnd never fires) — a
 * UX bug the user hit during testing.
 */

const LANG_CODE: Record<Language, string> = {
  vi: "vi-VN",
  en: "en-AU",
};

// Module-level handles. Singleton across the app.
let currentAudio: HTMLAudioElement | null = null;
let currentObjectUrl: string | null = null;
let currentAbortController: AbortController | null = null;
// Monotonic request id; every speak() and stopSpeaking() bumps it.
// Captured at speak() start; checked after each await; if it ever
// differs from the latest, we've been superseded.
let currentRequestId = 0;

export interface SpeakOptions {
  lang: Language;
  rate?: number;
  pitch?: number;
  onEnd?: () => void;
  onError?: (err: unknown) => void;
}

export function isTTSSupported(): boolean {
  if (typeof window === "undefined") return false;
  return typeof window.Audio === "function";
}

export function hasVoiceFor(_lang: Language): boolean {
  return isTTSSupported();
}

/**
 * Stop whatever is currently playing AND invalidate any in-flight fetch.
 * Safe to call repeatedly. Does not fire any onEnd callbacks itself —
 * callers that wired up onEnd to clear their own UI state should also
 * clear it explicitly when they call this (as MessageBubble does).
 */
export function stopSpeaking(): void {
  // Bump first so any in-flight speak() awaiting a fetch sees it lost
  // the race and bails out before touching currentAudio.
  currentRequestId++;

  if (currentAbortController) {
    currentAbortController.abort();
    currentAbortController = null;
  }

  if (currentAudio) {
    currentAudio.pause();
    currentAudio.src = "";
    currentAudio = null;
  }

  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = null;
  }

  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

export async function speak(text: string, options: SpeakOptions): Promise<void> {
  if (!isTTSSupported()) {
    options.onError?.(new Error("Audio not supported"));
    return;
  }

  // Kill any prior playback / in-flight fetch before claiming our slot.
  stopSpeaking();

  const myRequestId = ++currentRequestId;
  const abortController = new AbortController();
  currentAbortController = abortController;

  // Helper: have we been superseded by a later speak() or stopSpeaking()?
  const isStale = () => myRequestId !== currentRequestId;

  // --- Tier 1: server-side ElevenLabs --------------------------------
  try {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, language: options.lang }),
      signal: abortController.signal,
    });

    if (isStale()) {
      // A newer call took over while we were awaiting the response.
      // Fire onEnd so our caller's UI ("Stop" button) flips back to
      // "Listen" — otherwise it sits stuck forever.
      options.onEnd?.();
      return;
    }

    if (!res.ok) throw new Error(`tts route ${res.status}`);

    const blob = await res.blob();
    if (isStale()) {
      options.onEnd?.();
      return;
    }

    const url = URL.createObjectURL(blob);
    currentObjectUrl = url;

    const audio = new Audio(url);
    audio.playbackRate = options.rate ?? 1;

    audio.onended = () => {
      // Only OUR onended should clear state — if we've been superseded,
      // a newer speak() owns the cleanup.
      if (isStale()) return;
      if (currentObjectUrl) {
        URL.revokeObjectURL(currentObjectUrl);
        currentObjectUrl = null;
      }
      currentAudio = null;
      options.onEnd?.();
    };

    audio.onerror = (e) => {
      if (isStale()) return;
      if (currentObjectUrl) {
        URL.revokeObjectURL(currentObjectUrl);
        currentObjectUrl = null;
      }
      currentAudio = null;
      options.onError?.(e);
      // Audio element couldn't decode the blob — fall through to
      // browser TTS as a last resort.
      fallbackBrowserTTS(text, options);
    };

    currentAudio = audio;
    await audio.play();
    return;
  } catch (err) {
    // AbortError = stopSpeaking() / newer speak() cancelled us. Fire
    // onEnd so caller clears its UI, then exit quietly.
    if ((err as { name?: string })?.name === "AbortError") {
      options.onEnd?.();
      return;
    }
    if (isStale()) {
      options.onEnd?.();
      return;
    }
    console.warn("[tts] server tier failed, falling back to browser:", err);
  }

  // --- Tier 2: browser SpeechSynthesis ------------------------------
  if (isStale()) {
    options.onEnd?.();
    return;
  }
  fallbackBrowserTTS(text, options);
}

function fallbackBrowserTTS(text: string, options: SpeakOptions): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    options.onError?.(new Error("No TTS available"));
    options.onEnd?.();
    return;
  }

  // Cancel any other browser TTS already speaking.
  window.speechSynthesis.cancel();

  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = LANG_CODE[options.lang];
  utter.rate = options.rate ?? 1;
  utter.pitch = options.pitch ?? 1;

  const voices = window.speechSynthesis.getVoices();
  const match =
    voices.find((v) => v.lang === LANG_CODE[options.lang]) ??
    voices.find((v) => v.lang.startsWith(options.lang));
  if (match) utter.voice = match;

  if (options.onEnd) utter.onend = options.onEnd;
  if (options.onError) {
    utter.onerror = (e) => options.onError?.(e);
  }

  window.speechSynthesis.speak(utter);
}
