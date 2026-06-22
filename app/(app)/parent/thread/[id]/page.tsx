import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { MessageBubble, type MessageRow } from "@/components/MessageBubble";
import { ChecklistPanel, type ChecklistRow } from "@/components/ChecklistPanel";
import { RealtimeBoundary } from "@/components/RealtimeBoundary";
import { MarkAsViewed } from "@/components/MarkAsViewed";
import { TagSelector } from "@/components/TagSelector";
import { ThreadTabs } from "@/components/ThreadTabs";
import { DayDivider, withDayDividers } from "@/components/DayDivider";
import { listFamilyTags } from "@/lib/tags";
import { fetchFamilyMembers, membersById } from "@/lib/family-members";
import { FollowUpInput } from "./FollowUpInput";
// Shared with the child side — both roles can edit status + tags.
import {
  setThreadStatus,
  setThreadTags,
} from "@/app/(app)/child/thread/[id]/actions";
import type { Language } from "@/lib/language-detect";


const T = {
  vi: {
    back: "Trang chủ",
    markResolved: "Đánh dấu đã xong",
    resolved: "✓ Đã xong",
    noActions:
      "Chưa có việc cần làm. Khi Noi đề xuất các bước cần làm, chúng sẽ xuất hiện ở đây.",
  },
  en: {
    back: "Home",
    markResolved: "Mark resolved",
    resolved: "✓ Done",
    noActions:
      "No action items yet. Items appear here when Noi suggests things to do.",
  },
} as const;

/**
 * Parent thread page — restructured (PERF-1) to render in shells via
 * Suspense streaming. The critical-path top-level fetch is just
 *   auth + profile + thread existence
 * which is fast (~50-100ms). The rest streams in below:
 *   - Tabs + counts (own messages/checklist count queries)
 *   - Tags row (slow listFamilyTags scan)
 *   - Message bubbles (own messages query)
 *   - Checklist (own checklist query, only on Actions tab)
 *
 * Result: the header (title, status, back link) is interactive within
 * ~100ms of navigation; the rest pops in section-by-section as each
 * query resolves. No more "all-or-nothing" wait.
 */
export default async function ParentThreadPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { tab?: string };
}) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Profile + thread don't depend on each other — run in parallel to
  // shave ~50ms off the critical path on every thread navigation.
  const [profileResult, threadResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("language_preference, family_space_id, auto_read_responses")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("threads")
      .select("id, title_vi, title_en, tags, status, deleted_at")
      .eq("id", params.id)
      .maybeSingle(),
  ]);

  const profile = profileResult.data;
  if (!profile?.family_space_id) return null;

  const language = (profile.language_preference ?? "vi") as Language;
  const t = T[language];
  const autoRead = profile.auto_read_responses ?? false;

  const thread = threadResult.data;
  // Treat a soft-deleted thread the same as missing — the user can
  // restore it from /trash if they want.
  if (!thread || thread.deleted_at) notFound();

  const title = language === "vi" ? thread.title_vi : thread.title_en;
  const tab = searchParams.tab === "actions" ? "actions" : "chat";

  return (
    <RealtimeBoundary
      tables={["messages", "checklist_items", "threads"]}
      channelName={`parent-thread-${thread.id}`}
      filter={`thread_id=eq.${thread.id}`}
    >
      <MarkAsViewed threadId={thread.id} />
      <main className="mx-auto max-w-md px-6 py-8 space-y-6">
        <header className="space-y-3">
          <Link
            href="/parent"
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
            <div className="min-w-0 flex-1">
              {title && (
                <h1 className="text-xl font-medium leading-snug">{title}</h1>
              )}
            </div>
            <form action={setThreadStatus}>
              <input type="hidden" name="threadId" value={thread.id} />
              <input
                type="hidden"
                name="status"
                value={thread.status === "resolved" ? "open" : "resolved"}
              />
              <button
                className={`shrink-0 rounded-full px-3 py-1 text-xs transition-transform active:scale-95 ${
                  thread.status === "resolved"
                    ? "bg-accent/10 text-accent"
                    : "bg-white border border-line text-muted hover:text-ink"
                }`}
              >
                {thread.status === "resolved" ? t.resolved : t.markResolved}
              </button>
            </form>
          </div>
          <Suspense fallback={<TagBarSkeleton />}>
            <FamilyTagBar
              threadId={thread.id}
              familySpaceId={profile.family_space_id}
              currentTags={(thread.tags as string[]) ?? []}
              language={language}
            />
          </Suspense>
        </header>

        <Suspense fallback={<TabsSkeleton />}>
          <ThreadTabsWithCounts
            threadId={thread.id}
            basePath="/parent/thread"
            active={tab}
            language={language}
          />
        </Suspense>

        {tab === "chat" ? (
          <>
            <Suspense fallback={<MessagesSkeleton />}>
              <MessagesSection
                threadId={thread.id}
                language={language}
                autoRead={autoRead}
                familySpaceId={profile.family_space_id}
              />
            </Suspense>
            <FollowUpInput
              threadId={thread.id}
              language={language}
              familySpaceId={profile.family_space_id}
            />
          </>
        ) : (
          <Suspense fallback={<ChecklistSkeleton />}>
            <ChecklistSection
              threadId={thread.id}
              language={language}
              currentUserId={user.id}
              emptyLabel={t.noActions}
            />
          </Suspense>
        )}
      </main>
    </RealtimeBoundary>
  );
}

