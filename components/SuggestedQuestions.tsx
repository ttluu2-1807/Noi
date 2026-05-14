"use client";

import { suggestedFor } from "@/lib/suggestions";
import type { Language } from "@/lib/language-detect";

interface SuggestedQuestionsProps {
  language: Language;
  /** Called when a suggestion is tapped — typically fills the textarea. */
  onPick: (question: string) => void;
}

const T = {
  vi: { heading: "Có thể bắt đầu với:" },
  en: { heading: "You could start with:" },
} as const;

/**
 * Tappable chips with seed questions the parent might want to ask Noi.
 * Shown in the parent home empty state. Tapping a chip drops its text
 * into the composer (caller decides exactly how — typically setting the
 * textarea value and focusing it).
 */
export function SuggestedQuestions({ language, onPick }: SuggestedQuestionsProps) {
  const t = T[language];
  const questions = suggestedFor(language);

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted">{t.heading}</p>
      <div className="flex flex-wrap gap-2">
        {questions.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => onPick(q)}
            className="rounded-full border border-line bg-white px-3 py-2 text-sm text-ink hover:border-accent/40 hover:bg-accent/5 transition-all active:scale-[0.97]"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
