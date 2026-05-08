import { anthropic, MODEL } from "./anthropic";
import type { Language } from "./language-detect";

const LABEL: Record<Language, string> = {
  vi: "Vietnamese",
  en: "English",
};

const REGISTER_NOTES: Record<Language, string> = {
  vi:
    "Use a warm, formal Vietnamese register suitable for speaking with an elder. " +
    "Address the listener as 'quý vị' or omit direct address when natural — never 'bạn'. " +
    "Use 'Dạ' as a polite affirmation when the source uses 'Yes'/'Sure' at the start of a sentence. " +
    "Avoid bureaucratic jargon. If you must use an English term (Medicare, Centrelink, myGov, ATO), keep it in English and add a one-line plain Vietnamese gloss in parentheses the first time it appears, e.g. 'Medicare (bảo hiểm y tế công)'. " +
    "Numbers, phone numbers, dates and addresses must be preserved exactly. " +
    "Write in short sentences. Aim for clarity over completeness — an elderly reader should not face long, dense paragraphs.",
  en:
    "Use clear, friendly Australian English. " +
    "Assume the reader is bilingual (the user's adult child) and capable, but does not need patronising. " +
    "Keep institution names in their official form (Medicare, Centrelink, myGov, ATO). " +
    "Numbers, phone numbers, dates and addresses must be preserved exactly. " +
    "Match the structure of the source — if the source has numbered steps or bullet points, the translation has the same.",
};

/**
 * Translate a block of text from one language to the other using Claude.
 *
 * Used at write time to populate both `content_vi` and `content_en` so the
 * UI never has to translate at read time.
 *
 * The prompt tells Claude:
 *   - exact language pair
 *   - register expectations for each language (warm formal vi, friendly AU en)
 *   - to preserve all formatting (numbered lists, "- [ ]" checklists, line breaks)
 *   - to leave Australian institution names in English
 *   - to preserve numbers / phone numbers / dates verbatim
 */
export async function translate(
  text: string,
  from: Language,
  to: Language,
): Promise<string> {
  if (from === to) return text;
  if (!text.trim()) return text;

  const result = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system:
      `You are a precise translator for the Noi app, which helps Vietnamese-speaking elderly Australians and their adult children. ` +
      `Translate the user's message from ${LABEL[from]} to ${LABEL[to]}. ` +
      `Preserve all Markdown structure exactly — numbered lists, checklist lines like "- [ ]", bold markers, line breaks. ` +
      `Do NOT add commentary, notes, or wrap the output in quotation marks. Output ONLY the translation. ` +
      REGISTER_NOTES[to],
    messages: [{ role: "user", content: text }],
  });

  const block = result.content[0];
  if (block?.type !== "text") {
    throw new Error("Unexpected non-text translation response");
  }
  return block.text;
}