// ---- Streamed async sub-sections ------------------------------------

async function FamilyTagBar({
  threadId,
  familySpaceId,
  currentTags,
  language,
}: {
  threadId: string;
  familySpaceId: string;
  currentTags: string[];
  language: Language;
}) {
  const supabase = createServerClient();
  const familyTags = await listFamilyTags(supabase, familySpaceId);
  return (
    <TagSelector
      threadId={threadId}
      tags={currentTags}
      familyTags={familyTags}
      language={language}
      onSetTags={setThreadTags}
    />
  );
}

async function ThreadTabsWithCounts({
  threadId,
  basePath,
  active,
  language,
}: {
  threadId: string;
  basePath: "/parent/thread" | "/child/thread";
  active: "chat" | "actions";
  language: Language;
}) {
  const supabase = createServerClient();
  const [messagesCount, checklistCount] = await Promise.all([
    supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("thread_id", threadId),
    supabase
      .from("checklist_items")
      .select("*", { count: "exact", head: true })
      .eq("thread_id", threadId),
  ]);
  return (
    <ThreadTabs
      threadId={threadId}
      basePath={basePath}
      active={active}
      language={language}
      actionCount={checklistCount.count ?? 0}
      messageCount={messagesCount.count ?? 0}
    />
  );
}

async function MessagesSection({
  threadId,
  language,
  autoRead,
  familySpaceId,
}: {
  threadId: string;
  language: Language;
  autoRead: boolean;
  familySpaceId: string;
}) {
  const supabase = createServerClient();
  const [messagesResult, members] = await Promise.all([
    supabase
      .from("messages")
      .select(
        "id, sender_role, sender_id, content_vi, content_en, message_type, attachments, created_at",
      )
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true }),
    fetchFamilyMembers(supabase, familySpaceId),
  ]);
  const list = messagesResult.data ?? [];

  const memberNames: Record<string, string> = Object.fromEntries(
    Object.entries(membersById(members)).map(([id, m]) => [id, m.display_name]),
  );

  return (
    <section className="space-y-5">
      {withDayDividers(list).map((item) =>
        item.type === "divider" ? (
          <DayDivider
            key={`div-${item.iso}`}
            iso={item.iso}
            language={language}
          />
        ) : (
          <MessageBubble
            key={item.message.id}
            message={item.message as MessageRow}
            viewerLanguage={language}
            allowToggle
            showTTS
            autoRead={autoRead}
            memberNames={memberNames}
          />
        ),
      )}
    </section>
  );
}

async function ChecklistSection({
  threadId,
  language,
  currentUserId,
  emptyLabel,
}: {
  threadId: string;
  language: Language;
  currentUserId: string;
  emptyLabel: string;
}) {
  const supabase = createServerClient();
  const { data: checklist } = await supabase
    .from("checklist_items")
    .select("id, text_vi, text_en, is_completed, sort_order")
    .eq("thread_id", threadId)
    .order("sort_order", { ascending: true });
  const list = (checklist ?? []) as ChecklistRow[];

  if (list.length === 0) {
    return (
      <section className="space-y-3">
        <div className="rounded-card border border-line bg-white p-8 text-center text-sm text-muted">
          {emptyLabel}
        </div>
      </section>
    );
  }
  return (
    <section className="space-y-3">
      <ChecklistPanel
        items={list}
        language={language}
        currentUserId={currentUserId}
      />
    </section>
  );
}

// ---- Local skeletons ---------------------------------------------

function TagBarSkeleton() {
  return (
    <div className="flex items-center gap-2 animate-pulse">
      <div className="h-3 w-10 rounded bg-line/40" />
      <div className="h-5 w-14 rounded-full bg-line/50" />
      <div className="h-5 w-16 rounded-full bg-line/50" />
      <div className="h-5 w-20 rounded-full bg-line/40 border border-dashed border-line" />
    </div>
  );
}

function TabsSkeleton() {
  return (
    <div className="h-10 rounded-card border border-line bg-line/30 animate-pulse" />
  );
}

function MessagesSkeleton() {
  return (
    <section className="space-y-5 animate-pulse">
      <div className="ml-6 space-y-1">
        <div className="h-3 w-12 rounded bg-line/40" />
        <div className="rounded-bubble bg-accent/10 p-4 h-12" />
      </div>
      <div className="space-y-1">
        <div className="h-3 w-12 rounded bg-line/40" />
        <div className="rounded-bubble border border-line bg-white p-4 h-32" />
      </div>
    </section>
  );
}

function ChecklistSkeleton() {
  return (
    <section className="space-y-2 animate-pulse">
      <div className="h-14 rounded-card border border-line bg-white" />
      <div className="h-14 rounded-card border border-line bg-white" />
      <div className="h-14 rounded-card border border-line bg-white" />
    </section>
  );
}
