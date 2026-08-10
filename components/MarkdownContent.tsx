"use client";

import { useMemo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { autoLinkAustralianContacts } from "@/lib/markdown";

interface MarkdownContentProps {
  /** Raw markdown from Claude or a user field. */
  children: string;
  /**
   * Optional class on the wrapping div — callers can override text
   * color / size / spacing to fit their context (message bubble vs
   * answer card vs streaming region).
   */
  className?: string;
}

/**
 * Render Claude's markdown output as real HTML — headings, ordered and
 * unordered lists, bold/italic, links, tables, blockquotes, code, and
 * horizontal rules — with two Noi-specific twists:
 *
 *   1. Bare Australian phone numbers and gov/service domains are turned
 *      into real links via pre-processing (see lib/markdown). So "call
 *      1800 008 540" gives you a tel:-tappable button without asking
 *      the model to remember to emit link syntax.
 *
 *   2. All rendered links get target=_blank rel=noopener + the same
 *      accent styling used everywhere else in the app, so a link inside
 *      an answer is visually consistent with links in a diary card.
 *
 * Component overrides keep the design language on-token:
 *   - h1/h2/h3 use the type scale (title / lead / body-with-weight)
 *   - lists get proper marker + spacing
 *   - hr is a thin `line` divider, not a bold rule
 *
 * This is the ONLY place we render markdown from the model. Anywhere
 * else — thread card previews, notifications, search — must go through
 * stripMarkdown() first (lib/markdown.ts).
 */
export function MarkdownContent({ children, className = "" }: MarkdownContentProps) {
  const md = useMemo(() => autoLinkAustralianContacts(children ?? ""), [children]);

  return (
    <div className={`space-y-3 leading-relaxed ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {md}
      </ReactMarkdown>
    </div>
  );
}

const components: Components = {
  h1: ({ children }) => (
    <h1 className="text-title font-medium text-ink mt-4 first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-lead font-medium text-ink mt-3 first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-body font-medium text-ink mt-2 first:mt-0">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="text-body font-medium text-ink mt-2 first:mt-0">{children}</h4>
  ),
  p: ({ children }) => <p className="text-body">{children}</p>,
  ul: ({ children }) => (
    <ul className="list-disc pl-5 space-y-1.5 marker:text-ink-3">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal pl-5 space-y-1.5 marker:text-ink-3 marker:font-medium">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="text-body pl-1">{children}</li>,
  strong: ({ children }) => <strong className="font-medium text-ink">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  a: ({ href, children }) => {
    const isTel = typeof href === "string" && href.startsWith("tel:");
    return (
      <a
        href={href}
        {...(isTel
          ? {}
          : { target: "_blank", rel: "noopener noreferrer" })}
        className="text-green underline underline-offset-2 decoration-green/40 hover:decoration-green transition-colors"
      >
        {children}
      </a>
    );
  },
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-line pl-4 italic text-ink-2">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="border-line my-4" />,
  code: ({ children }) => (
    <code className="rounded bg-line/40 px-1.5 py-0.5 text-body-sm font-mono">
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="rounded-control bg-line/40 p-3 overflow-x-auto text-body-sm font-mono">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse text-body-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-line bg-line/30 px-3 py-2 text-left font-medium">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-line px-3 py-2 align-top">{children}</td>
  ),
};
