"use server";

import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";

/**
 * Mark the parent as having seen the first-run tour. The layout
 * guard only redirects to /onboarding when `onboarded_at` is null,
 * so setting it sends them straight on to /parent next request.
 */
export async function completeOnboarding() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase
    .from("profiles")
    .update({ onboarded_at: new Date().toISOString() })
    .eq("id", user.id);

  redirect("/parent");
}
