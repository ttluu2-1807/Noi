import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { OnboardingTour } from "./OnboardingTour";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, role, language_preference, onboarded_at")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) redirect("/setup");
  // Already onboarded — kick them home.
  if (profile.onboarded_at) {
    redirect(profile.role === "parent" ? "/parent" : "/child");
  }

  const language = (profile.language_preference ?? "vi") as "vi" | "en";

  return (
    <OnboardingTour
      language={language}
      displayName={
        profile.display_name ?? (language === "vi" ? "quý vị" : "there")
      }
    />
  );
}
