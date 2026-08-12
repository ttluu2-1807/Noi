import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { TabBar } from "@/components/TabBar";
import type { Language } from "@/lib/language-detect";

/**
 * Auth guard for all authenticated routes. Rejects unauthenticated users
 * to /login and users without a complete profile to /setup or /join.
 *
 * Also renders the persistent bottom TabBar (Home / Threads / To-dos /
 * Diary) per audit T3. Content pages should reserve pb-24 or similar on
 * their main container so the tail content stays clear of the bar.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, family_space_id, display_name, language_preference, onboarded_at")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) redirect("/setup");
  // Legacy safety net: in the current flow /setup always creates or joins a
  // family space before the profile is written, so no profile should be
  // family-less. Older accounts predating that change may still land here.
  if (!profile.family_space_id) redirect("/setup");
  // Parents see a 3-screen welcome tour the first time they sign in.
  // Children skip it for now — they're bilingual and figure the UI out
  // faster. The tour lives at /onboarding (outside this layout group)
  // so its own redirect-when-done can send users back here without
  // looping through this guard.
  if (profile.role === "parent" && !profile.onboarded_at) {
    redirect("/onboarding");
  }

  const role = profile.role as "parent" | "child";
  const language = (profile.language_preference ?? "vi") as Language;

  return (
    <>
      {/* Content — bottom padding leaves room for the fixed TabBar +
          any inline FAB. The TabBar itself sits above safe-area. */}
      <div className="pb-24">{children}</div>
      <TabBar role={role} language={language} />
    </>
  );
}
