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

/**
 * Detect Australian institution + phone from a chunk of markdown / prose.
 * Returns the first match (rank by specificity — bigger institutions
 * first) or null. Used to auto-surface the "Prepare for this call"
 * button on an answer that recommends a call.
 */
const AU_PHONE_RE =
  /\b(?:1[38]00[\s-]?\d{3}[\s-]?\d{3}|13[\s-]?\d{2}[\s-]?\d{2}|13\d[\s-]?\d{3}|0[2378][\s-]?\d{4}[\s-]?\d{4}|\(0\d\)[\s-]?\d{4}[\s-]?\d{4})\b/g;

// Rank institutions we care about first — if the answer mentions
// Centrelink AND some other number, we generate Centrelink's card.
const INSTITUTIONS: Array<{ name: string; re: RegExp }> = [
  { name: "Centrelink", re: /\bcentrelink\b/i },
  { name: "Medicare", re: /\bmedicare\b/i },
  { name: "ATO", re: /\b(?:ato|australian\s+tax\s+office)\b/i },
  { name: "myGov", re: /\bmy[\s-]?gov\b/i },
  { name: "Services Australia", re: /\bservices\s+australia\b/i },
  { name: "NDIS", re: /\bndis\b/i },
];

export interface DetectedCall {
  service: string;
  phone: string;
}

export function detectCallInAnswer(md: string): DetectedCall | null {
  if (!md) return null;
  const phoneMatch = md.match(AU_PHONE_RE);
  const phone = phoneMatch?.[0]?.trim();
  if (!phone) return null;
  for (const inst of INSTITUTIONS) {
    if (inst.re.test(md)) {
      return { service: inst.name, phone };
    }
  }
  // Phone present but no known institution → still surface, generic.
  return { service: "the service", phone };
}
