import { anthropic, MODEL } from "./anthropic";
import type { Language } from "./language-detect";

export type VoiceIntent =
  | {
      kind: "todo";
      text_vi: string;
      text_en: string;
      due_at: string | null;
      assignee_role: "parent" | "child" | "any";
    }
  | {
      kind: "diary";
      diary_kind: "event" | "decision" | "note";
      title: string;
      body: string | null;
      context: string | null;
      event_date: string | null;
      tags: string[];
    }
  | {
      kind: "thread";
      /** The question/topic to start a new thread about, in input language. */
      text: string;
    };

/**
 * Classify a free-form voice transcript into one of three intents:
 * a to-do, a diary entry, or a new thread (question). Combines what
 * extractTodos and extractDiaryEntry do into a single Claude call so
 * the global FAB doesn't have to ask the user up-front "is this a
 * todo or a diary entry?".
 *
 * Returns null if the transcript is empty / pure filler / Claude
 * fails to produce parseable JSON. Callers should fall back to
 * sending the user to a generic compose surface in that case.
 *
 * Date resolution uses nowIso anchored to Australia/Sydney so phrases
 * like "next Thursday" / "ngày mai" / "18-07-2026" resolve correctly
 * regardless of where the family is.
 */
export async function classifyVoiceIntent(
  transcript: string,
  inputLanguage: Language,
  nowIso: string,
): Promise<VoiceIntent | null> {
  const trimmed = transcript.trim();
  if (!trimmed) return null;

  const result = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system:
      `You triage spoken input from a Vietnamese-Australian family using ` +
      `a life-admin assistant. Decide which of three "intents" the user ` +
      `meant, then return the full structured data for that intent.\n\n` +
      `Input language is ${inputLanguage === "vi" ? "Vietnamese" : "English"}. ` +
      `Current time is ${nowIso} (Australia/Sydney).\n\n` +
      `Intents:\n` +
      `1. "todo" — an action item to do. Keywords: "remind me", "pay", ` +
      `"book", "call", "buy", "renew", "đặt", "trả", "gọi", "mua", ` +
      `"đặt lịch", "nhắc tôi". Examples: "Pay land tax by 15-08-2026", ` +
      `"Đặt khám bác sĩ thứ Sáu", "Confirm Trung's wedding guests".\n` +
      `2. "diary" — something to remember. A past or future event, a ` +
      `family decision, or a note. Keywords: "remember", "birthday", ` +
      `"anniversary", "we decided", "ghi nhớ", "sinh nhật", "quyết định". ` +
      `Examples: "Huddy's birthday dinner 18-07-2026", "Mum's cardiology ` +
      `appointment next Thursday", "We decided to use Westpac for the home ` +
      `loan because of the rate".\n` +
      `3. "thread" — a question for Noi to answer with research/advice. ` +
      `Anything that starts with "what", "how", "should we", "can you", ` +
      `"explain", "ai", "tại sao", "làm sao", "có nên". Examples: ` +
      `"How do I renew Mum's Medicare card?", "Tại sao tiền điện cao thế?".\n\n` +
      `When ambiguous, prefer todo over diary over thread (action-first). ` +
      `A diary "event" with a date in the past stays as diary, not todo.\n\n` +
      `Return strict JSON only, no prose, no code fences. Discriminated by ` +
      `the "kind" field:\n\n` +
      `For "todo":\n` +
      `{\n` +
      `  "kind": "todo",\n` +
      `  "text_vi": string,         // warm Vietnamese for the elder\n` +
      `  "text_en": string,         // clear Australian English\n` +
      `  "due_at": string | null,   // ISO 8601, 09:00 Sydney local if a date was said\n` +
      `  "assignee_role": "parent" | "child" | "any"\n` +
      `}\n\n` +
      `For "diary":\n` +
      `{\n` +
      `  "kind": "diary",\n` +
      `  "diary_kind": "event" | "decision" | "note",\n` +
      `  "title": string,           // 5-10 words, input language\n` +
      `  "body": string | null,     // short narrative, or null if title says it all\n` +
      `  "context": string | null,  // the "why" — only for decisions\n` +
      `  "event_date": string | null, // ISO YYYY-MM-DD if a date was mentioned\n` +
      `  "tags": string[]           // 1-3 lowercase single-word tags from: medicare, centrelink, ato, health, finance, family, education, legal, holiday, banking, utilities, appointments\n` +
      `}\n\n` +
      `For "thread":\n` +
      `{\n` +
      `  "kind": "thread",\n` +
      `  "text": string             // the question, in the input language\n` +
      `}\n\n` +
      `Preserve Australian institution names in English (Medicare, ` +
      `Centrelink, ATO, myGov) in both languages.\n` +
      `If the transcript is empty or pure filler, return {"kind":"thread","text":""}.`,
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
    const parsed = JSON.parse(raw) as { kind?: string } & Record<string, unknown>;

    if (parsed.kind === "todo") {
      const text_vi = typeof parsed.text_vi === "string" ? parsed.text_vi.trim() : "";
      const text_en = typeof parsed.text_en === "string" ? parsed.text_en.trim() : "";
      if (!text_vi && !text_en) return null;
      return {
        kind: "todo",
        text_vi: text_vi || text_en,
        text_en: text_en || text_vi,
        due_at:
          typeof parsed.due_at === "string" && parsed.due_at.trim().length > 0
            ? parsed.due_at
            : null,
        assignee_role:
          parsed.assignee_role === "parent" ||
          parsed.assignee_role === "child" ||
          parsed.assignee_role === "any"
            ? parsed.assignee_role
            : "any",
      };
    }

    if (parsed.kind === "diary") {
      const title = typeof parsed.title === "string" ? parsed.title.trim() : "";
      if (!title) return null;
      const dk = parsed.diary_kind;
      return {
        kind: "diary",
        diary_kind: dk === "event" || dk === "decision" ? dk : "note",
        title: title.slice(0, 120),
        body:
          typeof parsed.body === "string" && parsed.body.trim()
            ? parsed.body.trim()
            : null,
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
              .filter((t): t is string => typeof t === "string")
              .map((t) => t.trim().toLowerCase())
              .filter((t) => t.length > 0 && t.length <= 30)
              .slice(0, 3)
          : [],
      };
    }

    if (parsed.kind === "thread") {
      const text = typeof parsed.text === "string" ? parsed.text.trim() : "";
      if (!text) return null;
      return { kind: "thread", text };
    }

    return null;
  } catch {
    return null;
  }
}
