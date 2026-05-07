import { anthropic, MODEL } from "./anthropic";
import type { Language } from "./language-detect";

const LABEL: Record<Language, string> = {
  vi: "Vietnamese",
  en: "English",
};

/**
 * Translate a block of text from one language to the other using Claude.
 * Used at write time to populate both `content_vi` and `content_en` so the
 * UI never has to translate on the fly.
 *
 * Preserves structure (numbered lists, checkboxes, bold markers) so the
 * formatting we rely on for checklist extraction is not lost.
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
      `You are a precise translator. Translate the user's message from ${LABEL[from]} to ${LABEL[to]}. ` +
      `Preserve all Markdown formatting exactly — numbered lists, checkboxes like "- [ ]", bold markers, ` +
      `blockquotes, and line breaks. Do not add commentary, notes, or quotation marks around the output. ` +
      `Translate official Australian terms accurately (Medicare, Centrelink, myGov, ATO, etc. stay in English). ` +
      (to === "vi"
        ? "Use a warm, formal Vietnamese register suitable for speaking with an elder. Prefer 'quý vị' over 'bạn'."
        : "Use clear, friendly Australian English."),
    messages: [{ role: "user", content: text }],
  });

  const block = result.content[0];
  if (block?.type !== "text") {
    throw new Error("Unexpected non-text translation response");
  }
  return block.text;
}
