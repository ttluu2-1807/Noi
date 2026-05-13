"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { VoiceInput } from "@/components/VoiceInput";
import { StreamingResponse } from "@/components/StreamingResponse";
import { ThreadCard, type ThreadSummary, type LatestMessageSummary } from "@/components/ThreadCard";
import { AttachmentPicker } from "@/components/AttachmentPicker";
import { HeaderMenu } from "@/components/HeaderMenu";
import type { Attachment } from "@/lib/storage";
import type { Language } from "@/lib/language-detect";

interface ParentHomeProps {
  displayName: string;
  recentThreads: ThreadSummary[];
  latestMessages: Record<string, LatestMessageSummary>;
  language: Language;
  familySpaceId: string;
  inviteCode: string | null;
}

const T = {
  vi: {
    greeting: (name: string) => `Dạ, ${name}`,
    prompt: "Quý vị muốn hỏi điều gì hôm nay?",
    settings: "Cài đặt",
    placeholder: "Hoặc gõ câu hỏi ở đây...",
    send: "Gửi",
    questionHeading: "Câu hỏi",
    recentHeading: "Câu hỏi gần đây",
  },
  en: {
    greeting: (name: string) => `Hi, ${name}`,
    prompt: "What would you like to ask today?",
    settings: "Settings",
    placeholder: "Or type your question here…",
    send: "Send",
    questionHeading: "Question",
    recentHeading: "Recent questions",
  },
} as const;

/**
 * Parent's home screen. Three states:
 *   - idle     : mic + text fallback + recent threads list
 *   - streaming: the question the parent just asked + streaming response
 *
 * UI strings + voice recognition language + content language all key off
 * the parent's `language_preference` (toggleable in Settings).
 */
export function ParentHome({
  displayName,
  recentThreads,
  latestMessages,
  language,
  familySpaceId,
  inviteCode,
}: ParentHomeProps) {
  const router = useRouter();
  const t = T[language];
  const [query, setQuery] = useState<string | null>(null);
  const [textInput, setTextInput] = useState("");
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  // Snapshot of the attachment sent with the current pending query, so
  // StreamingResponse can forward it to /api/chat. We snapshot rather than
  // share state because the user might pick a new attachment for their
  // next question while this one is still streaming.
  const [pendingAttachment, setPendingAttachment] = useState<Attachment | null>(null);

  if (query) {
    return (
      <main className="mx-auto max-w-md px-6 py-10 space-y-8">
        <header>
          <h1 className="text-2xl font-medium">{t.questionHeading}</h1>
          <p className="mt-2 rounded-bubble bg-accent/10 p-4">{query}</p>
        </header>
        <section>
          <StreamingResponse
            query={query}
            threadId={null}
            language={language}
            attachments={pendingAttachment ? [pendingAttachment] : undefined}
            onComplete={(id) => router.push(`/parent/thread/${id}`)}
          />
        </section>
      </main>
    );
  }

  const submit = (text: string) => {
    const trimmed = text.trim();
    // Either a question or an image is required.
    if (!trimmed && !attachment) return;
    setPendingAttachment(attachment);
    setQuery(
      trimmed ||
        (language === "vi"
          ? "Quý vị có thể giải thích giúp tôi nội dung trong hình ảnh này không?"
          : "Could you explain what's in this image for me?"),
    );
    setAttachment(null);
  };

  return (
    <main className="mx-auto max-w-md px-6 py-10 space-y-10">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1 min-w-0 flex-1">
          <h1 className="text-2xl font-medium truncate">{t.greeting(displayName)}</h1>
          <p className="text-muted">{t.prompt}</p>
        </div>
        <HeaderMenu
          role="parent"
          language={language}
          displayName={displayName}
          inviteCode={inviteCode}
        />
      </header>

      <section className="flex flex-col items-center gap-6">
        <VoiceInput
          language={language}
          onTranscript={(text) => setTextInput(text)}
        />

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(textInput);
            setTextInput("");
          }}
          className="w-full space-y-3"
        >
          <label className="block">
            <span className="sr-only">{t.placeholder}</span>
            <textarea
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder={t.placeholder}
              rows={3}
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

      {recentThreads.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm text-muted uppercase tracking-wide">
            {t.recentHeading}
          </h2>
          <ul className="space-y-2">
            {recentThreads.map((t) => (
              <li key={t.id}>
                <ThreadCard
                  thread={t}
                  language={language}
                  basePath="/parent/thread"
                  latestMessage={latestMessages[t.id]}
                  // Highlight tasks the child set up for the parent — these
                  // feel new and distinct from the parent's own questions.
                  highlight={
                    t.initiated_by_role === "child" && t.status === "open"
                  }
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
