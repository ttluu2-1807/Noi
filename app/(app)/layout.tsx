import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";

/**
 * Auth guard for all authenticated routes. Rejects unauthenticated users
 * to /login and users without a complete profile to /setup or /join.
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
    .select("id, role, family_space_id, display_name, language_preference")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) redirect("/setup");
  if (!profile.family_space_id) redirect("/join");

  return <>{children}</>;
}
