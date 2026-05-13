"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { VoiceInput } from "@/components/VoiceInput";
import { StreamingResponse } from "@/components/StreamingResponse";
import { AttachmentPicker } from "@/components/AttachmentPicker";
import type { Attachment } from "@/lib/storage";
import type { Language } from "@/lib/language-detect";

interface FollowUpInputProps {
  threadId: string;
  language: Language;
  familySpaceId: string;
}

const T = {
  vi: { placeholder: "Hỏi thêm câu khác...", send: "Gửi" },
  en: { placeholder: "Ask another question…", send: "Send" },
} as const;

/**
 * Input bar shown at the bottom of a parent's thread for follow-up
 * questions. Voice fills the textarea; user reviews then sends.
 * UI labels and recognition language follow the parent's preference.
 */
export function FollowUpInput({ threadId, language, familySpaceId }: FollowUpInputProps) {
  const router = useRouter();
  const t = T[language];
  const [query, setQuery] = useState<string | null>(null);
  const [textInput, setTextInput] = useState("");
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [pendingAttachment, setPendingAttachment] = useState<Attachment | null>(null);

  if (query) {
    return (
      <section className="rounded-card border border-line bg-white p-5 space-y-3">
        <div className="rounded-bubble bg-accent/10 p-4">{query}</div>
        <StreamingResponse
          query={query}
          threadId={threadId}
          language={language}
          attachments={pendingAttachment ? [pendingAttachment] : undefined}
          onComplete={() => {
            setQuery(null);
            setPendingAttachment(null);
            router.refresh();
          }}
        />
      </section>
    );
  }

  const submit = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed && !attachment) return;
    setPendingAttachment(attachment);
    setQuery(
      trimmed ||
        (language === "vi"
          ? "Quý vị có thể giải thích giúp tôi nội dung trong hình ảnh này không?"
          : "Could you explain what's in this image for me?"),
    );
    setAttachment(null);
    setTextInput("");
  };

  return (
    <section className="space-y-4">
      <div className="flex justify-center">
        <VoiceInput
          language={language}
          onTranscript={(text) => setTextInput(text)}
        />
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(textInput);
        }}
        className="space-y-2"
      >
        <label className="block">
          <span className="sr-only">{t.placeholder}</span>
          <textarea
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder={t.placeholder}
            rows={2}
            className="w-full rounded-card border border-line bg-white px-4 py-3 leading-relaxed focus:border-accent focus:outline-none resize-none"
          />
        </label>
        <AttachmentPicker
          familySpaceId={familySpaceId}
          language={language}
          attachment={attachment}
          onChange={setAttachment}
        />
        <button
          type="submit"
          disabled={!textInput.trim() && !attachment}
          className="w-full rounded-card bg-accent px-4 py-3 font-medium text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
        >
          {t.send}
        </button>
      </form>
    </section>
  );
}
