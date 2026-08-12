import { createServerClient } from "@/lib/supabase/server";
import { RealtimeBoundary } from "@/components/RealtimeBoundary";
import { ChildHome } from "./ChildHome";
import { fetchNeedsAttention } from "@/lib/insights";

/**
 * Child home entry — v1 port matches parent's shape.
 *
 * Drops the activity feed, status tabs, thread list, family code line
 * under greeting, and ChildInsightsRow (redundant with NeedsAttention).
 * Adds hero mic + type field routed through the intent classifier +
 * a single NeedsAttention list.
 *
 * VoiceFAB is also removed — the audit specifies "Home keeps the hero
 * mic; the FAB appears on the other three [tabs]", so home surfaces
 * the mic in place and won't double up.
 */
export default async function ChildPage() {
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
  if (!profile?.family_space_id) return null;

  const [familyResult, needsAttention, countsResult] = await Promise.all([
    supabase
      .from("family_spaces")
      .select("invite_code")
      .eq("id", profile.family_space_id)
      .maybeSingle(),
    fetchNeedsAttention(
      supabase,
      profile.family_space_id,
      user.id,
      "child",
    ),
    Promise.all([
      supabase
        .from("threads")
        .select("*", { count: "exact", head: true })
        .eq("family_space_id", profile.family_space_id)
        .neq("status", "resolved")
        .is("deleted_at", null),
      supabase
        .from("family_todos")
        .select("*", { count: "exact", head: true })
        .eq("family_space_id", profile.family_space_id)
        .eq("is_completed", false)
        .is("deleted_at", null),
      supabase
        .from("diary_entries")
        .select("*", { count: "exact", head: true })
        .eq("family_space_id", profile.family_space_id)
        .is("deleted_at", null),
    ]),
  ]);

  const [threadsCount, todosCount, diaryCount] = countsResult;

  return (
    <RealtimeBoundary
      tables={["threads", "messages", "thread_views", "family_todos", "diary_entries"]}
      channelName={`child-home-${profile.family_space_id}`}
    >
      <ChildHome
        displayName={profile.display_name ?? "there"}
        familySpaceId={profile.family_space_id}
        inviteCode={familyResult.data?.invite_code ?? null}
        needsAttention={needsAttention}
        threadsCount={threadsCount.count ?? 0}
        todosCount={todosCount.count ?? 0}
        diaryCount={diaryCount.count ?? 0}
      />
    </RealtimeBoundary>
  );
}
