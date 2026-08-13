import { anthropic, MODEL } from "./anthropic";

/**
 * Call preparation card generator.
 *
 * Produces a bilingual (EN / VI side-by-side) cheat-sheet for a parent
 * about to phone an Australian institution — Centrelink, Medicare,
 * ATO, myGov support, etc. The card is READ WHILE ON THE CALL, under
 * stress, so every field is:
 *   · short
 *   · immediately actionable
 *   · always in both languages (parent reads VI to know what they're
 *     saying, EN is the phrase they actually speak)
 *
 * The shape is fixed so the renderer can layout consistently.
 */

export interface CallPrepPhrase {
  en: string;
  vi: string;
}

export interface CallPrepQA {
  /** What the caller might ask, in English. */
  question_en: string;
  /** Same question in Vietnamese so the parent recognises it. */
  question_vi: string;
  /** A safe short answer they can read out. */
  answer: CallPrepPhrase;
}

export interface CallPrep {
  /** Service name, e.g. "Medicare" or "Centrelink". */
  service: string;
  /** Phone number as it appears in the answer (formatted). */
  phone: string;
  /** ≤ 5 items to have ready before dialling (documents / info). */
  before_you_call: CallPrepPhrase[];
  /** The very first thing to say when they answer. */
  opening: CallPrepPhrase;
  /** 3-5 questions they're likely to ask + safe replies. */
  likely_questions: CallPrepQA[];
  /** Escape hatches — universal phrases like "please speak slowly". */
  escape_phrases: CallPrepPhrase[];
  /** What to have written down / confirmed by the end of the call. */
  what_to_leave_with: CallPrepPhrase[];
}

/**
 * Generate a call-prep card. `threadContext` is the recent Q + A prose
 * that the parent already saw — Claude uses it to tailor the opening
 * line and the likely-questions list to the actual task.
 */
export async function generateCallPrep(input: {
  service: string;
  phone: string;
  threadContext: string;
}): Promise<CallPrep | null> {
  const result = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system:
      `You prepare a Vietnamese-speaking elder in Australia for a phone ` +
      `call to an Australian institution. The card is READ ON THE PHONE ` +
      `under stress, so every field must be:\n` +
      `  · short (≤ 12 words per phrase)\n` +
      `  · immediately speakable — natural spoken sentences\n` +
      `  · always in BOTH languages simultaneously, not translation-on-` +
      `    demand. The parent reads the Vietnamese to know what they're ` +
      `    saying, the English is the actual phrase they speak into the phone.\n` +
      `\n` +
      `Vietnamese register: warm, formal, elder-appropriate. Use "Dạ" as ` +
      `an affirmation. English register: polite, clear, calm.\n` +
      `\n` +
      `Return strict JSON only, no prose, no fences. Shape:\n` +
      `{\n` +
      `  "service": string,\n` +
      `  "phone": string,\n` +
      `  "before_you_call": [{"en": string, "vi": string}, ...],  // 3-5 items\n` +
      `  "opening": {"en": string, "vi": string},                  // the first thing to say\n` +
      `  "likely_questions": [\n` +
      `    {\n` +
      `      "question_en": string,   // what the operator asks\n` +
      `      "question_vi": string,   // parent recognises the question\n` +
      `      "answer": {"en": string, "vi": string}  // safe reply\n` +
      `    }\n` +
      `    // 3-5 items\n` +
      `  ],\n` +
      `  "escape_phrases": [{"en": string, "vi": string}, ...],   // 3-4 items — "please speak slowly", "please hold", "sorry could you repeat"\n` +
      `  "what_to_leave_with": [{"en": string, "vi": string}, ...] // 2-4 items — confirmation numbers, next steps\n` +
      `}\n` +
      `\n` +
      `Never invent phone numbers or dates. Use the ones supplied. If the ` +
      `thread context is vague, ask for basics like "reason for calling" — ` +
      `don't fabricate specifics.`,
    messages: [
      {
        role: "user",
        content:
          `Service: ${input.service}\n` +
          `Phone: ${input.phone}\n\n` +
          `Recent conversation with Noi (this is what the parent is calling about):\n` +
          `${input.threadContext.slice(0, 2000)}`,
      },
    ],
  });

  const block = result.content[0];
  if (block?.type !== "text") return null;

  const raw = block.text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();

  try {
    const parsed = JSON.parse(raw) as Partial<CallPrep>;
    // Coarse validation — surface null if the model returned garbage.
    if (
      typeof parsed.service !== "string" ||
      typeof parsed.phone !== "string" ||
      !parsed.opening ||
      !Array.isArray(parsed.likely_questions) ||
      parsed.likely_questions.length === 0
    ) {
      return null;
    }
    return {
      service: parsed.service,
      phone: parsed.phone,
      before_you_call: (parsed.before_you_call ?? []).slice(0, 6),
      opening: parsed.opening,
      likely_questions: parsed.likely_questions.slice(0, 6),
      escape_phrases: (parsed.escape_phrases ?? []).slice(0, 6),
      what_to_leave_with: (parsed.what_to_leave_with ?? []).slice(0, 6),
    };
  } catch {
    return null;
  }
}

// The client-safe `detectCallInAnswer` used to live here. It's moved
// to lib/call-prep-detect.ts because client components need it and
// this module imports the Anthropic SDK — pulling any export from
// here into a client bundle ships the SDK to the browser, which
// throws ("browser-like environment") on load. Server code that also
// needs the detector should import from lib/call-prep-detect.
export type { DetectedCall } from "./call-prep-detect";
export { detectCallInAnswer } from "./call-prep-detect";
