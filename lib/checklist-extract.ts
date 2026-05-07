import { anthropic, MODEL } from "./anthropic";

export interface ChecklistItem {
  text_vi: string;
  text_en: string;
}

/**
 * Second-pass Claude call that pulls any user-actionable checklist items
 * out of a response. Returns both Vietnamese and English so the item row
 * can be saved once and read by either side of the family.
 *
 * Heuristic: only the "- [ ] ..." lines become checklist rows. Numbered
 * steps stay in the message body (they're procedural, not things the
 * user gathers). This keeps checklists aligned with the system prompt,
 * which only uses "- [ ]" for gather/prepare tasks.
 */
export async function extractChecklist(
  responseText: string,
): Promise<ChecklistItem[]> {
  // Cheap early-out so we never pay for a second call when there are
  // obviously no checkbox-style lines in the response.
  if (!/^\s*-\s*\[\s*\]\s+/m.test(responseText)) return [];

  const result = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system:
      "Extract any checklist items (lines formatted as '- [ ]') from the user's message. " +
      "Return strict JSON only — no prose, no code fences, no preamble. " +
      'Shape: {"items": [{"text_vi": string, "text_en": string}]}. ' +
      "For each item, provide both the Vietnamese and English version of the item text. " +
      "If there are no checklist items, return {\"items\": []}. " +
      "Preserve official Australian terms (Medicare, Centrelink, etc.) in both languages.",
    messages: [{ role: "user", content: responseText }],
  });

  const block = result.content[0];
  if (block?.type !== "text") return [];

  // Tolerate code-fence wrapping even though we asked for none.
  const raw = block.text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();

  try {
    const parsed = JSON.parse(raw) as { items?: ChecklistItem[] };
    if (!Array.isArray(parsed.items)) return [];
    return parsed.items
      .filter((i) => typeof i?.text_vi === "string" && typeof i?.text_en === "string")
      .map((i) => ({ text_vi: i.text_vi.trim(), text_en: i.text_en.trim() }))
      .filter((i) => i.text_vi && i.text_en);
  } catch {
    return [];
  }
}
