import { translate } from "./translate";
import type { Language } from "./language-detect";
import { detectLanguage } from "./language-detect";

/**
 * Translates the three text fields of a diary entry — title, body,
 * context — from whichever language the user composed in into the
 * other language. Runs the translation calls in parallel.
 *
 * Each field is optional; empty / null inputs translate to null on
 * both sides (no Claude call wasted on nothing).
 *
 * Input language is auto-detected from the title for consistency
 * across the three fields. If a user writes a Vietnamese title with
 * an English body for some reason, we still treat the whole entry
 * as Vietnamese-input — close enough for diary content where the
 * register is what matters, not exact language detection per field.
 */
export interface DiaryTextInput {
  title: string;
  body: string | null;
  context: string | null;
}

export interface DualLanguageDiaryText {
  title_vi: string;
  title_en: string;
  body_vi: string | null;
  body_en: string | null;
  context_vi: string | null;
  context_en: string | null;
}

export async function buildDualLanguage(
  input: DiaryTextInput,
): Promise<DualLanguageDiaryText> {
  const inputLang: Language = detectLanguage(input.title || input.body || input.context || "vi");
  const otherLang: Language = inputLang === "vi" ? "en" : "vi";

  const [titleOther, bodyOther, contextOther] = await Promise.all([
    translate(input.title, inputLang, otherLang),
    input.body ? translate(input.body, inputLang, otherLang) : Promise.resolve(null),
    input.context ? translate(input.context, inputLang, otherLang) : Promise.resolve(null),
  ]);

  return {
    title_vi: inputLang === "vi" ? input.title : titleOther,
    title_en: inputLang === "en" ? input.title : titleOther,
    body_vi: inputLang === "vi" ? input.body : (bodyOther as string | null),
    body_en: inputLang === "en" ? input.body : (bodyOther as string | null),
    context_vi: inputLang === "vi" ? input.context : (contextOther as string | null),
    context_en: inputLang === "en" ? input.context : (contextOther as string | null),
  };
}
