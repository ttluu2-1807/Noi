"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { VoiceInput } from "@/components/VoiceInput";
import { StreamingResponse } from "@/components/StreamingResponse";
import { PhotographLetter } from "@/components/PhotographLetter";
import { HeaderMenu } from "@/components/HeaderMenu";
import { HeroIllustration } from "@/components/HeroIllustration";
import { SuggestedQuestions } from "@/components/SuggestedQuestions";
import { QuickAccessRow } from "@/components/QuickAccessRow";
import { WeeklyDigestCard } from "@/components/WeeklyDigestCard";
import { NeedsAttention } from "@/components/NeedsAttention";
import { UrgentBanner } from "@/components/UrgentBanner";
import { timeOfDayGreeting } from "@/lib/greeting";
import type { NeedsAttention as NeedsAttentionData } from "@/lib/insights";
import type { Attachment } from "@/lib/storage";
import type { Language } from "@/lib/language-detect";

interface ParentHomeProps {
  displayName: string;
  language: Language;
  familySpaceId: string;
  inviteCode: string | null;
  needsAttention: NeedsAttentionData;
  /** Counts for QuickAccessRow tile badges only — not shown as prose. */
  threadsCount: number;
  todosCount: number;
  diaryCount: number;
}

const T = {
  vi: {
    prompt: "Quý vị muốn hỏi điều gì hôm nay?",
    placeholder: "Hoặc gõ câu hỏi ở đây...",
    send: "Gửi",
    questionHeading: "Câu hỏi",
    // Letter-mode fallback — used when a photo is attached with no
    // text. Steers Claude into the answer anatomy focused on the
    // letter: what/why/what-to-do/by-when, with a trailing
    // "Add to your list" section for concrete tasks.
    letterFallback:
      "Đây là thư hay giấy tờ tôi vừa nhận. Xin đọc giúp và cho biết: Đây là gì? Tại sao tôi nhận nó? Tôi cần làm gì và trước ngày nào? Nếu có việc cần làm, xin thêm vào danh sách.",
  },
  en: {
    prompt: "What would you like to ask today?",
    placeholder: "Or type your question here…",
    send: "Send",
    questionHeading: "Question",
    letterFallback:
      "This is a letter or notice I just received. Please read it and tell me: what is it, why did I receive it, what do I need to do, and by when? If there are action items, add them to my list.",
  },
} as const;

/**
 * Parent home — v1 layout per audit screen 01.
 *
 * Two states:
 *   - idle     : greeting + quick-access tiles + weekly digest card +
 *                hero mic + type field + attachment + "Needs attention" list
 *   - streaming: the parent's just-asked question + streaming response,
 *                which routes to the thread page on completion.
 *
 * The activity feed with its open/done tabs is gone. The family code
 * line under the greeting is gone (still available via HeaderMenu).
 * "Needs attention" replaces "TodayTodosBanner" as the single surface
 * for items due or unread, drawing across todos, diary events, and
 * unread threads.
 */
export function ParentHome({
  displayName,
  language,
  familySpaceId,
  inviteCode,
  needsAttention,
  threadsCount,
  todosCount,
  diaryCount,
}: ParentHomeProps) {
  const router = useRouter();
  const t = T[language];
  const [query, setQuery] = useState<string | null>(null);
  const [textInput, setTextInput] = useState("");
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [pendingAttachment, setPendingAttachment] = useState<Attachment | null>(
    null,
  );
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const [greeting, setGreeting] = useState(() =>
    timeOfDayGreeting(displayName, language, new Date()),
  );
  useEffect(() => {
    setGreeting(timeOfDayGreeting(displayName, language, new Date()));
  }, [displayName, language]);

  if (query) {
    return (
      <main className="mx-auto max-w-md px-6 py-10 space-y-8">
        <header>
          <h1 className="text-title font-medium">{t.questionHeading}</h1>
          <p className="mt-2 rounded-bubble bg-clay-wash p-4 text-body">
            {query}
          </p>
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
    if (!trimmed && !attachment) return;
    setPendingAttachment(attachment);
    // Photo-only submissions use the letter-mode prompt so Claude
    // returns the anatomy focused on the letter: what it is, why they
    // received it, what to do, by when. Add-to-list chips fall out
    // for free when Claude appends the trailing section.
    setQuery(trimmed || t.letterFallback);
    setAttachment(null);
  };

  const nothingYet =
    threadsCount === 0 && todosCount === 0 && diaryCount === 0;

  return (
    <main className="mx-auto max-w-md px-gutter py-10 space-y-10">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-1">
          <h1 className="text-display font-medium truncate">{greeting}</h1>
          <p className="text-ink-3 text-body">{t.prompt}</p>
        </div>
        <HeaderMenu
          role="parent"
          language={language}
          displayName={displayName}
          inviteCode={inviteCode}
        />
      </header>

      {/* Urgent banner — only renders if there's an overdue todo or a
          today-due item. Sits above everything so it's the first thing
          the parent sees when there's real time pressure. */}
      <UrgentBanner data={needsAttention} language={language} />

      <QuickAccessRow
        language={language}
        counts={{ threads: threadsCount, diary: diaryCount }}
        activityHref="/parent"
      />

      <WeeklyDigestCard language={language} />

      {/* Composer — the "Question, hero mic, type field" of the audit. */}
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
              ref={textareaRef}
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder={t.placeholder}
              rows={3}
              className="w-full rounded-card border border-line bg-surface px-4 py-3 leading-relaxed text-body focus:border-green focus:outline-none resize-none"
            />
          </label>
          <PhotographLetter
            familySpaceId={familySpaceId}
            language={language}
            attachment={attachment}
            onChange={setAttachment}
          />
          <button
            type="submit"
            disabled={!textInput.trim() && !attachment}
            className="btn-primary w-full rounded-card px-4 py-3"
          >
            {t.send}
          </button>
        </form>
      </section>

      {/* Needs attention — replaces the old activity feed and TodayTodosBanner.
          Items due or unread, ranked; tap through to act. */}
      <NeedsAttention data={needsAttention} language={language} />

      {/* First-run empty state: hero illustration + suggested first questions. */}
      {nothingYet && (
        <section className="text-center space-y-6 pt-2">
          <HeroIllustration className="w-44 h-20 text-green/70 mx-auto" />
          <SuggestedQuestions
            language={language}
            onPick={(q) => {
              setTextInput(q);
              textareaRef.current?.focus();
            }}
          />
        </section>
      )}
    </main>
  );
}
