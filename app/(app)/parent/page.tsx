import { createServerClient } from "@/lib/supabase/server";
import { RealtimeBoundary } from "@/components/RealtimeBoundary";
import { ParentHome } from "./ParentHome";
import { fetchNeedsAttention } from "@/lib/insights";

/**
 * Parent home entry — v1 home port.
 *
 * The audit dropped two heavy sections from this page: the family code
 * line (moved into HeaderMenu only) and the activity feed with its
 * open/done tabs. The whole "recent threads" query, unread computation,
 * status counts, and QuickAccessRow counters that supported the feed
 * are gone. What replaces them is a small `Needs attention` list —
 * items due or unread, ranked by urgency, tap-to-open — plus the same
 * greeting → mic → type field composer at the top that was always here.
 */
export default async function ParentPage() {
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
  if (!profile?.family_space_id) return null;

  const language = (profile.language_preference ?? "vi") as "vi" | "en";

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
      "parent",
    ),
    // Small header-menu counts (three head-only queries — cheap). Fuel
    // the QuickAccessRow tiles' tap targets; no user-facing counters
    // appear on the home surface itself per the audit.
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
      channelName={`parent-home-${profile.family_space_id}`}
    >
      <ParentHome
        displayName={
          profile?.display_name ?? (language === "vi" ? "quý vị" : "there")
        }
        language={language}
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
