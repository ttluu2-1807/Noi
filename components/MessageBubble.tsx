"use client";

import { useState } from "react";
import type { Language } from "@/lib/language-detect";
import { isTTSSupported, hasVoiceFor, speak, stopSpeaking } from "@/lib/tts";

export interface MessageRow {
  id: string;
  sender_role: "parent" | "child" | "assistant" | null;
  content_vi: string | null;
  content_en: string | null;
  message_type: string | null;
  created_at: string;
}

interface MessageBubbleProps {
  message: MessageRow;
  /** Language the viewer prefers. */
  viewerLanguage: Language;
  /** When true, user can tap to flip to the other language. */
  allowToggle?: boolean;
  /** When true, show a TTS speaker button for assistant messages. */
  showTTS?: boolean;
}

const ROLE_LABEL: Record<Language, Record<NonNullable<MessageRow["sender_role"]>, string>> = {
  vi: { parent: "Bạn", child: "Con", assistant: "Noi" },
  en: { parent: "Parent", child: "You", assistant: "Noi" },
};

export function MessageBubble({
  message,
  viewerLanguage,
  allowToggle = true,
  showTTS = false,
}: MessageBubbleProps) {
  const [lang, setLang] = useState<Language>(viewerLanguage);
  const [speaking, setSpeaking] = useState(false);

  const content = (lang === "vi" ? message.content_vi : message.content_en) ?? "";
  const other: Language = lang === "vi" ? "en" : "vi";
  const otherHas =
    (other === "vi" ? message.content_vi : message.content_en)?.trim().length ?? 0;

  const isAssistant = message.sender_role === "assistant";
  const roleLabel = message.sender_role
    ? ROLE_LABEL[lang][message.sender_role]
    : null;

  const onSpeak = () => {
    if (!isTTSSupported()) return;
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    speak(content, {
      lang,
      onEnd: () => setSpeaking(false),
      onError: () => setSpeaking(false),
    });
  };

  return (
    <div className={`space-y-1 ${isAssistant ? "" : "ml-6"}`}>
      {roleLabel && (
        <div className="text-xs text-muted">{roleLabel}</div>
      )}
      <div
        className={`rounded-bubble p-4 leading-relaxed whitespace-pre-wrap ${
          isAssistant
            ? "bg-white border border-line"
            : "bg-accent/10 text-ink"
        }`}
      >
        {content}
      </div>
      <div className="flex items-center gap-3 text-xs text-muted">
        {showTTS && isAssistant && isTTSSupported() && hasVoiceFor(lang) && (
          <button
            type="button"
            onClick={onSpeak}
            className="inline-flex items-center gap-1 hover:text-ink"
            aria-label={speaking ? "Stop reading" : "Read aloud"}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
              {speaking ? (
                <rect x="6" y="6" width="12" height="12" rx="2" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10v4a1 1 0 001 1h3l5 4V5L7 9H4a1 1 0 00-1 1zm13.5 2a4.5 4.5 0 00-2-3.75m2 7.5a4.5 4.5 0 01-2 3.75" />
              )}
            </svg>
            {speaking ? "Stop" : lang === "vi" ? "Nghe" : "Listen"}
          </button>
        )}
        {allowToggle && otherHas > 0 && (
          <button
            type="button"
            onClick={() => setLang(other)}
            className="hover:text-ink underline-offset-2 hover:underline"
          >
            {lang === "vi" ? "See in English" : "Xem tiếng Việt"}
          </button>
        )}
      </div>
    </div>
  );
}
