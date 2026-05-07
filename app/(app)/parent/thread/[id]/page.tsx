import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { MessageBubble, type MessageRow } from "@/components/MessageBubble";
import { ChecklistPanel, type ChecklistRow } from "@/components/ChecklistPanel";
import { RealtimeBoundary } from "@/components/RealtimeBoundary";
import { FollowUpInput } from "./FollowUpInput";

export const dynamic = "force-dynamic";

const T = {
  vi: { back: "Trang chủ", steps: "Các bước cần làm" },
  en: { back: "Home", steps: "Things to do" },
} as const;

export default async function ParentThreadPage({
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
    .select("language_preference")
    .eq("id", user.id)
    .maybeSingle();
  const language = (profile?.language_preference ?? "vi") as "vi" | "en";
  const t = T[language];

  const [{ data: thread }, { data: messages }, { data: checklist }] =
    await Promise.all([
      supabase
        .from("threads")
        .select("id, title_vi, title_en, category_tag, status")
        .eq("id", params.id)
        .maybeSingle(),
      supabase
        .from("messages")
        .select("id, sender_role, content_vi, content_en, message_type, created_at")
        .eq("thread_id", params.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("checklist_items")
        .select("id, text_vi, text_en, is_completed, sort_order")
        .eq("thread_id", params.id)
        .order("sort_order", { ascending: true }),
    ]);

  if (!thread) notFound();

  const title = language === "vi" ? thread.title_vi : thread.title_en;

  return (
    <RealtimeBoundary
      tables={["messages", "checklist_items"]}
      channelName={`parent-thread-${thread.id}`}
      filter={`thread_id=eq.${thread.id}`}
    >
      <main className="mx-auto max-w-md px-6 py-8 space-y-8">
        <header className="space-y-3">
          <Link href="/parent" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            {t.back}
          </Link>
          {title && (
            <h1 className="text-xl font-medium leading-snug">{title}</h1>
          )}
        </header>

        <section className="space-y-5">
          {(messages ?? []).map((m) => (
            <MessageBubble
              key={m.id}
              message={m as MessageRow}
              viewerLanguage={language}
              // Allow tap-to-toggle so a parent who prefers Vietnamese
              // can still peek at the English version of any message,
              // and vice versa.
              allowToggle
              showTTS
            />
          ))}
        </section>

        {(checklist ?? []).length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm text-muted uppercase tracking-wide">
              {t.steps}
            </h2>
            <ChecklistPanel
              items={(checklist ?? []) as ChecklistRow[]}
              language={language}
              currentUserId={user.id}
            />
          </section>
        )}

        <FollowUpInput threadId={thread.id} language={language} />
      </main>
    </RealtimeBoundary>
  );
}
