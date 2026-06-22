import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { RealtimeBoundary } from "@/components/RealtimeBoundary";
import { tagColors } from "@/lib/tags";
import { DiaryDetailActions } from "./DiaryDetailActions";
import type { Language } from "@/lib/language-detect";


const T = {
  vi: {
    back: "Nhật ký",
    edit: "Sửa",
    delete: "Xoá",
    deleted: "Đã xoá",
    undo: "Hoàn tác",
    why: "Vì sao",
    photos: "Ảnh",
    related: "Liên kết với câu hỏi",
    kindEvent: "Sự kiện",
    kindDecision: "Quyết định",
    kindNote: "Ghi chú",
  },
  en: {
    back: "Diary",
    edit: "Edit",
    delete: "Delete",
    deleted: "Deleted",
    undo: "Undo",
    why: "Why",
    photos: "Photos",
    related: "Linked thread",
    kindEvent: "Event",
    kindDecision: "Decision",
    kindNote: "Note",
  },
} as const;

export default async function DiaryDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("language_preference, family_space_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.family_space_id) return null;
  const language = (profile.language_preference ?? "vi") as Language;
  const t = T[language];

  const { data: entry } = await supabase
    .from("diary_entries")
    .select(
      "id, kind, title_vi, title_en, body_vi, body_en, context_vi, context_en, event_date, tags, attachments, related_thread_id, deleted_at, created_at, updated_at",
    )
    .eq("id", params.id)
    .maybeSingle();
  if (!entry || entry.deleted_at) notFound();

  const title = language === "vi" ? entry.title_vi : entry.title_en;
  const body = language === "vi" ? entry.body_vi : entry.body_en;
  const context = language === "vi" ? entry.context_vi : entry.context_en;
  const attachments = (entry.attachments ?? []) as Array<{
    url?: string;
    mime?: string;
    name?: string;
  }>;

  const kindLabel =
    entry.kind === "event"
      ? t.kindEvent
      : entry.kind === "decision"
        ? t.kindDecision
        : t.kindNote;

  const formattedDate = entry.event_date
    ? new Date(entry.event_date).toLocaleDateString(
        language === "vi" ? "vi-VN" : "en-AU",
        { day: "numeric", month: "long", year: "numeric" },
      )
    : null;

  return (
    <RealtimeBoundary
      tables={["diary_entries"]}
      channelName={`diary-${entry.id}`}
      filter={`id=eq.${entry.id}`}
    >
      <main className="mx-auto max-w-md px-6 py-8 space-y-6">
        <header className="space-y-3">
          <Link
            href="/diary"
            className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className="h-4 w-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19l-7-7 7-7"
              />
            </svg>
            {t.back}
          </Link>

          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-line/60 text-muted">
                {kindLabel}
              </span>
              <h1 className="text-2xl font-medium leading-snug">{title}</h1>
              {formattedDate && (
                <p className="text-sm text-muted">{formattedDate}</p>
              )}
            </div>
            <DiaryDetailActions id={entry.id} language={language} />
          </div>
        </header>

        {body && (
          <section className="rounded-card border border-line bg-white p-5">
            <p className="whitespace-pre-wrap leading-relaxed">{body}</p>
          </section>
        )}

        {context && (
          <section className="rounded-card border border-line bg-accent/5 p-5 space-y-2">
            <div className="text-xs uppercase tracking-wide text-accent">
              {t.why}
            </div>
            <p className="whitespace-pre-wrap leading-relaxed italic">
              {context}
            </p>
          </section>
        )}

        {attachments.length > 0 && (
          <section className="space-y-2">
            <div className="text-xs uppercase tracking-wide text-muted">
              {t.photos}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {attachments.map((att, i) =>
                att.url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    key={i}
                    src={att.url}
                    alt={att.name ?? `photo ${i + 1}`}
                    className="w-full h-32 object-cover rounded-card border border-line"
                  />
                ) : null,
              )}
            </div>
          </section>
        )}

        {(entry.tags ?? []).length > 0 && (
          <section className="flex flex-wrap items-center gap-1.5 text-xs">
            {(entry.tags as string[]).map((tag) => {
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
          </section>
        )}

        {entry.related_thread_id && (
          <section>
            <Link
              href={`/${profile.family_space_id ? "child" : "parent"}/thread/${entry.related_thread_id}`}
              className="inline-flex items-center gap-1 text-sm text-accent hover:underline"
            >
              {t.related} →
            </Link>
          </section>
        )}
      </main>
    </RealtimeBoundary>
  );
}
