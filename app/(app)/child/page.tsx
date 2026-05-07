import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { signOut } from "@/app/(app)/actions";
import { ThreadCard, type ThreadSummary } from "@/components/ThreadCard";
import { RealtimeBoundary } from "@/components/RealtimeBoundary";

export const dynamic = "force-dynamic";

export default async function ChildHome() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The (app)/layout already redirects unauthenticated users, but its
  // redirect races with this page's render. Early-return on null to
  // avoid a noisy (but invisible to users) log line.
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

  const { data: threads } = profile?.family_space_id
    ? await supabase
        .from("threads")
        .select(
          "id, title_vi, title_en, category_tag, status, updated_at, initiated_by_role",
        )
        .eq("family_space_id", profile.family_space_id)
        .order("updated_at", { ascending: false })
        .limit(50)
    : { data: [] };

  return (
    <RealtimeBoundary
      tables={["threads", "messages", "checklist_items"]}
      channelName={`child-home-${profile?.family_space_id ?? "none"}`}
    >
      <main className="mx-auto max-w-2xl px-6 py-10 space-y-8">
        <header className="flex items-baseline justify-between">
          <div>
            <h1 className="text-2xl font-medium">
              Hi, {profile?.display_name ?? "there"}
            </h1>
            <p className="text-sm text-muted mt-1">
              Family code:{" "}
              <span className="font-medium tracking-widest text-accent">
                {family?.invite_code ?? "—"}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/child/new-task"
              className="rounded-card bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              New task
            </Link>
            <Link
              href="/settings"
              className="text-sm text-muted hover:text-ink"
            >
              Settings
            </Link>
            <form action={signOut}>
              <button className="text-sm text-muted hover:text-ink">
                Sign out
              </button>
            </form>
          </div>
        </header>

        {(threads ?? []).length === 0 ? (
          <section className="rounded-card border border-line bg-white p-8 text-center space-y-2">
            <p className="text-muted">No activity yet.</p>
            <p className="text-sm text-muted/80">
              When your parent asks Noi a question, it&apos;ll appear here
              automatically.
            </p>
          </section>
        ) : (
          <section className="space-y-3">
            <h2 className="text-sm text-muted uppercase tracking-wide">
              Activity
            </h2>
            <ul className="space-y-2">
              {(threads as ThreadSummary[]).map((t) => (
                <li key={t.id}>
                  <ThreadCard
                    thread={t}
                    language="en"
                    basePath="/child/thread"
                    highlight={t.status === "open"}
                  />
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </RealtimeBoundary>
  );
}
