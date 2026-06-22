import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { RealtimeBoundary } from "@/components/RealtimeBoundary";
import { HeaderMenu } from "@/components/HeaderMenu";
import { DiaryTimeline, type DiaryRow } from "./DiaryTimeline";
import type { Language } from "@/lib/language-detect";


const T = {
  vi: {
    title: "Nhật ký gia đình",
    subtitle:
      "Sự kiện, quyết định, và những điều cần nhớ — để sau này không lặp lại sai lầm.",
    back: "Trang chủ",
    add: "Thêm mục",
    empty:
      "Chưa có mục nhật ký nào. Hãy thêm một sự kiện hoặc quyết định để bắt đầu.",
  },
  en: {
    title: "Family diary",
    subtitle:
      "Events, decisions, and things worth remembering — so future-you doesn't repeat the same mistakes.",
    back: "Home",
    add: "Add entry",
    empty:
      "No entries yet. Add an event or decision to start the family memory.",
  },
} as const;

export default async function DiaryPage({
  searchParams,
}: {
  searchParams: { kind?: string };
}) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, role, language_preference, family_space_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.family_space_id) return null;
  const language = (profile.language_preference ?? "vi") as Language;
  const t = T[language];

  const activeKind =
    searchParams.kind === "event" ||
    searchParams.kind === "decision" ||
    searchParams.kind === "note"
      ? (searchParams.kind as "event" | "decision" | "note")
      : null;

  const { data: family } = await supabase
    .from("family_spaces")
    .select("invite_code")
    .eq("id", profile.family_space_id)
    .maybeSingle();

  // Pull every kind's count for the filter pills, then the actual rows
  // for the active filter (or all kinds if no filter).
  const baseQuery = () =>
    supabase
      .from("diary_entries")
      .select(
        "id, kind, title_vi, title_en, body_vi, body_en, context_vi, context_en, event_date, tags, attachments, created_at",
      )
      .eq("family_space_id", profile.family_space_id!)
      .is("deleted_at", null);

  const rowsQuery = activeKind
    ? baseQuery().eq("kind", activeKind)
    : baseQuery();

  const [rowsResult, countsResult] = await Promise.all([
    rowsQuery.order("created_at", { ascending: false }).limit(200),
    supabase
      .from("diary_entries")
      .select("kind", { count: "exact" })
      .eq("family_space_id", profile.family_space_id)
      .is("deleted_at", null),
  ]);

  const rows = (rowsResult.data ?? []) as DiaryRow[];
  // Bucket counts by kind. Single round trip — we use the same data
  // for the filter pills.
  const counts: Record<"all" | "event" | "decision" | "note", number> = {
    all: 0,
    event: 0,
    decision: 0,
    note: 0,
  };
  for (const r of countsResult.data ?? []) {
    const k = r.kind as "event" | "decision" | "note" | undefined;
    if (k && (k === "event" || k === "decision" || k === "note")) {
      counts[k]++;
      counts.all++;
    }
  }

  const homeHref = profile.role === "parent" ? "/parent" : "/child";

  return (
    <RealtimeBoundary
      tables={["diary_entries"]}
      channelName={`diary-${profile.family_space_id}`}
    >
      <main className="mx-auto max-w-md px-6 py-10 space-y-6">
        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-1">
            <Link
              href={homeHref}
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
            <h1 className="text-2xl font-medium">{t.title}</h1>
            <p className="text-sm text-muted">{t.subtitle}</p>
          </div>
          <HeaderMenu
            role={profile.role as "parent" | "child"}
            language={language}
            displayName={profile.display_name ?? ""}
            inviteCode={family?.invite_code ?? null}
          />
        </header>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <DiaryFilterPills
            language={language}
            activeKind={activeKind}
            counts={counts}
          />
          <Link
            href="/diary/new"
            className="rounded-card bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-transform active:scale-[0.98]"
          >
            + {t.add}
          </Link>
        </div>

        {rows.length === 0 ? (
          <section className="rounded-card border border-line bg-white p-8 text-center">
            <p className="text-sm text-muted">{t.empty}</p>
          </section>
        ) : (
          <DiaryTimeline rows={rows} language={language} />
        )}
      </main>
    </RealtimeBoundary>
  );
}

function DiaryFilterPills({
  language,
  activeKind,
  counts,
}: {
  language: Language;
  activeKind: "event" | "decision" | "note" | null;
  counts: Record<"all" | "event" | "decision" | "note", number>;
}) {
  const labels = {
    vi: { all: "Tất cả", event: "Sự kiện", decision: "Quyết định", note: "Ghi chú" },
    en: { all: "All", event: "Events", decision: "Decisions", note: "Notes" },
  } as const;
  const l = labels[language];
  const pills: Array<{
    key: "all" | "event" | "decision" | "note";
    href: string;
    label: string;
    count: number;
  }> = [
    { key: "all", href: "/diary", label: l.all, count: counts.all },
    { key: "event", href: "/diary?kind=event", label: l.event, count: counts.event },
    {
      key: "decision",
      href: "/diary?kind=decision",
      label: l.decision,
      count: counts.decision,
    },
    { key: "note", href: "/diary?kind=note", label: l.note, count: counts.note },
  ];

  return (
    <div className="inline-flex flex-wrap gap-1 rounded-card border border-line bg-white p-1">
      {pills.map((p) => {
        const isActive =
          (activeKind === null && p.key === "all") || activeKind === p.key;
        return (
          <Link
            key={p.key}
            href={p.href}
            className={`rounded-[8px] px-3 py-1.5 text-sm transition-colors ${
              isActive
                ? "bg-accent text-white font-medium"
                : "text-muted hover:text-ink"
            }`}
          >
            {p.label}
            {p.count > 0 && (
              <span
                className={`ml-1.5 text-xs ${
                  isActive ? "opacity-80" : "opacity-60"
                }`}
              >
                ({p.count})
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
