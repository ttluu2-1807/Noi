import type { Language } from "./language-detect";

/**
 * Suggested first questions shown on the parent's home screen when
 * they haven't asked anything yet. Removes the blank-page friction —
 * elderly users sometimes don't know what they're "allowed" to ask
 * an AI. Concrete examples normalize the surface.
 *
 * Curated for the Vietnamese-Australian audience: Medicare,
 * Centrelink, ATO, banking — the most common pain points.
 */
export interface SuggestedQuestion {
  vi: string;
  en: string;
}

export const PARENT_SUGGESTED_QUESTIONS: SuggestedQuestion[] = [
  {
    vi: "Làm sao để gia hạn thẻ Medicare?",
    en: "How do I renew my Medicare card?",
  },
  {
    vi: "Cách kiểm tra trợ cấp Centrelink",
    en: "How do I check my Centrelink benefits?",
  },
  {
    vi: "Báo cáo thu nhập với ATO",
    en: "How do I report income to the ATO?",
  },
  {
    vi: "Cách đặt lịch khám bác sĩ",
    en: "How do I book a GP appointment?",
  },
];

export function suggestedFor(language: Language): string[] {
  return PARENT_SUGGESTED_QUESTIONS.map((q) => q[language]);
}
