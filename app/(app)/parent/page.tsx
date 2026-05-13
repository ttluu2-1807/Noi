import { createServerClient } from "@/lib/supabase/server";
import { RealtimeBoundary } from "@/components/RealtimeBoundary";
import { ParentHome } from "./ParentHome";
import type { ThreadSummary } from "@/components/ThreadCard";

export const dynamic = "force-dynamic";

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

  const language = (profile?.language_preference ?? "vi") as "vi" | "en";

  const { data: threads } = await supabase
    .from("threads")
    .select("id, title_vi, title_en, category_tag, status, updated_at, initiated_by_role")
    .eq("family_space_id", profile!.family_space_id!)
    .order("updated_at", { ascending: false })
    .limit(10);

  return (
    <RealtimeBoundary
      tables={["threads", "messages"]}
      channelName={`parent-home-${profile?.family_space_id ?? "none"}`}
    >
      <ParentHome
        displayName={
          profile?.display_name ?? (language === "vi" ? "quý vị" : "there")
        }
        recentThreads={(threads ?? []) as ThreadSummary[]}
        language={language}
        familySpaceId={profile!.family_space_id!}
      />
    </RealtimeBoundary>
  );
}
