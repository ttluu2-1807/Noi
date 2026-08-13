"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createServerClient,
  createServiceRoleClient,
} from "@/lib/supabase/server";

/**
 * "Switch to a different family" — for users who joined the wrong
 * family (e.g. wrong code entered) or who literally need to move to
 * another family space (a sibling's family in a different household).
 *
 * The user's profile.family_space_id is updated to the new family.
 * They keep their role and display name; the previous family's data
 * (threads, todos, diary) still exists for that family's other members
 * but is no longer visible to this user.
 *
 * Uses the service-role client because the profile row's RLS policies
 * are self-referential; moving the family_space_id needs to happen
 * without the "still a member of your current family" check.
 *
 * On success we redirect the user to / which routes them into the
 * new family's home. On failure we redirect back to /settings with
 * an error query param.
 */
export async function switchFamily(formData: FormData) {
  const rawCode = String(formData.get("code") ?? "").trim().toUpperCase();
  const code = rawCode.replace(/[^A-Z0-9]/g, "");

  if (code.length !== 6) {
    redirect(
      `/settings?familyError=${encodeURIComponent(
        "Family codes are 6 characters.",
      )}`,
    );
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
    redirect(
      `/settings?familyError=${encodeURIComponent(spaceError.message)}`,
    );
  }
  if (!space) {
    redirect(
      `/settings?familyError=${encodeURIComponent(
        "We couldn't find that family code.",
      )}`,
    );
  }

  // Read the current family so we can no-op if they're trying to
  // "switch" into the same family they're already in.
  const { data: profile } = await admin
    .from("profiles")
    .select("family_space_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.family_space_id === space.id) {
    redirect(
      `/settings?familyError=${encodeURIComponent(
        "You're already in that family.",
      )}`,
    );
  }

  const { error: updateError } = await admin
    .from("profiles")
    .update({ family_space_id: space.id })
    .eq("id", user.id);

  if (updateError) {
    redirect(
      `/settings?familyError=${encodeURIComponent(updateError.message)}`,
    );
  }

  // Broad invalidation — the user's whole app just changed families,
  // so every server-cached family-scoped view is now stale.
  revalidatePath("/", "layout");

  redirect("/");
}
