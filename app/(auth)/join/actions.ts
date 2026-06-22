"use server";

import { redirect } from "next/navigation";
import { createServerClient, createServiceRoleClient } from "@/lib/supabase/server";

export async function joinFamily(formData: FormData) {
  const rawCode = String(formData.get("code") ?? "").trim().toUpperCase();
  const code = rawCode.replace(/[^A-Z0-9]/g, ""); // tolerate dashes/spaces

  if (code.length !== 6) {
    redirect(`/join?error=${encodeURIComponent("Codes are 6 characters.")}`);
  }

  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createServiceRoleClient();

  const { data: space, error: spaceError } = await admin
    .from("family_spaces")
    .select("id")
    .eq("invite_code", code)
    .maybeSingle();

  if (spaceError) {
    redirect(`/join?error=${encodeURIComponent(spaceError.message)}`);
  }
  if (!space) {
    redirect(`/join?error=${encodeURIComponent("We couldn't find that family code.")}`);
  }

  // Look up the user's profile — it may already exist from /setup (parent role),
  // or not yet (someone arriving at /join as an alternative entry).
  const { data: existing } = await admin
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();

  // Default role for someone arriving at /join WITHOUT a pre-existing
  // profile is now 'child' — they're a sibling / additional family
  // member joining via the new entry on /setup. The original parent
  // flow (the Vietnamese-speaking elder) goes through /setup picking
  // "I'm the parent" first, which creates a profile with role=parent,
  // so when they reach /join the existing role is preserved here.
  const defaultRole = existing?.role ?? "child";

  const { error: upsertError } = await admin.from("profiles").upsert({
    id: user.id,
    family_space_id: space.id,
    role: defaultRole,
    // Display name may already exist from /setup; don't overwrite.
    ...(existing ? {} : { display_name: user.email?.split("@")[0] ?? "Member" }),
    language_preference: defaultRole === "child" ? "en" : "vi",
  });

  if (upsertError) {
    redirect(`/join?error=${encodeURIComponent(upsertError.message)}`);
  }

  // Route based on the role we just saved.
  redirect(defaultRole === "parent" ? "/parent" : "/child");
}
