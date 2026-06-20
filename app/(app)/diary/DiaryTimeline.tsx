"use client";

import Link from "next/link";
import { useMemo } from "react";
import { relativeTime } from "@/lib/relative-time";
import { tagColors } from "@/lib/tags";
import type { Language } from "@/lib/language-detect";

export interface DiaryRow {
  id: string;
  kind: "event" | "decision" | "note";
  title_vi: string;
  title_en: string;
  body_vi: string | null;
  body_en: string | null;
  context_vi: string | null;
  context_en: string | null;
  event_date: string | null;
  tags: string[] | null;
  attachments: Array<{ url?: string; mime?: string }> | null;
  created_at: string;
}

interface DiaryTimelineProps {
  rows: DiaryRow[];
  language: Language;
}

const KIND_ICON: Record<DiaryRow["kind"], string> = {
  event: "📅",
  decision: "🤔",
  note: "📝",
};

const KIND_LABEL: Record<Language, Record<DiaryRow["kind"], string>> = {
  vi: { event: "Sự kiện", decision: "Quyết định", note: "Ghi chú" },
  en: { event: "Event", decision: "Decision", note: "Note" },
};

const PREVIEW_MAX = 140;

/**
 * Reverse-chronological diary timeline, grouped by year. Each entry
 * card shows title + kind badge + date + an excerpt of either body OR
 * context (whichever is more useful given the kind).
 *
 * For decisions specifically, we surface the "why" (context) as an
 * italic excerpt — that's the JTBD the user explicitly named: not
 * losing the reasoning behind family decisions over time.
 */
export function DiaryTimeline({ rows, language }: DiaryTimelineProps) {
  // Group by year of either event_date (if set) or created_at, so an
  // event captured today but dated 2024 shows in the 2024 section.
  const groups = useMemo(() => {
    const byYear = new Map<string, DiaryRow[]>();
    for (const row of rows) {
      const dateString = row.event_date ?? row.created_at;
      const year = String(new Date(dateString).getFullYear());
      const arr = byYear.get(year) ?? [];
      arr.push(row);
      byYear.set(year, arr);
    }
    return Array.from(byYear.entries()).sort(
      ([a], [b]) => Number(b) - Number(a),
    );
  }, [rows]);

  return (
    <div className="space-y-8">
      {groups.map(([year, items]) => (
        <section key={year} className="space-y-3">
          <h2 className="text-sm uppercase tracking-wide text-muted/80">
            {year}
          </h2>
          <ul className="space-y-2">
            {items.map((row) => (
              <li key={row.id}>
                <DiaryCard row={row} language={language} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function DiaryCard({
  row,
  language,
}: {
  row: DiaryRow;
  language: Language;
}) {
  const title =
    (language === "vi" ? row.title_vi : row.title_en) ??
    row.title_vi ??
    row.title_en ??
    "—";

  // Prefer the context as the excerpt for decisions; body otherwise.
  // Context is the "why" — for retrospective scanning, that's what
  // matters most.
  const context = language === "vi" ? row.context_vi : row.context_en;
  const body = language === "vi" ? row.body_vi : row.body_en;
  const excerptSource =
    row.kind === "decision" && context && context.trim().length > 0
      ? { text: context, isContext: true }
      : { text: body, isContext: false };

  const excerpt = excerptSource.text
    ? excerptSource.text.length > PREVIEW_MAX
      ? excerptSource.text.slice(0, PREVIEW_MAX).trim() + "…"
      : excerptSource.text
    : null;

  const dateLine = row.event_date
    ? new Date(row.event_date).toLocaleDateString(
        language === "vi" ? "vi-VN" : "en-AU",
        { day: "numeric", month: "short", year: "numeric" },
      )
    : relativeTime(row.created_at, language);

  const attachmentCount = Array.isArray(row.attachments)
    ? row.attachments.length
    : 0;

  return (
    <Link
      href={`/diary/${row.id}`}
      className="block rounded-card border border-line bg-white px-5 py-4 transition-all hover:border-accent/40 hover:shadow-sm active:scale-[0.995] animate-fade-rise"
    >
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-medium text-ink truncate flex-1 min-w-0 flex items-center gap-2">
            <span aria-hidden>{KIND_ICON[row.kind]}</span>
            <span className="truncate">{title}</span>
          </h3>
          <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-line/60 text-muted">
            {KIND_LABEL[language][row.kind]}
          </span>
        </div>

        {excerpt && (
          <p
            className={`text-sm line-clamp-2 ${
              excerptSource.isContext ? "italic text-muted" : "text-muted"
            }`}
          >
            {excerptSource.isContext && (
              <span className="text-muted/60">
                {language === "vi" ? "Vì sao: " : "Why: "}
              </span>
            )}
            {excerpt}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted/80">
          {(row.tags ?? []).slice(0, 4).map((tag) => {
            const c = tagColors(tag);
            return (
              <span
                key={tag}
                className="rounded-full border px-2 py-0.5"
                style={{
                  backgroundColor: c.bg,
                  color: c.fg,
                  borderColor: c.border,
                }}
              >
                {tag}
              </span>
            );
          })}
          {(row.tags?.length ?? 0) > 4 && (
            <span className="text-muted/60">
              +{(row.tags?.length ?? 0) - 4}
            </span>
          )}
          {attachmentCount > 0 && (
            <span className="inline-flex items-center gap-0.5">
              📎 {attachmentCount}
            </span>
          )}
          <time dateTime={row.event_date ?? row.created_at} className="ml-auto">
            {dateLine}
          </time>
        </div>
      </div>
    </Link>
  );
}
