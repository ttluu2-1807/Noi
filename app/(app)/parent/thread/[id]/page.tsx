import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { MessageBubble, type MessageRow } from "@/components/MessageBubble";
import { ChecklistPanel, type ChecklistRow } from "@/components/ChecklistPanel";
import { RealtimeBoundary } from "@/components/RealtimeBoundary";
import { TagSelector } from "@/components/TagSelector";
import { ThreadTabs } from "@/components/ThreadTabs";
import { DayDivider, withDayDividers } from "@/components/DayDivider";
import { listFamilyTags } from "@/lib/tags";
import { FollowUpInput } from "./FollowUpInput";
// Shared with the child side — both roles can edit status + tags.
import {
  setThreadStatus,
  setThreadTags,
} from "@/app/(app)/child/thread/[id]/actions";

export const dynamic = "force-dynamic";

const T = {
  vi: {
    back: "Trang chủ",
    markResolved: "Đánh dấu đã xong",
    resolved: "✓ Đã xong",
    noActions: "Chưa có việc cần làm. Khi Noi đề xuất các bước cần làm, chúng sẽ xuất hiện ở đây.",
  },
  en: {
    back: "Home",
    markResolved: "Mark resolved",
    resolved: "✓ Done",
    noActions: "No action items yet. Items appear here when Noi suggests things to do.",
  },
} as const;

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

  const { data: profile } = await supabase
    .from("profiles")
    .select("language_preference, family_space_id, auto_read_responses")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.family_space_id) return null;
  const language = (profile.language_preference ?? "vi") as "vi" | "en";
  const t = T[language];
  const autoRead = profile.auto_read_responses ?? false;

  const [{ data: thread }, { data: messages }, { data: checklist }, familyTags] =
    await Promise.all([
      supabase
        .from("threads")
        .select("id, title_vi, title_en, tags, status")
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

  const title = language === "vi" ? thread.title_vi : thread.title_en;
  const tab = searchParams.tab === "actions" ? "actions" : "chat";
  const messageList = messages ?? [];
  const checklistList = (checklist ?? []) as ChecklistRow[];

  return (
    <RealtimeBoundary
      tables={["messages", "checklist_items", "threads"]}
      channelName={`parent-thread-${thread.id}`}
      filter={`thread_id=eq.${thread.id}`}
    >
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
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            {t.back}
          </Link>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              {title && (
                <h1 className="text-xl font-medium leading-snug">{title}</h1>
              )}
            </div>
            {/* Parent now also has a mark-resolved affordance — both roles
                can close out a thread when it's no longer active. */}
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
          <TagSelector
            threadId={thread.id}
            tags={(thread.tags as string[]) ?? []}
            familyTags={familyTags}
            language={language}
            onSetTags={setThreadTags}
          />
        </header>

        <ThreadTabs
          threadId={thread.id}
          basePath="/parent/thread"
          active={tab}
          language={language}
          actionCount={checklistList.length}
          messageCount={messageList.length}
        />

        {tab === "chat" ? (
          <>
            <section className="space-y-5">
              {withDayDividers(messageList).map((item) =>
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
                  />
                ),
              )}
            </section>
            <FollowUpInput
              threadId={thread.id}
              language={language}
              familySpaceId={profile.family_space_id}
            />
          </>
        ) : (
          <section className="space-y-3">
            {checklistList.length > 0 ? (
              <ChecklistPanel
                items={checklistList}
                language={language}
                currentUserId={user.id}
              />
            ) : (
              <div className="rounded-card border border-line bg-white p-8 text-center text-sm text-muted">
                {t.noActions}
              </div>
            )}
          </section>
        )}
      </main>
    </RealtimeBoundary>
  );
}
