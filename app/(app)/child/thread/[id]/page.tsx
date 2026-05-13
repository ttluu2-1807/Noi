import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { MessageBubble, type MessageRow } from "@/components/MessageBubble";
import { ChecklistPanel, type ChecklistRow } from "@/components/ChecklistPanel";
import { RealtimeBoundary } from "@/components/RealtimeBoundary";
import { TagSelector } from "@/components/TagSelector";
import { ThreadTabs } from "@/components/ThreadTabs";
import { listFamilyTags } from "@/lib/tags";
import { ChildComposer } from "./ChildComposer";
import { setThreadStatus, setThreadTags } from "./actions";

export const dynamic = "force-dynamic";

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

  const { data: profile } = await supabase
    .from("profiles")
    .select("family_space_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.family_space_id) return null;

  const [{ data: thread }, { data: messages }, { data: checklist }, familyTags] =
    await Promise.all([
      supabase
        .from("threads")
        .select(
          "id, title_vi, title_en, tags, status, initiated_by_role",
        )
        .eq("id", params.id)
        .maybeSingle(),
      supabase
        .from("messages")
        .select("id, sender_role, content_vi, content_en, message_type, attachments, created_at")
        .eq("thread_id", params.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("checklist_items")
        .select("id, text_vi, text_en, is_completed, sort_order")
        .eq("thread_id", params.id)
        .order("sort_order", { ascending: true }),
      listFamilyTags(supabase, profile.family_space_id),
    ]);

  if (!thread) notFound();

  const tab = searchParams.tab === "actions" ? "actions" : "chat";
  const threadFilter = `thread_id=eq.${thread.id}`;
  const messageList = messages ?? [];
  const checklistList = (checklist ?? []) as ChecklistRow[];

  return (
    <RealtimeBoundary
      tables={["messages", "checklist_items", "threads"]}
      channelName={`child-thread-${thread.id}`}
      filter={threadFilter}
    >
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
          <TagSelector
            threadId={thread.id}
            tags={(thread.tags as string[]) ?? []}
            familyTags={familyTags}
            language="en"
            onSetTags={setThreadTags}
          />
        </header>

        <ThreadTabs
          threadId={thread.id}
          basePath="/child/thread"
          active={tab}
          language="en"
          actionCount={checklistList.length}
          messageCount={messageList.length}
        />

        {tab === "chat" ? (
          <>
            {messageList.length > 0 && (
              <section className="space-y-4">
                {messageList.map((m) => (
                  <MessageBubble
                    key={m.id}
                    message={m as MessageRow}
                    viewerLanguage="en"
                    allowToggle
                  />
                ))}
              </section>
            )}
            <ChildComposer
              threadId={thread.id}
              familySpaceId={profile.family_space_id}
            />
          </>
        ) : (
          <section className="space-y-3">
            {checklistList.length > 0 ? (
              <ChecklistPanel
                items={checklistList}
                language="en"
                currentUserId={user.id}
              />
            ) : (
              <div className="rounded-card border border-line bg-white p-8 text-center text-sm text-muted">
                No action items yet. Items appear here when Noi suggests
                things to gather or do.
              </div>
            )}
          </section>
        )}
      </main>
    </RealtimeBoundary>
  );
}
