import { createServerClient } from "@/lib/supabase/server";
import { RealtimeBoundary } from "@/components/RealtimeBoundary";
import { ParentHome } from "./ParentHome";
import type { ThreadSummary, LatestMessageSummary } from "@/components/ThreadCard";
import { fetchLatestMessagePerThread } from "@/lib/thread-previews";

export const dynamic = "force-dynamic";

// PERF-5: hard cap on visible threads per tab. Beyond this we'd want
// proper pagination; in early life-of-family this is rarely hit.
const DASHBOARD_LIMIT = 50;

export default async function ParentPage({
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
    .select("display_name, family_space_id, language_preference")
    .eq("id", user.id)
    .maybeSingle();

  const language = (profile?.language_preference ?? "vi") as "vi" | "en";
  const activeStatus: "open" | "done" =
    searchParams.status === "done" ? "done" : "open";

  // Three parallel queries: family record + visible threads + the OTHER
  // tab's count (so the tab pill shows the right number). The query
  // for the visible tab uses .limit() to cap rows; the count queries
  // use head:true so no rows transfer, only a number.
  const [familyResult, visibleThreadsResult, openCountResult, doneCountResult] =
    await Promise.all([
      supabase
        .from("family_spaces")
        .select("invite_code")
        .eq("id", profile!.family_space_id!)
        .maybeSingle(),
      activeStatus === "done"
        ? supabase
            .from("threads")
            .select(
              "id, title_vi, title_en, tags, status, updated_at, initiated_by_role",
            )
            .eq("family_space_id", profile!.family_space_id!)
            .eq("status", "resolved")
            .order("updated_at", { ascending: false })
            .limit(DASHBOARD_LIMIT)
        : supabase
            .from("threads")
            .select(
              "id, title_vi, title_en, tags, status, updated_at, initiated_by_role",
            )
            .eq("family_space_id", profile!.family_space_id!)
            .neq("status", "resolved")
            .order("updated_at", { ascending: false })
            .limit(DASHBOARD_LIMIT),
      supabase
        .from("threads")
        .select("*", { count: "exact", head: true })
        .eq("family_space_id", profile!.family_space_id!)
        .neq("status", "resolved"),
      supabase
        .from("threads")
        .select("*", { count: "exact", head: true })
        .eq("family_space_id", profile!.family_space_id!)
        .eq("status", "resolved"),
    ]);

  const visibleThreads = (visibleThreadsResult.data ?? []) as ThreadSummary[];
  const openCount = openCountResult.count ?? 0;
  const doneCount = doneCountResult.count ?? 0;
  const family = familyResult.data;

  const latestByThread = await fetchLatestMessagePerThread(
    supabase,
    visibleThreads.map((t) => t.id),
  );

  return (
    <RealtimeBoundary
      tables={["threads", "messages"]}
      channelName={`parent-home-${profile?.family_space_id ?? "none"}`}
    >
      <ParentHome
        displayName={
          profile?.display_name ?? (language === "vi" ? "quý vị" : "there")
        }
        recentThreads={visibleThreads}
        latestMessages={latestByThread as Record<string, LatestMessageSummary>}
        language={language}
        familySpaceId={profile!.family_space_id!}
        inviteCode={family?.invite_code ?? null}
        activeStatus={activeStatus}
        openCount={openCount}
        doneCount={doneCount}
      />
    </RealtimeBoundary>
  );
}
