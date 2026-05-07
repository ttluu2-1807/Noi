"use client";

import type { Language } from "./language-detect";

/**
 * Web Speech Synthesis wrapper. Isolated here so we can swap to
 * ElevenLabs or another provider later without touching components.
 *
 * Browser TTS quality for Vietnamese varies — Chrome/Safari on
 * recent macOS/iOS has decent voices; older devices may not have
 * any Vietnamese voice at all. `isSupported(lang)` lets the UI
 * hide the speaker icon silently on unsupported devices.
 */

const LANG_CODE: Record<Language, string> = {
  vi: "vi-VN",
  en: "en-AU",
};

export function isTTSSupported(): boolean {
  if (typeof window === "undefined") return false;
  return "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
}

/**
 * Returns true if the device has at least one voice for the given language.
 * Voices load asynchronously on some browsers — callers should retry after
 * `voiceschanged` if this initially returns false.
 */
export function hasVoiceFor(lang: Language): boolean {
  if (!isTTSSupported()) return false;
  const prefix = lang === "vi" ? "vi" : "en";
  return window.speechSynthesis.getVoices().some((v) => v.lang.startsWith(prefix));
}

export interface SpeakOptions {
  lang: Language;
  rate?: number; // 0.1–10, default 1
  pitch?: number; // 0–2, default 1
  onEnd?: () => void;
  onError?: (err: unknown) => void;
}

export function speak(text: string, options: SpeakOptions): void {
  if (!isTTSSupported()) return;

  // Cancel anything currently playing — user probably wants the new one.
  window.speechSynthesis.cancel();

  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = LANG_CODE[options.lang];
  utter.rate = options.rate ?? 1;
  utter.pitch = options.pitch ?? 1;

  const match = window.speechSynthesis
    .getVoices()
    .find((v) => v.lang === LANG_CODE[options.lang])
    ?? window.speechSynthesis
      .getVoices()
      .find((v) => v.lang.startsWith(options.lang));
  if (match) utter.voice = match;

  if (options.onEnd) utter.onend = options.onEnd;
  if (options.onError) {
    utter.onerror = (e) => options.onError?.(e);
  }

  window.speechSynthesis.speak(utter);
}

export function stopSpeaking(): void {
  if (!isTTSSupported()) return;
  window.speechSynthesis.cancel();
}
