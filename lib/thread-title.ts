import { anthropic, MODEL } from "./anthropic";

export interface ThreadTitles {
  title_vi: string;
  title_en: string;
}

/**
 * Generate a short (5–8 word) title for a thread based on its first
 * query + response. Produced in both languages so the parent sees
 * Vietnamese titles and the child sees English ones without any
 * runtime translation.
 */
export async function generateThreadTitles(
  firstUserQuery: string,
  firstAssistantResponse: string,
): Promise<ThreadTitles> {
  const result = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 256,
    system:
      "You write short thread titles (4–7 words each) summarising what a conversation is about. " +
      "Return strict JSON only — no prose, no code fences. " +
      'Shape: {"title_vi": string, "title_en": string}. ' +
      "The English title should be plain Australian English — clear and concrete. " +
      "The Vietnamese title should match the same meaning, in a tone an elderly Vietnamese-Australian would find natural — no slang, no childish phrasing. " +
      "Keep Australian institution names in English in both languages (Medicare, Centrelink, myGov, ATO). " +
      "Examples: 'Renewing Medicare card' / 'Gia hạn thẻ Medicare', " +
      "'Disputing a phone bill' / 'Khiếu nại hoá đơn điện thoại', " +
      "'Booking a GP appointment' / 'Đặt lịch khám bác sĩ'. " +
      "No trailing punctuation. No quotation marks inside the strings.",
    messages: [
      {
        role: "user",
        content: `Question:\n${firstUserQuery}\n\nAnswer:\n${firstAssistantResponse}`,
      },
    ],
  });

  const block = result.content[0];
  if (block?.type !== "text") {
    return fallback(firstUserQuery);
  }

  const raw = block.text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();

  try {
    const parsed = JSON.parse(raw) as Partial<ThreadTitles>;
    if (typeof parsed.title_vi === "string" && typeof parsed.title_en === "string") {
      return {
        title_vi: parsed.title_vi.trim().slice(0, 80),
        title_en: parsed.title_en.trim().slice(0, 80),
      };
    }
  } catch {
    // fall through
  }
  return fallback(firstUserQuery);
}

/**
 * Fallback title if the model returns malformed JSON — use the first
 * chunk of the user's query verbatim for both languages so the UI
 * never shows an empty title.
 */
function fallback(query: string): ThreadTitles {
  const truncated = query.trim().replace(/\s+/g, " ").slice(0, 60);
  return { title_vi: truncated, title_en: truncated };
}
