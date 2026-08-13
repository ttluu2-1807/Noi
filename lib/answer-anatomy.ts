/**
 * Split a Claude answer into its anatomy sections per the system prompt
 * contract (see lib/system-prompt.ts → "Response format — the Answer
 * anatomy"). Pure string/parse work — no React, safe on server + client.
 *
 * The anatomy Claude produces:
 *   1. Summary line (first paragraph)
 *   2. Numbered steps (an ordered list)
 *   3. Optional callout (blockquote)
 *   4. Links inline
 *   5. Optional "### Add to your list" section with a bullet list
 *
 * We split off (5) — everything else stays intact for the markdown
 * renderer to handle normally. The list items become chips beneath
 * the answer body that tap-to-add into family_todos.
 */

export interface VocabTerm {
  en: string;
  vi: string;
}

export interface AnatomySplit {
  /** Everything except the "Add to your list" + "Words to know"
   *  sections — feed to MarkdownContent. */
  body: string;
  /** Suggested to-do items (raw text, one per bullet). Empty if none. */
  suggestedTodos: string[];
  /** Bilingual term pairs from the "Words to know" section. Empty if none. */
  vocab: VocabTerm[];
}

// Match a heading (### or ####) whose text is any variant of "add to
// your list" / "add to list" / Vietnamese equivalents, then everything
// after it up to a horizontal rule / next heading / end of string.
const SUGGEST_HEADING_RE =
  /^\s*#{2,4}\s+(?:add[- ]?to[- ]?(?:your|the)?[- ]?list|(?:thêm|đưa)\s+vào\s+(?:danh\s+sách|to[- ]?do))\s*$/im;

// Same shape, matching "Words to know" / "Từ vựng" / etc.
const VOCAB_HEADING_RE =
  /^\s*#{2,4}\s+(?:words?\s+to\s+know|glossary|(?:từ|thuật ngữ)\s+(?:cần\s+)?(?:biết|học))\s*$/im;

export function splitAnswerAnatomy(md: string): AnatomySplit {
  if (!md) return { body: "", suggestedTodos: [], vocab: [] };

  // Lift each section separately. We do them in sequence rather than
  // parallel so the "body" is what remains after both are removed.
  const [afterTodos, suggestedTodos] = extractSection(md, SUGGEST_HEADING_RE, cleanTodo);
  const [afterVocab, vocabLines] = extractSection(afterTodos, VOCAB_HEADING_RE, (s) => s);

  const vocab: VocabTerm[] = [];
  for (const line of vocabLines) {
    // Support both "en = vi" and "en — vi" and "en: vi" as separators;
    // Claude sometimes drifts between them. First non-word char run
    // between two non-empty sides wins.
    const m = line.match(/^(.+?)\s*(?:=|—|–|-\s|:)\s*(.+?)\s*$/);
    if (!m) continue;
    const en = m[1].replace(/^\*+|\*+$/g, "").trim();
    const vi = m[2].replace(/^\*+|\*+$/g, "").trim();
    if (en && vi) vocab.push({ en, vi });
  }

  return {
    body: afterVocab.trim(),
    suggestedTodos: suggestedTodos.slice(0, 8),
    vocab: vocab.slice(0, 8),
  };
}

function extractSection(
  md: string,
  headingRe: RegExp,
  transform: (line: string) => string,
): [rest: string, bullets: string[]] {
  const match = md.match(headingRe);
  if (!match || match.index == null) return [md, []];
  const body = md.slice(0, match.index).trimEnd();
  const after = md.slice(match.index + match[0].length);
  const boundary = after.search(/^\s*(?:#{1,6}\s|---\s*$)/m);
  const block = boundary === -1 ? after : after.slice(0, boundary);
  const trailing = boundary === -1 ? "" : after.slice(boundary);

  const bullets: string[] = [];
  for (const line of block.split(/\r?\n/)) {
    const m = line.match(/^\s*[-*+]\s+(.+?)\s*$/);
    if (m) bullets.push(transform(m[1]));
  }

  const merged = `${body}${trailing ? `\n\n${trailing.trim()}` : ""}`;
  return [merged, bullets];
}

function cleanTodo(raw: string): string {
  // Strip surrounding markdown emphasis + trailing punctuation the
  // model sometimes adds ("Renew Medicare card.").
  return raw
    .replace(/^(\*\*|__|\*|_)(.+?)\1$/, "$2")
    .replace(/[.。]+$/, "")
    .trim();
}
