import type { SupabaseClient } from "@supabase/supabase-js";

export type FamilyMember = {
  id: string;
  display_name: string;
  role: "parent" | "child";
};

/**
 * Fetch every member of a family with their display name and role.
 * A family typically has 2-5 members so this is a cheap query —
 * we use it as a lookup map for sender attribution everywhere.
 */
export async function fetchFamilyMembers(
  supabase: SupabaseClient,
  familySpaceId: string,
): Promise<FamilyMember[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, role")
    .eq("family_space_id", familySpaceId);
  if (error || !data) return [];
  return data.map((p) => ({
    id: p.id as string,
    display_name: (p.display_name ?? "Family member") as string,
    role: p.role as "parent" | "child",
  }));
}

/**
 * Build a quick lookup map: user_id → display_name. Useful for
 * surfaces that render lots of rows and want O(1) name lookup.
 */
export function membersById(
  members: FamilyMember[],
): Record<string, FamilyMember> {
  const out: Record<string, FamilyMember> = {};
  for (const m of members) out[m.id] = m;
  return out;
}
