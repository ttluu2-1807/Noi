import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { buildAuthUrl } from "@/lib/google-calendar";
import { cookies } from "next/headers";
import crypto from "node:crypto";

/**
 * Kicks off the Google OAuth flow.
 *
 * We generate a random state token, drop it into an HttpOnly cookie
 * (short TTL), and pass the same value to Google. The callback route
 * verifies the two match — that's our CSRF protection.
 *
 * User must be signed in; anonymous callers get 401.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(
      new URL("/login", process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
    );
  }

  const state = crypto.randomBytes(24).toString("hex");
  cookies().set("noi_gcal_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 10, // 10 minutes — long enough to finish an OAuth flow
    path: "/",
  });

  return NextResponse.redirect(buildAuthUrl(state));
}
