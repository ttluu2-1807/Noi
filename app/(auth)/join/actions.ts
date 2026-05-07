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

  const { error: upsertError } = await admin.from("profiles").upsert({
    id: user.id,
    family_space_id: space.id,
    // Preserve existing role if set, else default to 'parent' for this flow.
    role: existing?.role ?? "parent",
    // Display name may already exist from /setup; don't overwrite.
    ...(existing ? {} : { display_name: user.email?.split("@")[0] ?? "Member" }),
    language_preference: existing?.role === "child" ? "en" : "vi",
  });

  if (upsertError) {
    redirect(`/join?error=${encodeURIComponent(upsertError.message)}`);
  }

  // Route based on the role we just saved.
  redirect((existing?.role ?? "parent") === "parent" ? "/parent" : "/child");
}
