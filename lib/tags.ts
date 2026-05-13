import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Deterministic tag color. Stable hue per tag name across the app so
 * "Medicare" is always the same colour everywhere, "Tax" is always
 * different. Uses HSL so we can pick light-but-saturated backgrounds
 * the dark ink text reads cleanly against.
 */
export function tagColors(name: string): { bg: string; fg: string; border: string } {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  const hue = Math.abs(hash) % 360;
  return {
    bg: `hsl(${hue}, 70%, 94%)`,
    fg: `hsl(${hue}, 60%, 30%)`,
    border: `hsl(${hue}, 60%, 80%)`,
  };
}

/**
 * Normalise a tag — lowercase, trim, collapse internal whitespace.
 * Keeps the family's tag taxonomy from drifting (e.g. " Medicare ",
 * "medicare", "MEDICARE" all reduce to "medicare").
 */
export function normaliseTag(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Fetch the unique set of tags currently in use across a family's
 * threads. Used to power the autocomplete suggestions in TagSelector.
 *
 * We unnest the tags array and dedupe in JS rather than in SQL —
 * Supabase JS doesn't expose `distinct` on RPC-less queries, and the
 * family-scoped set is small.
 */
export async function listFamilyTags(
  supabase: SupabaseClient,
  familySpaceId: string,
): Promise<string[]> {
  const { data } = await supabase
    .from("threads")
    .select("tags")
    .eq("family_space_id", familySpaceId);
  if (!data) return [];
  const set = new Set<string>();
  for (const row of data) {
    const tags = Array.isArray(row.tags) ? (row.tags as string[]) : [];
    for (const t of tags) {
      const n = normaliseTag(t);
      if (n) set.add(n);
    }
  }
  return Array.from(set).sort();
}
