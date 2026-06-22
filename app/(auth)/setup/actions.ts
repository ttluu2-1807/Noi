"use server";

import { redirect } from "next/navigation";
import { createServerClient, createServiceRoleClient } from "@/lib/supabase/server";

/**
 * First-time setup after magic-link sign-in.
 *
 * Three branches, all from a single form:
 *   1. role=parent, mode=new    → create a new family, parent is first member
 *   2. role=parent, mode=join   → join an existing family via invite code (second parent)
 *   3. role=child              → /setup is no longer the child entry-point;
 *                                kids/helpers join via /join with a code their
 *                                parent shared.
 *
 * Uses the service role to bypass the self-referential profiles RLS policy.
 * Identity is verified from the session cookie before any write.
 */
export async function completeSetup(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? "");
  const mode = String(formData.get("mode") ?? "new");
  const rawCode = String(formData.get("code") ?? "").trim().toUpperCase();
  const code = rawCode.replace(/[^A-Z0-9]/g, "");

  if (!name) {
    redirect(`/setup?error=${encodeURIComponent("Please enter your name.")}`);
  }
  if (role !== "parent" && role !== "child") {
    redirect(`/setup?error=${encodeURIComponent("Please choose a role.")}`);
  }
  if ((role === "child" || mode === "join") && code.length !== 6) {
    redirect(`/setup?error=${encodeURIComponent("Family codes are 6 characters.")}`);
  }

  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createServiceRoleClient();

  // Branches 2 + 3: anything joining an existing family.
  if (mode === "join" || role === "child") {
    const { data: space, error: spaceError } = await admin
      .from("family_spaces")
      .select("id")
      .eq("invite_code", code)
      .maybeSingle();

    if (spaceError) {
      redirect(`/setup?error=${encodeURIComponent(spaceError.message)}`);
    }
    if (!space) {
      redirect(`/setup?error=${encodeURIComponent("We couldn't find that family code.")}`);
    }

    const { error: profileError } = await admin.from("profiles").upsert({
      id: user.id,
      display_name: name,
      role,
      // Parents default to Vietnamese, children to English. Either can change later.
      language_preference: role === "parent" ? "vi" : "en",
      family_space_id: space.id,
    });
    if (profileError) {
      redirect(`/setup?error=${encodeURIComponent(profileError.message)}`);
    }
    redirect(role === "parent" ? "/parent" : "/child");
  }

  // Branch 1: parent starting a brand-new family.
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
    role: "parent",
    language_preference: "vi",
    family_space_id: space.id,
  });
  if (profileError) {
    redirect(`/setup?error=${encodeURIComponent(profileError.message)}`);
  }
  redirect(`/setup/invite?code=${encodeURIComponent(space.invite_code)}`);
}
