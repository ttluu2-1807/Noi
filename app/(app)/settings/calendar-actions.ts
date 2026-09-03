"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { deleteGoogleConnection } from "@/lib/calendar-connections";

/**
 * Unlink the calling user's Google Calendar connection. Doesn't try
 * to revoke the token on Google's side — the user can do that from
 * their Google account if they want; disconnecting here just deletes
 * our local reference so subsequent syncs stop.
 */
export async function disconnectGoogleCalendar(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  try {
    await deleteGoogleConnection(supabase, user.id);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to disconnect",
    };
  }
  revalidatePath("/settings");
  return { ok: true };
}
