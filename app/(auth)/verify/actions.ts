"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";

/**
 * Resend the magic link + OTP token. Same signInWithOtp call — Supabase
 * decides what the email contains based on the template configured in
 * Auth → Email Templates → "Magic Link". Our template renders both the
 * URL (for one-tap users) and the {{ .Token }} 6-digit code (for
 * cross-context / cross-device users) so either path works.
 */
export async function resendMagicLink(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) redirect("/login");

  const supabase = createServerClient();
  const origin = headers().get("origin") ?? "http://localhost:3000";

  await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });

  redirect(`/verify?email=${encodeURIComponent(email)}&resent=1`);
}

/**
 * Exchange the 6-digit code the user typed in for a Supabase session,
 * WITHOUT going through the PKCE URL flow.
 *
 * Why this exists: the magic-link URL flow requires the PKCE code_verifier
 * cookie set on the "send" tap to still be present when the callback URL
 * is opened. That's brittle for elderly users — Mail on iOS sometimes
 * opens links in an isolated WebKit context that doesn't share Safari's
 * cookies; ITP can evict the cookie; the user might switch devices
 * between requesting and clicking. The OTP-code path sidesteps all of
 * it: the code is exchanged directly for a session, no cookie needed.
 *
 * On success we redirect to "/", which then routes based on profile
 * state (setup vs onboarding vs home). On failure we send the user
 * back to /verify with an inline error.
 */
export async function verifyOtpCode(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const token = String(formData.get("code") ?? "").replace(/\s|-/g, "");

  if (!email || !token) {
    redirect(
      `/verify?email=${encodeURIComponent(email)}&error=${encodeURIComponent(
        "Please enter the code from the email.",
      )}`,
    );
  }
  // Accept any 4–10 digit numeric code. Supabase's default OTP length
  // is 6, but the project can be configured to 8 (Auth → Providers →
  // Email → OTP Length). We stay flexible so a config change doesn't
  // silently break sign-in.
  if (!/^\d{4,10}$/.test(token)) {
    redirect(
      `/verify?email=${encodeURIComponent(email)}&error=${encodeURIComponent(
        "That doesn't look like a valid code.",
      )}`,
    );
  }

  const supabase = createServerClient();
  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    // "email" == the OTP token type sent by signInWithOtp. Not to be
    // confused with "magiclink", which is the URL-flow token type.
    type: "email",
  });

  if (error) {
    redirect(
      `/verify?email=${encodeURIComponent(email)}&error=${encodeURIComponent(
        error.message,
      )}`,
    );
  }

  redirect("/");
}
