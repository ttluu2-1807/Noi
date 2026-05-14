"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";

export async function updateDisplayName(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("profiles").update({ display_name: name }).eq("id", user.id);
  revalidatePath("/settings");
  revalidatePath("/parent");
  revalidatePath("/child");
}

export async function updateLanguagePreference(formData: FormData) {
  const lang = String(formData.get("language") ?? "");
  if (lang !== "vi" && lang !== "en") return;

  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("profiles")
    .update({ language_preference: lang })
    .eq("id", user.id);
  revalidatePath("/settings");
}

/**
 * Toggle auto-TTS — when on, assistant messages are read aloud
 * automatically as they arrive. Off by default (the user may be in a
 * place where audio is disruptive). Setting persists in the profile so
 * it follows the user across devices.
 */
export async function updateAutoReadResponses(formData: FormData) {
  const value = formData.get("enabled") === "on";

  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("profiles")
    .update({ auto_read_responses: value })
    .eq("id", user.id);
  revalidatePath("/settings");
  revalidatePath("/parent");
  revalidatePath("/child");
}
