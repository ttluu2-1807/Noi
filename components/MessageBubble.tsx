"use client";

import { useEffect, useState } from "react";
import type { Language } from "@/lib/language-detect";
import { isTTSSupported, hasVoiceFor, speak, stopSpeaking } from "@/lib/tts";
import { renderTextWithLinks } from "@/lib/render-text";
import { getAttachmentSignedUrl, type Attachment } from "@/lib/storage";

export interface MessageRow {
  id: string;
  sender_role: "parent" | "child" | "assistant" | null;
  content_vi: string | null;
  content_en: string | null;
  message_type: string | null;
  attachments?: Attachment[] | null;
  created_at: string;
}

interface MessageBubbleProps {
  message: MessageRow;
  /** Language the viewer prefers. */
  viewerLanguage: Language;
  /** When true, user can tap to flip to the other language. */
  allowToggle?: boolean;
  /**
   * When true, show a TTS speaker button. Defaults to true now —
   * elderly users benefit from being able to listen to any message
   * (their own dictated query, the child's reply, AI's response),
   * not just AI ones. Pass false to suppress.
   */
  showTTS?: boolean;
}

const ROLE_LABEL: Record<Language, Record<NonNullable<MessageRow["sender_role"]>, string>> = {
  vi: { parent: "Bạn", child: "Con", assistant: "Noi" },
  en: { parent: "Parent", child: "You", assistant: "Noi" },
};

const TTS_LISTEN: Record<Language, string> = {
  vi: "Nghe",
  en: "Listen",
};
const TTS_STOP: Record<Language, string> = {
  vi: "Dừng",
  en: "Stop",
};

// Slightly slower default for Vietnamese — elderly listeners follow
// better at ~0.85x. English at 1.0x is fine for a bilingual child.
const DEFAULT_RATE: Record<Language, number> = {
  vi: 0.85,
  en: 1.0,
};

export function MessageBubble({
  message,
  viewerLanguage,
  allowToggle = true,
  showTTS = true,
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
      rate: DEFAULT_RATE[lang],
      onEnd: () => setSpeaking(false),
      onError: () => setSpeaking(false),
    });
  };

  return (
    <div className={`space-y-1 ${isAssistant ? "" : "ml-6"}`}>
      {roleLabel && (
        <div className="text-xs text-muted">{roleLabel}</div>
      )}
      {message.attachments && message.attachments.length > 0 && (
        <AttachmentGrid attachments={message.attachments} />
      )}
      {content.trim().length > 0 && (
        <div
          className={`rounded-bubble p-4 leading-relaxed whitespace-pre-wrap ${
            isAssistant
              ? "bg-white border border-line"
              : "bg-accent/10 text-ink"
          }`}
        >
          {renderTextWithLinks(content)}
        </div>
      )}
      <div className="flex items-center gap-3 text-xs text-muted">
        {showTTS && content.trim().length > 0 && isTTSSupported() && hasVoiceFor(lang) && (
          <button
            type="button"
            onClick={onSpeak}
            className="inline-flex items-center gap-1 hover:text-ink"
            aria-label={speaking ? TTS_STOP[lang] : TTS_LISTEN[lang]}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
              {speaking ? (
                <rect x="6" y="6" width="12" height="12" rx="2" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10v4a1 1 0 001 1h3l5 4V5L7 9H4a1 1 0 00-1 1zm13.5 2a4.5 4.5 0 00-2-3.75m2 7.5a4.5 4.5 0 01-2 3.75" />
              )}
            </svg>
            {speaking ? TTS_STOP[lang] : TTS_LISTEN[lang]}
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

/**
 * Renders the attached images for a message. Each image is fetched
 * via a short-lived signed URL (RLS still applies — only family
 * members can mint these). Renders as a row of thumbnails that
 * expand to full size when tapped (via the native browser preview
 * triggered by an anchor with the same href).
 */
function AttachmentGrid({ attachments }: { attachments: Attachment[] }) {
  return (
    <div className="flex flex-wrap gap-2 my-1">
      {attachments.map((att) => (
        <AttachmentThumb key={att.path} attachment={att} />
      ))}
    </div>
  );
}

function AttachmentThumb({ attachment }: { attachment: Attachment }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getAttachmentSignedUrl(attachment.path).then((u) => {
      if (cancelled) return;
      if (u) setUrl(u);
      else setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [attachment.path]);

  // Reserve space using stored dimensions when available — prevents
  // layout shift as the signed URL resolves.
  const ratio =
    attachment.width && attachment.height
      ? attachment.width / attachment.height
      : 1;

  if (failed) {
    return (
      <div className="h-32 w-32 flex items-center justify-center rounded-card border border-line bg-bg text-xs text-muted">
        Image unavailable
      </div>
    );
  }

  if (!url) {
    return (
      <div
        className="rounded-card border border-line bg-bg animate-pulse"
        style={{ height: "8rem", width: `${8 * ratio}rem` }}
      />
    );
  }

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="block">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={attachment.name ?? "Attached image"}
        loading="lazy"
        className="max-h-64 max-w-full rounded-card border border-line object-contain bg-white"
      />
    </a>
  );
}
