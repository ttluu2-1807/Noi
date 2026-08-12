"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { HeaderMenu } from "@/components/HeaderMenu";
import { QuickAccessRow } from "@/components/QuickAccessRow";
import { WeeklyDigestCard } from "@/components/WeeklyDigestCard";
import { NeedsAttention } from "@/components/NeedsAttention";
import { UrgentBanner } from "@/components/UrgentBanner";
import { VoiceInput } from "@/components/VoiceInput";
import { captureVoiceIntent } from "@/app/(app)/child/voice-capture/actions";
import { timeOfDayGreeting } from "@/lib/greeting";
import type { NeedsAttention as NeedsAttentionData } from "@/lib/insights";
import type { Language } from "@/lib/language-detect";

interface ChildHomeProps {
  displayName: string;
  familySpaceId: string;
  inviteCode: string | null;
  needsAttention: NeedsAttentionData;
  threadsCount: number;
  todosCount: number;
  diaryCount: number;
}

const T = {
  en: {
    prompt: "What needs doing, or want to ask Noi?",
    placeholder:
      "Type or tap the mic — Noi decides if it's a to-do, a note, or a question.",
    send: "Capture",
    sending: "Sorting…",
  },
} as const;

/**
 * Child home — v1 port. Same shape as the parent home: greeting +
 * quick-access tiles + weekly digest + hero mic + type field +
 * "Needs attention". The activity feed and its status tabs are gone;
 * the family code lives in HeaderMenu now.
 *
 * Key difference from parent: the hero composer here routes through
 * the intent classifier (captureVoiceIntent). A parent's question is
 * always a question — for a child, "Pay land tax by Friday" is a
 * to-do, "Huddy's birthday 18-07" is a diary event, "how do I renew
 * Mum's Medicare card" is a thread. One input, three destinations.
 *
 * Language is hardcoded "en" — child role always sees English UI.
 */
export function ChildHome({
  displayName,
  familySpaceId,
  inviteCode,
  needsAttention,
  threadsCount,
  todosCount,
  diaryCount,
}: ChildHomeProps) {
  const router = useRouter();
  const language: Language = "en";
  const t = T.en;
  const [textInput, setTextInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [greeting, setGreeting] = useState(() =>
    timeOfDayGreeting(displayName, "en", new Date()),
  );
  useEffect(() => {
    setGreeting(timeOfDayGreeting(displayName, "en", new Date()));
  }, [displayName]);

  const submit = useCallback(
    (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed) return;
      setError(null);
      startTransition(async () => {
        const result = await captureVoiceIntent(trimmed);
        if (result.ok) {
          router.push(result.redirect);
          setTextInput("");
        } else {
          setError(result.error);
        }
      });
    },
    [router],
  );

  return (
    <main className="mx-auto max-w-md px-gutter py-10 space-y-10">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-1">
          <h1 className="text-display font-medium truncate">{greeting}</h1>
          <p className="text-ink-3 text-body">{t.prompt}</p>
        </div>
        <HeaderMenu
          role="child"
          language={language}
          displayName={displayName}
          inviteCode={inviteCode}
        />
      </header>

      <UrgentBanner data={needsAttention} language={language} />

      <QuickAccessRow
        language={language}
        counts={{
          threads: threadsCount,
          todos: todosCount,
          diary: diaryCount,
        }}
        activityHref="/child"
      />

      <WeeklyDigestCard language={language} />

      <section className="flex flex-col items-center gap-6">
        <VoiceInput
          language={language}
          onTranscript={(text) => submit(text)}
        />

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(textInput);
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
              disabled={pending}
              className="w-full rounded-card border border-line bg-surface px-4 py-3 leading-relaxed text-body focus:border-green focus:outline-none resize-none"
            />
          </label>
          {error && (
            <p className="text-body-sm text-danger" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={pending || !textInput.trim()}
            className="btn-primary w-full rounded-card px-4 py-3"
          >
            {pending ? t.sending : t.send}
          </button>
        </form>
      </section>

      <NeedsAttention data={needsAttention} language={language} />
    </main>
  );
}
