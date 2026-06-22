import { anthropic, MODEL } from "./anthropic";
import type { Language } from "./language-detect";

export interface ExtractedDiaryEntry {
  kind: "event" | "decision" | "note";
  title: string;
  body: string | null;
  /** The "why" — populated only for decisions; null otherwise. */
  context: string | null;
  /** ISO YYYY-MM-DD if a date was mentioned, else null. */
  event_date: string | null;
  /** 1-3 lowercase single-word tags drawn from common life-admin categories. */
  tags: string[];
}

/**
 * Parse a spoken diary dictation into structured fields. Used by the
 * diary composer when the user taps mic — instead of dumping the
 * transcript into the body textarea, we run it through Claude to
 * extract kind, title, body, context (the "why" for decisions),
 * event_date, and tags, then auto-populate the form.
 *
 * Same pattern as extractTodos in lib/todo-extract.ts. Falls back
 * gracefully on parse failure: caller treats null as "no extraction"
 * and dumps the raw transcript into the body field.
 *
 * Date resolution: caller passes the current ISO datetime so "next
 * Thursday" / "ngày mai" etc. resolve against the family's actual
 * "now". We default to date-only precision (YYYY-MM-DD); diary
 * doesn't need timestamps.
 */
export async function extractDiaryEntry(
  transcript: string,
  inputLanguage: Language,
  nowIso: string,
): Promise<ExtractedDiaryEntry | null> {
  const trimmed = transcript.trim();
  if (!trimmed) return null;

  const result = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system:
      `You parse spoken diary dictations from a Vietnamese-Australian family. ` +
      `Input is a free-form transcript in ${inputLanguage === "vi" ? "Vietnamese" : "English"} ` +
      `about a family event, a decision (with reasoning), or a general note.\n\n` +
      `Return strict JSON only — no prose, no code fences. Shape:\n` +
      `{\n` +
      `  "kind": "event" | "decision" | "note",\n` +
      `  "title": string,\n` +
      `  "body": string | null,\n` +
      `  "context": string | null,\n` +
      `  "event_date": string | null,\n` +
      `  "tags": string[]\n` +
      `}\n\n` +
      `Rules:\n` +
      `- kind:\n` +
      `  - "event" if the user describes something that happened or will happen (e.g. an appointment, a trip, an anniversary).\n` +
      `  - "decision" if the user describes a choice they made AND their reasoning ("we decided to X because Y").\n` +
      `  - "note" for general observations that don't fit either.\n` +
      `- title: 5-10 words, scannable headline in the input language. Plain phrase, no trailing punctuation.\n` +
      `- body: a short narrative of what happened or what was decided. Pull out the date/reasoning into their own fields so they don't duplicate here. Null if the title fully captures the entry.\n` +
      `- context: the "why" — ONLY for decisions. Capture the reasoning, alternatives considered, anything future-them might want to remember. Null for events and notes.\n` +
      `- event_date: ISO YYYY-MM-DD if a date was mentioned. Resolve relative phrases ("next Thursday", "ngày mai") using current time = ${nowIso} in Australia/Sydney timezone. Null if no date.\n` +
      `- tags: 1-3 lowercase single-word tags from common life-admin categories: medicare, centrelink, ato, health, finance, family, education, legal, holiday, banking, utilities, appointments. Pick what fits; don't invent niche tags.\n\n` +
      `Preserve Australian institution names in English (Medicare, Centrelink, ATO, myGov) in both languages.\n` +
      `If the transcript is empty or only filler, return null.`,
    messages: [{ role: "user", content: trimmed }],
  });

  const block = result.content[0];
  if (block?.type !== "text") return null;

  const raw = block.text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();

  try {
    const parsed = JSON.parse(raw) as Partial<ExtractedDiaryEntry>;
    const kind: ExtractedDiaryEntry["kind"] =
      parsed.kind === "event" || parsed.kind === "decision" ? parsed.kind : "note";
    if (typeof parsed.title !== "string" || !parsed.title.trim()) return null;

    return {
      kind,
      title: parsed.title.trim().slice(0, 120),
      body: typeof parsed.body === "string" && parsed.body.trim() ? parsed.body.trim() : null,
      context:
        typeof parsed.context === "string" && parsed.context.trim()
          ? parsed.context.trim()
          : null,
      event_date:
        typeof parsed.event_date === "string" &&
        /^\d{4}-\d{2}-\d{2}/.test(parsed.event_date)
          ? parsed.event_date.slice(0, 10)
          : null,
      tags: Array.isArray(parsed.tags)
        ? parsed.tags
            .filter((t) => typeof t === "string")
            .map((t) => t.trim().toLowerCase())
            .filter((t) => t.length > 0 && t.length <= 30)
            .slice(0, 3)
        : [],
    };
  } catch {
    return null;
  }
}
