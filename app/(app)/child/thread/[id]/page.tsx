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
import { ChildComposer } from "./ChildComposer";
import { setThreadStatus, setThreadTags } from "./actions";

export const dynamic = "force-dynamic";

/**
 * Child thread page — mirror of the parent thread page's Suspense
 * streaming structure (see that file's comment for the design).
 * Identical fast-path: auth + profile + thread; everything else
 * streams in independent Suspense boundaries.
 */
export default async function ChildThreadPage({
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
      .select("family_space_id, auto_read_responses")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("threads")
      .select("id, title_vi, title_en, tags, status, initiated_by_role")
      .eq("id", params.id)
      .maybeSingle(),
  ]);

  const profile = profileResult.data;
  if (!profile?.family_space_id) return null;
  const autoRead = profile.auto_read_responses ?? false;

  const thread = threadResult.data;
  if (!thread) notFound();

  const tab = searchParams.tab === "actions" ? "actions" : "chat";

  return (
    <RealtimeBoundary
      tables={["messages", "checklist_items", "threads"]}
      channelName={`child-thread-${thread.id}`}
      filter={`thread_id=eq.${thread.id}`}
    >
      <MarkAsViewed threadId={thread.id} />
      <main className="mx-auto max-w-2xl px-6 py-8 space-y-6">
        <header className="space-y-3">
          <Link
            href="/child"
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
            Dashboard
          </Link>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              {thread.title_en && (
                <h1 className="text-xl font-medium leading-snug">
                  {thread.title_en}
                </h1>
              )}
              {thread.title_vi && thread.title_vi !== thread.title_en && (
                <p className="text-sm text-muted mt-0.5">{thread.title_vi}</p>
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
                {thread.status === "resolved" ? "✓ Resolved" : "Mark resolved"}
              </button>
            </form>
          </div>
          <Suspense fallback={<TagBarSkeleton />}>
            <FamilyTagBar
              threadId={thread.id}
              familySpaceId={profile.family_space_id}
              currentTags={(thread.tags as string[]) ?? []}
            />
          </Suspense>
        </header>

        <Suspense fallback={<TabsSkeleton />}>
          <ThreadTabsWithCounts
            threadId={thread.id}
            active={tab}
          />
        </Suspense>

        {tab === "chat" ? (
          <>
            <Suspense fallback={<MessagesSkeleton />}>
              <MessagesSection threadId={thread.id} autoRead={autoRead} />
            </Suspense>
            <ChildComposer
              threadId={thread.id}
              familySpaceId={profile.family_space_id}
            />
          </>
        ) : (
          <Suspense fallback={<ChecklistSkeleton />}>
            <ChecklistSection
              threadId={thread.id}
              currentUserId={user.id}
            />
          </Suspense>
        )}
      </main>
    </RealtimeBoundary>
  );
}

async function FamilyTagBar({
  threadId,
  familySpaceId,
  currentTags,
}: {
  threadId: string;
  familySpaceId: string;
  currentTags: string[];
}) {
  const supabase = createServerClient();
  const familyTags = await listFamilyTags(supabase, familySpaceId);
  return (
    <TagSelector
      threadId={threadId}
      tags={currentTags}
      familyTags={familyTags}
      language="en"
      onSetTags={setThreadTags}
    />
  );
}

async function ThreadTabsWithCounts({
  threadId,
  active,
}: {
  threadId: string;
  active: "chat" | "actions";
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
      basePath="/child/thread"
      active={active}
      language="en"
      actionCount={checklistCount.count ?? 0}
      messageCount={messagesCount.count ?? 0}
    />
  );
}

async function MessagesSection({
  threadId,
  autoRead,
}: {
  threadId: string;
  autoRead: boolean;
}) {
  const supabase = createServerClient();
  const { data: messages } = await supabase
    .from("messages")
    .select(
      "id, sender_role, content_vi, content_en, message_type, attachments, created_at",
    )
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });
  const list = messages ?? [];

  if (list.length === 0) return null;

  return (
    <section className="space-y-4">
      {withDayDividers(list).map((item) =>
        item.type === "divider" ? (
          <DayDivider
            key={`div-${item.iso}`}
            iso={item.iso}
            language="en"
          />
        ) : (
          <MessageBubble
            key={item.message.id}
            message={item.message as MessageRow}
            viewerLanguage="en"
            allowToggle
            autoRead={autoRead}
          />
        ),
      )}
    </section>
  );
}

async function ChecklistSection({
  threadId,
  currentUserId,
}: {
  threadId: string;
  currentUserId: string;
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
          No action items yet. Items appear here when Noi suggests things to
          gather or do.
        </div>
      </section>
    );
  }
  return (
    <section className="space-y-3">
      <ChecklistPanel
        items={list}
        language="en"
        currentUserId={currentUserId}
      />
    </section>
  );
}

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
    <section className="space-y-4 animate-pulse">
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
