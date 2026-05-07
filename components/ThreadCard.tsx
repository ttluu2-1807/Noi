import Link from "next/link";
import type { Language } from "@/lib/language-detect";

export interface ThreadSummary {
  id: string;
  title_vi: string | null;
  title_en: string | null;
  category_tag: string | null;
  status: string | null;
  updated_at: string;
  initiated_by_role: string | null;
}

interface ThreadCardProps {
  thread: ThreadSummary;
  language: Language;
  /** Base path — /parent/thread or /child/thread. */
  basePath: "/parent/thread" | "/child/thread";
  /** When true, adds the "new" teal left border. */
  highlight?: boolean;
}

export function ThreadCard({ thread, language, basePath, highlight }: ThreadCardProps) {
  const primary =
    (language === "vi" ? thread.title_vi : thread.title_en) ??
    thread.title_vi ??
    thread.title_en ??
    (language === "vi" ? "Đang xử lý..." : "Processing…");

  const secondary = language === "vi" ? thread.title_en : thread.title_vi;

  return (
    <Link
      href={`${basePath}/${thread.id}`}
      className={`block rounded-card border bg-white px-5 py-4 transition-colors hover:border-accent/40 ${
        highlight ? "border-l-4 border-l-accent border-line" : "border-line"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="font-medium text-ink truncate">{primary}</div>
          {secondary && secondary !== primary && (
            <div className="text-sm text-muted mt-0.5 truncate">{secondary}</div>
          )}
          <div className="text-xs text-muted/80 mt-2 flex items-center gap-2">
            {thread.category_tag && (
              <span className="rounded-full bg-accent/10 text-accent px-2 py-0.5">
                {thread.category_tag}
              </span>
            )}
            <time dateTime={thread.updated_at}>
              {new Date(thread.updated_at).toLocaleDateString(
                language === "vi" ? "vi-VN" : "en-AU",
                { day: "numeric", month: "short" },
              )}
            </time>
            {thread.status === "resolved" && (
              <span className="text-accent">
                {language === "vi" ? "Đã xong" : "Done"}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
