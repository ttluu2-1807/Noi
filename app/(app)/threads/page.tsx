import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { RealtimeBoundary } from "@/components/RealtimeBoundary";
import { HeaderMenu } from "@/components/HeaderMenu";
import { StatusTabs } from "@/components/StatusTabs";
import { ThreadCard, type ThreadSummary, type LatestMessageSummary } from "@/components/ThreadCard";
import { ThreadActionsMenu } from "@/components/ThreadActionsMenu";
import { FilteredEmptyState } from "@/components/FilteredEmptyState";
import { fetchLatestMessagePerThread } from "@/lib/thread-previews";
import { fetchFamilyMembers, membersById } from "@/lib/family-members";
import type { Language } from "@/lib/language-detect";

const DASHBOARD_LIMIT = 50;

const T = {
  vi: {
    title: "Câu hỏi",
    subtitle: "Mọi cuộc trò chuyện với Noi, ở một chỗ.",
    back: "Trang chủ",
    empty: {
      openTitle: "Không có câu hỏi nào đang mở.",
      openHint: (n: number) => `${n} câu hỏi đã xong.`,
      doneTitle: "Chưa có câu hỏi nào được đánh dấu đã xong.",
      doneHint: (n: number) => `${n} câu hỏi còn đang mở.`,
      firstTitle: "Chưa có cuộc trò chuyện nào.",
      firstHint: "Hãy hỏi Noi từ trang chủ để bắt đầu.",
    },
  },
  en: {
    title: "Threads",
    subtitle: "Every conversation with Noi, in one place.",
    back: "Home",
    empty: {
      openTitle: "No open threads right now.",
      openHint: (n: number) => `${n} marked done.`,
      doneTitle: "Nothing marked done yet.",
      doneHint: (n: number) => `${n} still open.`,
      firstTitle: "No conversations yet.",
      firstHint: "Ask Noi something from the home screen to start.",
    },
  },
} as const;

/**
 * Dedicated /threads list — restores the surface that was previously
 * embedded in /parent and /child home pages. Home now shows only
 * NeedsAttention (per audit); the full list lives here, reached via
 * the Threads tile in QuickAccessRow.
 */
