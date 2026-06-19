import { anthropic, MODEL } from "./anthropic";
import type { Language } from "./language-detect";

export interface ExtractedTodo {
  text_vi: string;
  text_en: string;
  /** ISO date string if a relative or absolute date was detected. */
  due_at: string | null;
  /** Who the item is for — defaults to "any". */
  assignee_role: "parent" | "child" | "any";
}

/**
 * Take a free-form voice transcript (often multiple items in one breath,
 * e.g. "Mua thuốc, đi khám bác sĩ thứ Sáu, gọi điện cho con") and split
 * it into discrete to-do items.
 *
 * Each item gets:
 *   - Vietnamese + English versions (elder-friendly register)
 *   - An optional due date if the speaker mentioned one ("thứ Sáu" /
 *     "Friday" / "next week" / "tomorrow")
 *   - An optional assignee — "parent" / "child" / "any". If the speaker
 *     names a family member, that maps; otherwise "any".
 *
 * Date interpretation: we pass the user's current date as anchor so
 * "Friday" becomes the next Friday from now. Times default to 9am
 * local — close enough for elderly users who don't think in specific
 * hour windows.
 */
export async function extractTodos(
  transcript: string,
  inputLanguage: Language,
  nowIso: string,
): Promise<ExtractedTodo[]> {
  const result = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system:
      `You parse spoken to-do dictations from a Vietnamese-Australian family. ` +
      `Input is a free-form transcript in ${inputLanguage === "vi" ? "Vietnamese" : "English"} ` +
      `that may contain multiple discrete tasks separated by commas, "and", "rồi", or pauses. ` +
      `Split into individual items and return strict JSON only — no prose, no code fences. ` +
      ` ` +
      `Shape: {"items": [{"text_vi": string, "text_en": string, "due_at": string | null, "assignee_role": "parent" | "child" | "any"}]}. ` +
      ` ` +
      `Rules:\n` +
      `- text_vi: warm, formal Vietnamese register for an elder ("Mua thuốc cho mẹ"). Plain imperative phrase.\n` +
      `- text_en: clear Australian English ("Buy mum's medication"). Plain imperative phrase.\n` +
      `- due_at: if the speaker mentioned a day/date (e.g. "thứ Sáu", "Friday", "tomorrow", "next week", "ngày mai"), return ISO 8601 timestamp anchored to current time = ${nowIso}. Use 09:00 local Australia/Sydney time. If no date mentioned, null.\n` +
      `- assignee_role: "parent" if the task names the parent ("ba", "mẹ", "mum", "dad"); "child" if names the child; else "any".\n` +
      `- Keep each item as a single short imperative sentence (max ~12 words).\n` +
      `- Drop filler words like "ừm", "you know", "let me think".\n` +
      `- If the transcript has only ONE task, return one item.\n` +
      `- If the transcript is empty or only filler, return {"items": []}.\n` +
      `- Preserve official Australian institution names in English in both languages (Medicare, Centrelink, ATO).`,
    messages: [{ role: "user", content: transcript }],
  });

  const block = result.content[0];
  if (block?.type !== "text") return [];

  const raw = block.text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();

  try {
    const parsed = JSON.parse(raw) as { items?: ExtractedTodo[] };
    if (!Array.isArray(parsed.items)) return [];
    return parsed.items
      .filter(
        (i) =>
          typeof i?.text_vi === "string" &&
          typeof i?.text_en === "string" &&
          i.text_vi.trim().length > 0,
      )
      .map((i) => ({
        text_vi: i.text_vi.trim(),
        text_en: i.text_en.trim(),
        due_at:
          typeof i.due_at === "string" && i.due_at.trim().length > 0
            ? i.due_at
            : null,
        assignee_role:
          i.assignee_role === "parent" ||
          i.assignee_role === "child" ||
          i.assignee_role === "any"
            ? i.assignee_role
            : "any",
      }));
  } catch {
    return [];
  }
}
