import Link from "next/link";
import type { Language } from "@/lib/language-detect";
import { relativeTime } from "@/lib/relative-time";
import { tagColors } from "@/lib/tags";

export interface ThreadSummary {
  id: string;
  title_vi: string | null;
  title_en: string | null;
  /** Multi-tag array (Wave 2). Empty = untagged. */
  tags: string[] | null;
  status: string | null;
  updated_at: string;
  initiated_by_role: string | null;
}

/**
 * Optional snippet shown under the title. The dashboard server queries
 * the latest message for each thread and passes it in.
 */
export interface LatestMessageSummary {
  content_vi: string | null;
  content_en: string | null;
  sender_role: "parent" | "child" | "assistant" | null;
  has_attachment: boolean;
}

interface ThreadCardProps {
  thread: ThreadSummary;
  language: Language;
  basePath: "/parent/thread" | "/child/thread";
  /** Adds a teal left border. */
  highlight?: boolean;
  /** Optional last-message preview. */
  latestMessage?: LatestMessageSummary | null;
}

const ROLE_PREFIX: Record<Language, Record<NonNullable<LatestMessageSummary["sender_role"]>, string>> = {
  vi: { parent: "Bạn", child: "Con", assistant: "Noi" },
  en: { parent: "Parent", child: "Child", assistant: "Noi" },
};

const STATUS_LABEL: Record<Language, Record<"open" | "resolved", string>> = {
  vi: { open: "Đang mở", resolved: "Đã xong" },
  en: { open: "Open", resolved: "Done" },
};

const PROCESSING: Record<Language, string> = {
  vi: "Đang xử lý...",
  en: "Processing…",
};

const PREVIEW_MAX = 90; // chars before ellipsis

export function ThreadCard({
  thread,
  language,
  basePath,
  highlight,
  latestMessage,
}: ThreadCardProps) {
  const primary =
    (language === "vi" ? thread.title_vi : thread.title_en) ??
    thread.title_vi ??
    thread.title_en ??
    PROCESSING[language];

  const previewRaw =
    (language === "vi"
      ? latestMessage?.content_vi
      : latestMessage?.content_en) ?? "";
  const preview = previewRaw.replace(/\s+/g, " ").trim();
  const previewTruncated =
    preview.length > PREVIEW_MAX ? preview.slice(0, PREVIEW_MAX).trim() + "…" : preview;

  const senderPrefix = latestMessage?.sender_role
    ? ROLE_PREFIX[language][latestMessage.sender_role]
    : null;

  const status = thread.status === "resolved" ? "resolved" : "open";

  return (
    <Link
      href={`${basePath}/${thread.id}`}
      className={`group block rounded-card border bg-white px-5 py-4 transition-all hover:border-accent/40 hover:shadow-sm active:scale-[0.995] animate-fade-rise ${
        highlight && status === "open"
          ? "border-l-4 border-l-accent border-line"
          : "border-line"
      }`}
    >
      <div className="space-y-2">
        {/* Title + status row */}
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-medium text-ink truncate flex-1 min-w-0">
            {primary}
          </h3>
          <span
            className={`shrink-0 text-xs px-2 py-0.5 rounded-full ${
              status === "resolved"
                ? "bg-accent/10 text-accent"
                : "bg-line/60 text-muted"
            }`}
          >
            {STATUS_LABEL[language][status]}
          </span>
        </div>

        {/* Preview snippet */}
        {previewTruncated && (
          <div className="flex items-start gap-2 text-sm text-muted">
            {latestMessage?.has_attachment && (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                className="h-4 w-4 shrink-0 mt-0.5 text-accent"
                aria-label="Has attachment"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 16l4-4m0 0l-4-4m4 4h12a4 4 0 010 8h-2M4 8V4a2 2 0 012-2h12a2 2 0 012 2v4"
                />
              </svg>
            )}
            <span className="line-clamp-2">
              {senderPrefix && (
                <span className="text-muted/80">{senderPrefix}: </span>
              )}
              {previewTruncated}
            </span>
          </div>
        )}

        {/* Meta row: tags (colour-coded) + relative time */}
        <div className="flex items-center gap-1.5 flex-wrap text-xs text-muted/80">
          {(thread.tags ?? []).slice(0, 4).map((tag) => {
            const c = tagColors(tag);
            return (
              <span
                key={tag}
                className="rounded-full border px-2 py-0.5"
                style={{ backgroundColor: c.bg, color: c.fg, borderColor: c.border }}
              >
                {tag}
              </span>
            );
          })}
          {(thread.tags?.length ?? 0) > 4 && (
            <span className="text-muted/60">
              +{(thread.tags?.length ?? 0) - 4}
            </span>
          )}
          <time dateTime={thread.updated_at} className="ml-auto">
            {relativeTime(thread.updated_at, language)}
          </time>
        </div>
      </div>
    </Link>
  );
}