export default async function ThreadsPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, role, family_space_id, language_preference")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.family_space_id) return null;

  const language = (profile.language_preference ?? "vi") as Language;
  const t = T[language];
  const activeStatus: "open" | "done" =
    searchParams.status === "done" ? "done" : "open";
  const homeHref = profile.role === "parent" ? "/parent" : "/child";
  const threadBase = profile.role === "parent" ? "/parent/thread" : "/child/thread";

  const [familyResult, visibleThreadsResult, openCountResult, doneCountResult] =
    await Promise.all([
      supabase
        .from("family_spaces")
        .select("invite_code")
        .eq("id", profile.family_space_id)
        .maybeSingle(),
      supabase
        .from("threads")
        .select("id, title_vi, title_en, tags, status, updated_at, initiated_by_role")
        .eq("family_space_id", profile.family_space_id)
        .is("deleted_at", null)
        [activeStatus === "done" ? "eq" : "neq"]("status", "resolved")
        .order("updated_at", { ascending: false })
        .limit(DASHBOARD_LIMIT),
      supabase
        .from("threads")
        .select("*", { count: "exact", head: true })
        .eq("family_space_id", profile.family_space_id)
        .neq("status", "resolved")
        .is("deleted_at", null),
      supabase
        .from("threads")
        .select("*", { count: "exact", head: true })
        .eq("family_space_id", profile.family_space_id)
        .eq("status", "resolved")
        .is("deleted_at", null),
    ]);

  const visibleThreads = (visibleThreadsResult.data ?? []) as ThreadSummary[];
  const openCount = openCountResult.count ?? 0;
  const doneCount = doneCountResult.count ?? 0;

  const [latestByThread, viewsResult, familyMembers] = await Promise.all([
    fetchLatestMessagePerThread(supabase, visibleThreads.map((t) => t.id)),
    visibleThreads.length > 0
      ? supabase
          .from("thread_views")
          .select("thread_id, last_viewed_at")
          .eq("user_id", user.id)
          .in("thread_id", visibleThreads.map((t) => t.id))
      : Promise.resolve({
          data: [] as { thread_id: string; last_viewed_at: string }[],
        }),
    fetchFamilyMembers(supabase, profile.family_space_id),
  ]);

  const memberNamesById: Record<string, string> = Object.fromEntries(
    Object.entries(membersById(familyMembers)).map(([id, m]) => [id, m.display_name]),
  );

  const lastViewedByThread = new Map<string, string>();
  for (const row of viewsResult.data ?? []) {
    lastViewedByThread.set(row.thread_id, row.last_viewed_at);
  }
  const unreadThreadIds = new Set<string>(
    visibleThreads
      .filter((t) => {
        const last = lastViewedByThread.get(t.id);
        return !last || t.updated_at > last;
      })
      .map((t) => t.id),
  );

  const total = openCount + doneCount;
  const latestMap = latestByThread as Record<string, LatestMessageSummary>;

  return (
    <RealtimeBoundary
      tables={["threads", "messages", "thread_views"]}
      channelName={`threads-list-${profile.family_space_id}`}
    >
      <main className="mx-auto max-w-md px-gutter py-10 space-y-6">
        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-1">
            <Link
              href={homeHref}
              className="inline-flex items-center gap-1 text-body-sm text-ink-3 hover:text-ink transition-colors"
            >
              <BackChevron />
              {t.back}
            </Link>
            <h1 className="text-display font-medium">{t.title}</h1>
            <p className="text-body-sm text-ink-3">{t.subtitle}</p>
          </div>
          <HeaderMenu
            role={profile.role as "parent" | "child"}
            language={language}
            displayName={profile.display_name ?? ""}
            inviteCode={familyResult.data?.invite_code ?? null}
          />
        </header>

        {total > 0 && (
          <div className="flex justify-end">
            <StatusTabs
              basePath="/threads"
              active={activeStatus}
              language={language}
              openCount={openCount}
              doneCount={doneCount}
            />
          </div>
        )}

        {visibleThreads.length > 0 ? (
          <ul className="space-y-2">
            {visibleThreads.map((th) => (
              <li key={th.id}>
                <ThreadCard
                  thread={th}
                  language={language}
                  basePath={threadBase}
                  latestMessage={latestMap[th.id]}
                  memberNames={memberNamesById}
                  unread={unreadThreadIds.has(th.id)}
                  highlight={th.status !== "resolved"}
                  actions={
                    <ThreadActionsMenu
                      threadId={th.id}
                      language={language}
                      threadTitle={
                        (language === "vi" ? th.title_vi : th.title_en) ?? ""
                      }
                    />
                  }
                />
              </li>
            ))}
          </ul>
        ) : total === 0 ? (
          <FilteredEmptyState
            title={t.empty.firstTitle}
            hint={t.empty.firstHint}
            action={{
              label: language === "vi" ? "Về trang chủ" : "Go home",
              href: homeHref,
            }}
          />
        ) : activeStatus === "done" ? (
          <FilteredEmptyState
            title={t.empty.doneTitle}
            hint={openCount > 0 ? t.empty.doneHint(openCount) : undefined}
            secondaryAction={
              openCount > 0
                ? {
                    label: language === "vi" ? "Xem đang mở" : "See open",
                    href: "/threads",
                  }
                : undefined
            }
          />
        ) : (
          <FilteredEmptyState
            title={t.empty.openTitle}
            hint={doneCount > 0 ? t.empty.openHint(doneCount) : undefined}
            secondaryAction={
              doneCount > 0
                ? {
                    label: language === "vi" ? "Xem đã xong" : "See done",
                    href: "/threads?status=done",
                  }
                : undefined
            }
          />
        )}
      </main>
    </RealtimeBoundary>
  );
}

function BackChevron() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  );
}
