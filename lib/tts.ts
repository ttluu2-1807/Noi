"use client";

import type { Language } from "./language-detect";

/**
 * Text-to-speech client. Two-tier strategy:
 *
 *   1. Primary — POST /api/tts → ElevenLabs MP3 (server-cached in
 *      Supabase Storage). Genuinely human voice in both Vietnamese
 *      and English. ~300–800ms first byte; cache hits are instant.
 *   2. Fallback — browser SpeechSynthesis. Used if /api/tts errors
 *      (network down, quota exceeded, ElevenLabs outage). Robotic
 *      but functional. Most matters when the parent is offline.
 *
 * Public surface is unchanged from the old browser-only implementation:
 * `speak(text, options)` → fires audio, calls onEnd / onError. Callers
 * don't need to know which tier served the audio.
 */

const LANG_CODE: Record<Language, string> = {
  vi: "vi-VN",
  en: "en-AU",
};

// Module-level handles so stopSpeaking() can cancel either tier.
let currentAudio: HTMLAudioElement | null = null;
let currentObjectUrl: string | null = null;
let currentUtterance: SpeechSynthesisUtterance | null = null;

export interface SpeakOptions {
  lang: Language;
  rate?: number;
  pitch?: number;
  onEnd?: () => void;
  onError?: (err: unknown) => void;
}

/**
 * Are we in a context that can play audio at all? True in any modern
 * browser. We always return true now that we have a server-side TTS
 * primary — the browser SpeechSynthesis voice catalogue doesn't
 * matter anymore.
 */
export function isTTSSupported(): boolean {
  if (typeof window === "undefined") return false;
  return typeof window.Audio === "function";
}

/**
 * Kept for compatibility with components that previously hid the
 * speaker button on devices without a matching system voice. With
 * server TTS we always have a voice — return true so the button
 * stays visible.
 */
export function hasVoiceFor(_lang: Language): boolean {
  return isTTSSupported();
}

/** Stop whichever tier is currently playing. */
export function stopSpeaking(): void {
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
    currentUtterance = null;
  }
}

export async function speak(text: string, options: SpeakOptions): Promise<void> {
  if (!isTTSSupported()) {
    options.onError?.(new Error("Audio not supported"));
    return;
  }
  stopSpeaking();

  // --- Tier 1: server-side ElevenLabs --------------------------------
  try {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, language: options.lang }),
    });
    if (!res.ok) throw new Error(`tts route ${res.status}`);

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    currentObjectUrl = url;

    const audio = new Audio(url);
    audio.playbackRate = options.rate ?? 1;
    audio.onended = () => {
      if (currentObjectUrl) {
        URL.revokeObjectURL(currentObjectUrl);
        currentObjectUrl = null;
      }
      currentAudio = null;
      options.onEnd?.();
    };
    audio.onerror = (e) => {
      if (currentObjectUrl) {
        URL.revokeObjectURL(currentObjectUrl);
        currentObjectUrl = null;
      }
      currentAudio = null;
      // Fallback if the blob couldn't be decoded.
      fallbackBrowserTTS(text, options);
      options.onError?.(e);
    };

    currentAudio = audio;
    await audio.play();
    return;
  } catch (err) {
    // Network error / 5xx / quota exhausted — fall back silently.
    console.warn("[tts] server tier failed, falling back to browser:", err);
  }

  // --- Tier 2: browser SpeechSynthesis ------------------------------
  fallbackBrowserTTS(text, options);
}

function fallbackBrowserTTS(text: string, options: SpeakOptions): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    options.onError?.(new Error("No TTS available"));
    return;
  }

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

  currentUtterance = utter;
  window.speechSynthesis.speak(utter);
}
