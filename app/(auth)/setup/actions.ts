"use server";

import { redirect } from "next/navigation";
import { createServerClient, createServiceRoleClient } from "@/lib/supabase/server";

/**
 * First-time setup. Called after a user signs in via magic link
 * but before they have a profile row.
 *
 * For role=child: creates a new family space and profile, then shows
 * the invite code to share with their parent.
 *
 * For role=parent: creates a profile but no family space yet — they'll
 * be redirected to /join to enter their child's invite code.
 *
 * Uses the service role client because the `profiles` RLS policy is
 * self-referential: a brand-new user has no existing row to satisfy
 * the "family_space_id in (select … from profiles where id = auth.uid())"
 * check on insert. The service role client bypasses RLS safely because
 * we've already verified the user's identity from the session cookie.
 */
export async function completeSetup(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? "");

  if (!name) {
    redirect(`/setup?error=${encodeURIComponent("Please enter your name.")}`);
  }
  if (role !== "parent" && role !== "child") {
    redirect(`/setup?error=${encodeURIComponent("Please choose a role.")}`);
  }

  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createServiceRoleClient();

  // Parents wait to join via invite code — create profile with no family yet.
  if (role === "parent") {
    const { error } = await admin.from("profiles").upsert({
      id: user.id,
      display_name: name,
      role: "parent",
      language_preference: "vi",
      family_space_id: null,
    });
    if (error) {
      redirect(`/setup?error=${encodeURIComponent(error.message)}`);
    }
    redirect("/join");
  }

  // Children create a brand-new family space and land as its first member.
  const familyName = `${name}'s family`;
  const { data: space, error: spaceError } = await admin
    .from("family_spaces")
    .insert({ name: familyName })
    .select("id, invite_code")
    .single();

  if (spaceError || !space) {
    redirect(
      `/setup?error=${encodeURIComponent(spaceError?.message ?? "Could not create family space.")}`,
    );
  }

  const { error: profileError } = await admin.from("profiles").upsert({
    id: user.id,
    display_name: name,
    role: "child",
    language_preference: "en",
    family_space_id: space.id,
  });

  if (profileError) {
    redirect(`/setup?error=${encodeURIComponent(profileError.message)}`);
  }

  redirect(`/setup/invite?code=${encodeURIComponent(space.invite_code)}`);
}
