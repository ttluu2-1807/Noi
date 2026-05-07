"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";

export async function sendMagicLink(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!email || !email.includes("@")) {
    redirect(`/login?error=${encodeURIComponent("Please enter a valid email.")}`);
  }

  const supabase = createServerClient();
  const origin = headers().get("origin") ?? "http://localhost:3000";

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      // After the user clicks the link, Supabase redirects here with a ?code=
      // param. Our callback route exchanges that code for a session.
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect(`/verify?email=${encodeURIComponent(email)}`);
}
