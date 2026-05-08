import { Fragment } from "react";

/**
 * Auto-link Australian phone numbers and obvious URLs inside plain text
 * (the format Claude returns). Returns React fragments so the caller can
 * use them in JSX directly. Preserves the original whitespace so we can
 * still wrap the result in a `whitespace-pre-wrap` div.
 *
 * Why we do this client-side rather than asking Claude to emit Markdown:
 *   - Markdown rendering brings a parser, link sanitisation, and a whole
 *     pipeline we don't need for the few patterns that matter.
 *   - We only auto-link three things: tel: numbers, http(s) URLs, and
 *     plain domain references (e.g. "scamwatch.gov.au"). That's it.
 *   - Phone numbers as `tel:` links are the single biggest mobile UX
 *     win — every "call 1800 008 540" line becomes a one-tap dial.
 */

// Australian phone formats Noi commonly emits:
//   1800 / 1300 numbers:    1800 008 540     1800-008-540    1800008540
//   13xx three-digit-ext:   132 011          13 28 61        13 22 11
//   13 short codes:         13 SOS  (rare but technically valid)
//   Mobile:                 04XX XXX XXX     +61 4XX XXX XXX
//   Landline:               (02) 9876 5432   02 9876 5432    +61 2 9876 5432
//
// We keep it conservative — false positives on this audience matter
// (an elder dialling the wrong number is worse than not auto-linking).
const PHONE_PATTERNS: Array<RegExp> = [
  // Toll-free / local-rate: 1800 / 1300 + 6 digits
  /\b1(?:800|300)[\s-]?\d{3}[\s-]?\d{3}\b/g,
  // Three-digit short codes: 13X XXX  (Medicare 132 011, ATO 132 861, etc.)
  /\b13\d[\s-]?\d{3}\b/g,
  // Six-digit short codes: 13 XX XX  (Centrelink 13 22 11, ATO 13 28 61)
  /\b13[\s-]?\d{2}[\s-]?\d{2}\b/g,
  // Mobile: 04XX XXX XXX
  /\b04\d{2}[\s-]?\d{3}[\s-]?\d{3}\b/g,
  // Landline with area code in parens: (0X) XXXX XXXX
  /\(0\d\)[\s-]?\d{4}[\s-]?\d{4}/g,
  // International: +61 X XXXX XXXX
  /\+61[\s-]?\d[\s-]?\d{4}[\s-]?\d{4}/g,
];

const URL_RE = /https?:\/\/[^\s)<>"']+/g;
// Common Australian gov / service domains we mention but Claude often
// emits without a protocol. We auto-link those too.
const BARE_DOMAIN_RE =
  /\b(?:[a-z0-9-]+\.)+(?:gov\.au|com\.au|org\.au|net\.au|edu\.au)\b/gi;

interface Match {
  start: number;
  end: number;
  type: "phone" | "url" | "domain";
  raw: string;
}

function findMatches(text: string): Match[] {
  const matches: Match[] = [];

  for (const pattern of PHONE_PATTERNS) {
    pattern.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(text)) !== null) {
      matches.push({
        start: m.index,
        end: m.index + m[0].length,
        type: "phone",
        raw: m[0],
      });
    }
  }

  URL_RE.lastIndex = 0;
  let urlMatch: RegExpExecArray | null;
  while ((urlMatch = URL_RE.exec(text)) !== null) {
    matches.push({
      start: urlMatch.index,
      end: urlMatch.index + urlMatch[0].length,
      type: "url",
      raw: urlMatch[0],
    });
  }

  BARE_DOMAIN_RE.lastIndex = 0;
  let domainMatch: RegExpExecArray | null;
  while ((domainMatch = BARE_DOMAIN_RE.exec(text)) !== null) {
    // Skip if this domain is already inside a matched URL.
    const start = domainMatch.index;
    const overlap = matches.some(
      (existing) =>
        existing.type === "url" && start >= existing.start && start < existing.end,
    );
    if (overlap) continue;
    matches.push({
      start,
      end: start + domainMatch[0].length,
      type: "domain",
      raw: domainMatch[0],
    });
  }

  // Sort + de-overlap (keep earliest, longest first match).
  matches.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start));
  const filtered: Match[] = [];
  let cursor = 0;
  for (const m of matches) {
    if (m.start < cursor) continue;
    filtered.push(m);
    cursor = m.end;
  }
  return filtered;
}

/** Strip everything that isn't a digit so we can build a clean tel: href. */
function telHref(raw: string): string {
  return "tel:" + raw.replace(/[^\d+]/g, "");
}

export function renderTextWithLinks(text: string): React.ReactNode {
  if (!text) return text;
  const matches = findMatches(text);
  if (matches.length === 0) return text;

  const out: React.ReactNode[] = [];
  let cursor = 0;
  matches.forEach((m, i) => {
    if (m.start > cursor) out.push(text.slice(cursor, m.start));

    if (m.type === "phone") {
      out.push(
        <a
          key={`p-${i}`}
          href={telHref(m.raw)}
          className="text-accent underline underline-offset-2 hover:opacity-80"
        >
          {m.raw}
        </a>,
      );
    } else if (m.type === "url") {
      out.push(
        <a
          key={`u-${i}`}
          href={m.raw}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent underline underline-offset-2 hover:opacity-80"
        >
          {m.raw}
        </a>,
      );
    } else {
      // bare domain — prepend https:// for the href
      out.push(
        <a
          key={`d-${i}`}
          href={`https://${m.raw}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent underline underline-offset-2 hover:opacity-80"
        >
          {m.raw}
        </a>,
      );
    }
    cursor = m.end;
  });
  if (cursor < text.length) out.push(text.slice(cursor));

  return <Fragment>{out}</Fragment>;
}
