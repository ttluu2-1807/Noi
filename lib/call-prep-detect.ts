/**
 * Client-safe helpers for the Call Prep feature — regex-based
 * detection only, NO server dependencies (no Anthropic SDK, no
 * Supabase, nothing that shouldn't ship in a browser bundle).
 *
 * Kept in a separate file from lib/call-prep.ts because that file
 * imports the Anthropic SDK for its generator. When a client
 * component imports even one export from a module, the whole module
 * (and its full transitive dep tree) ships to the browser — so
 * pulling `detectCallInAnswer` from lib/call-prep.ts silently dragged
 * the Anthropic SDK into the client bundle, which throws at runtime
 * ("It looks like you're running in a browser-like environment").
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

/**
 * Scan model output for an Australian phone number + likely
 * institution name. First phone match + first institution match win.
 * Returns null if no phone number appears.
 */
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
  return { service: "the service", phone };
}
