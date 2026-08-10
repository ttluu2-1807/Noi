/**
 * Markdown text helpers.
 *
 * Two things live here:
 *   1. stripMarkdown(text) — for previews (thread cards, notifications,
 *      search results). Removes syntax markers so `**bold**` becomes
 *      `bold` rather than leaking asterisks into a card.
 *   2. autoLinkAustralianContacts(md) — pre-processes a markdown string
 *      to convert bare AU phone numbers and gov/service domains into
 *      real markdown links, so a call button appears without asking
 *      the model to emit link syntax.
 *
 * Both are pure string→string transforms — safe on the server and the
 * client. The React-side renderer lives in components/MarkdownContent.
 */

// -- Australian phone / domain patterns (mirror lib/render-text.tsx) --
const PHONE_PATTERNS: RegExp[] = [
  /\b1(?:800|300)[\s-]?\d{3}[\s-]?\d{3}\b/g,
  /\b13\d[\s-]?\d{3}\b/g,
  /\b13[\s-]?\d{2}[\s-]?\d{2}\b/g,
  /\b04\d{2}[\s-]?\d{3}[\s-]?\d{3}\b/g,
  /\(0\d\)[\s-]?\d{4}[\s-]?\d{4}/g,
  /\+61[\s-]?\d[\s-]?\d{4}[\s-]?\d{4}/g,
];
const BARE_DOMAIN_RE =
  /\b(?:[a-z0-9-]+\.)+(?:gov\.au|com\.au|org\.au|net\.au|edu\.au)\b/gi;

/** Convert `1800 008 540` → tel: href (digits only, keeps leading +). */
function telHref(raw: string): string {
  return "tel:" + raw.replace(/[^\d+]/g, "");
}

/**
 * Wrap AU phone numbers + bare AU domains in markdown link syntax so
 * react-markdown renders them as tappable anchors. Skips matches that
 * are already inside a `[text](url)` link or a fenced code block, so
 * we don't double-wrap or corrupt code samples.
 */
export function autoLinkAustralianContacts(md: string): string {
  if (!md) return md;

  // Split on fenced code blocks so we don't rewrite inside them.
  // Each pair of ``` … ``` becomes a segment we leave untouched.
  const segments = md.split(/(```[\s\S]*?```)/g);
  return segments
    .map((segment, i) => {
      // Odd indices are the ``` … ``` blocks (leave alone).
      if (i % 2 === 1) return segment;
      return rewriteSegment(segment);
    })
    .join("");
}

function rewriteSegment(text: string): string {
  // Track spans that must NOT be rewritten (existing markdown links,
  // inline code). We collect their ranges first, then only rewrite
  // outside them.
  const guarded: Array<[number, number]> = [];

  // Existing markdown links: [text](url) or ![alt](url)
  const linkRe = /!?\[[^\]]*\]\([^)]+\)/g;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(text)) !== null) {
    guarded.push([m.index, m.index + m[0].length]);
  }
  // Inline code: `x`
  const codeRe = /`[^`]+`/g;
  while ((m = codeRe.exec(text)) !== null) {
    guarded.push([m.index, m.index + m[0].length]);
  }

  const isGuarded = (start: number, end: number) =>
    guarded.some(([gs, ge]) => start < ge && end > gs);

  interface Match {
    start: number;
    end: number;
    md: string;
  }
  const matches: Match[] = [];

  for (const pattern of PHONE_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      if (isGuarded(start, end)) continue;
      matches.push({
        start,
        end,
        md: `[${match[0]}](${telHref(match[0])})`,
      });
    }
  }

  BARE_DOMAIN_RE.lastIndex = 0;
  let dm: RegExpExecArray | null;
  while ((dm = BARE_DOMAIN_RE.exec(text)) !== null) {
    const start = dm.index;
    const end = start + dm[0].length;
    if (isGuarded(start, end)) continue;
    matches.push({
      start,
      end,
      md: `[${dm[0]}](https://${dm[0]})`,
    });
  }

  if (matches.length === 0) return text;

  // Sort earliest-first; drop later overlaps.
  matches.sort((a, b) => a.start - b.start);
  const filtered: Match[] = [];
  let cursor = 0;
  for (const match of matches) {
    if (match.start < cursor) continue;
    filtered.push(match);
    cursor = match.end;
  }

  const out: string[] = [];
  cursor = 0;
  for (const match of filtered) {
    if (match.start > cursor) out.push(text.slice(cursor, match.start));
    out.push(match.md);
    cursor = match.end;
  }
  if (cursor < text.length) out.push(text.slice(cursor));
  return out.join("");
}

/**
 * Strip markdown syntax from text for use in previews — thread cards,
 * notifications, search results, list snippets. Never renders inside a
 * markdown component; treat it as "what would the reader see if they
 * saw the rendered text as plain prose".
 *
 * Handles: bold/italic markers, headings, list bullets, blockquotes,
 * horizontal rules, inline + fenced code, link syntax (keeps the link
 * text, drops the URL), image syntax (drops entirely), HTML tags,
 * and normalises whitespace.
 */
export function stripMarkdown(md: string): string {
  if (!md) return "";
  let s = md;

  // Fenced code blocks and HTML — drop wholesale (previews shouldn't
  // include either).
  s = s.replace(/```[\s\S]*?```/g, "");
  s = s.replace(/<[^>]+>/g, "");

  // Images: ![alt](url) → ""
  s = s.replace(/!\[[^\]]*\]\([^)]+\)/g, "");
  // Links: [text](url) → text
  s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

  // Inline code: `x` → x
  s = s.replace(/`([^`]+)`/g, "$1");

  // Horizontal rules on their own line.
  s = s.replace(/^[\s]*[-*_]{3,}[\s]*$/gm, "");

  // Headings: strip leading #s at line start.
  s = s.replace(/^#{1,6}\s+/gm, "");

  // Blockquote marker.
  s = s.replace(/^>\s?/gm, "");

  // List markers at line start: -, *, +, 1., 2.
  s = s.replace(/^\s*[-*+]\s+/gm, "");
  s = s.replace(/^\s*\d+\.\s+/gm, "");

  // Emphasis markers: **bold**, *italic*, __bold__, _italic_.
  s = s.replace(/(\*\*|__)(.+?)\1/g, "$2");
  s = s.replace(/(?<!\w)([*_])([^*_]+?)\1(?!\w)/g, "$2");

  // Collapse whitespace so a preview truncates cleanly.
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

/**
 * Truncate a plain-text string on a word boundary, appending `…` when
 * clipped. Safe for previews rendered next to a title.
 */
export function truncateOnWord(text: string, max: number): string {
  if (text.length <= max) return text;
  const clipped = text.slice(0, max);
  const lastSpace = clipped.lastIndexOf(" ");
  return (lastSpace > max * 0.6 ? clipped.slice(0, lastSpace) : clipped).trim() + "…";
}
