import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { ThreadCard, type ThreadSummary } from "@/components/ThreadCard";
import { RealtimeBoundary } from "@/components/RealtimeBoundary";
import { HeaderMenu } from "@/components/HeaderMenu";
import { StatusTabs } from "@/components/StatusTabs";
import { fetchLatestMessagePerThread } from "@/lib/thread-previews";

export const dynamic = "force-dynamic";

export default async function ChildHome({
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
    .select("display_name, family_space_id")
    .eq("id", user.id)
    .maybeSingle();

  const { data: family } = profile?.family_space_id
    ? await supabase
        .from("family_spaces")
        .select("invite_code, name")
        .eq("id", profile.family_space_id)
        .maybeSingle()
    : { data: null };

  const { data: allThreads } = profile?.family_space_id
    ? await supabase
        .from("threads")
        .select(
          "id, title_vi, title_en, tags, status, updated_at, initiated_by_role",
        )
        .eq("family_space_id", profile.family_space_id)
        .order("updated_at", { ascending: false })
    : { data: [] };

  const all = (allThreads ?? []) as ThreadSummary[];
  const openThreads = all.filter((t) => t.status !== "resolved");
  const doneThreads = all.filter((t) => t.status === "resolved");
  const activeStatus: "open" | "done" =
    searchParams.status === "done" ? "done" : "open";
  const visibleThreads = activeStatus === "done" ? doneThreads : openThreads;

  const latestByThread = await fetchLatestMessagePerThread(
    supabase,
    visibleThreads.map((t) => t.id),
  );

  const displayName = profile?.display_name ?? "there";

  return (
    <RealtimeBoundary
      tables={["threads", "messages", "checklist_items"]}
      channelName={`child-home-${profile?.family_space_id ?? "none"}`}
    >
      <main className="mx-auto max-w-2xl px-6 py-10 space-y-8">
        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-medium truncate">
              Hi, {displayName}
            </h1>
            <p className="text-sm text-muted mt-1">
              Family code:{" "}
              <span className="font-medium tracking-widest text-accent">
                {family?.invite_code ?? "—"}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Link
              href="/child/new-task"
              className="rounded-card bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-transform active:scale-[0.98]"
            >
              New task
            </Link>
            <HeaderMenu
              role="child"
              language="en"
              displayName={displayName}
              inviteCode={family?.invite_code ?? null}
            />
          </div>
        </header>

        {all.length === 0 ? (
          <section className="rounded-card border border-line bg-white p-8 text-center space-y-2">
            <p className="text-muted">No activity yet.</p>
            <p className="text-sm text-muted/80">
              When your parent asks Noi a question, it&apos;ll appear here
              automatically.
            </p>
          </section>
        ) : (
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm text-muted uppercase tracking-wide">
                Activity
              </h2>
              <StatusTabs
                basePath="/child"
                active={activeStatus}
                language="en"
                openCount={openThreads.length}
                doneCount={doneThreads.length}
              />
            </div>
            {visibleThreads.length > 0 ? (
              <ul className="space-y-2">
                {visibleThreads.map((t) => (
                  <li key={t.id}>
                    <ThreadCard
                      thread={t}
                      language="en"
                      basePath="/child/thread"
                      latestMessage={latestByThread[t.id]}
                      highlight={t.status === "open"}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-card border border-line bg-white p-6 text-center text-sm text-muted">
                {activeStatus === "done"
                  ? "Nothing marked done yet."
                  : "No open threads."}
              </p>
            )}
          </section>
        )}
      </main>
    </RealtimeBoundary>
  );
}
