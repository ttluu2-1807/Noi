import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Root page — routes users based on auth state and role:
 *   - no session       → /login
 *   - no profile       → /setup
 *   - role = parent    → /parent
 *   - role = child     → /child
 */
export default async function Home() {
  const supabase = createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, family_space_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || !profile.family_space_id) redirect("/setup");

  redirect(profile.role === "parent" ? "/parent" : "/child");
}
