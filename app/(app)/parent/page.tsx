import { createServerClient } from "@/lib/supabase/server";
import { RealtimeBoundary } from "@/components/RealtimeBoundary";
import { ParentHome } from "./ParentHome";
import type { ThreadSummary, LatestMessageSummary } from "@/components/ThreadCard";
import { fetchLatestMessagePerThread } from "@/lib/thread-previews";

export const dynamic = "force-dynamic";

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

  const { data: family } = await supabase
    .from("family_spaces")
    .select("invite_code")
    .eq("id", profile!.family_space_id!)
    .maybeSingle();

  // Fetch every thread for this family in one go — we partition by status
  // in JS to drive the Open / Done tab counts. Family-scale data, fine.
  const { data: allThreads } = await supabase
    .from("threads")
    .select("id, title_vi, title_en, tags, status, updated_at, initiated_by_role")
    .eq("family_space_id", profile!.family_space_id!)
    .order("updated_at", { ascending: false });

  const all = (allThreads ?? []) as ThreadSummary[];
  const openThreads = all.filter((t) => t.status !== "resolved");
  const doneThreads = all.filter((t) => t.status === "resolved");
  const activeStatus: "open" | "done" = searchParams.status === "done" ? "done" : "open";
  const visibleThreads = activeStatus === "done" ? doneThreads : openThreads;

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
        openCount={openThreads.length}
        doneCount={doneThreads.length}
      />
    </RealtimeBoundary>
  );
}
