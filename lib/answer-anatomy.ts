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

export interface AnatomySplit {
  /** Everything except the "Add to your list" section — feed to MarkdownContent. */
  body: string;
  /** Suggested to-do items (raw text, one per bullet). Empty if none. */
  suggestedTodos: string[];
}

// Match a heading (### or ####) whose text is any variant of "add to
// your list" / "add to list" / Vietnamese equivalents, then everything
// after it up to a horizontal rule / next heading / end of string.
const SUGGEST_HEADING_RE =
  /^\s*#{2,4}\s+(?:add[- ]?to[- ]?(?:your|the)?[- ]?list|(?:thêm|đưa)\s+vào\s+(?:danh\s+sách|to[- ]?do))\s*$/im;

export function splitAnswerAnatomy(md: string): AnatomySplit {
  if (!md) return { body: "", suggestedTodos: [] };
  const match = md.match(SUGGEST_HEADING_RE);
  if (!match || match.index == null) {
    return { body: md.trim(), suggestedTodos: [] };
  }
  const body = md.slice(0, match.index).trimEnd();
  const after = md.slice(match.index + match[0].length);
  // Parse bullets until the next section boundary (## / --- / EOF).
  const boundary = after.search(/^\s*(?:#{1,6}\s|---\s*$)/m);
  const suggestBlock = boundary === -1 ? after : after.slice(0, boundary);
  const trailing = boundary === -1 ? "" : after.slice(boundary);

  const suggestedTodos: string[] = [];
  for (const line of suggestBlock.split(/\r?\n/)) {
    const m = line.match(/^\s*[-*+]\s+(.+?)\s*$/);
    if (m) suggestedTodos.push(cleanTodo(m[1]));
  }

  const merged = `${body}${trailing ? `\n\n${trailing.trim()}` : ""}`;
  return { body: merged.trim(), suggestedTodos: suggestedTodos.slice(0, 8) };
}

function cleanTodo(raw: string): string {
  // Strip surrounding markdown emphasis + trailing punctuation the
  // model sometimes adds ("Renew Medicare card.").
  return raw
    .replace(/^(\*\*|__|\*|_)(.+?)\1$/, "$2")
    .replace(/[.。]+$/, "")
    .trim();
}
