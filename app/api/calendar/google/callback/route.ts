import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@/lib/supabase/server";
import {
  exchangeCode,
  fetchGoogleUserInfo,
} from "@/lib/google-calendar";
import { saveGoogleConnection } from "@/lib/calendar-connections";

/**
 * OAuth callback. Google redirects the user here with a `code` (or
 * `error`) query param. We:
 *   1. Verify CSRF state cookie against the query `state`
 *   2. Exchange the code for a token set
 *   3. Look up which Google account was linked (for the confirmation UI)
 *   4. Persist the connection to `calendar_connections`
 *   5. Redirect back to /settings with a success flag
 *
 * Any failure surfaces via ?calendarError=... on /settings so the user
 * sees why. We don't leak Google's raw error text — kept short.
 */
export const dynamic = "force-dynamic";

function settingsUrl(request: NextRequest, params: Record<string, string> = {}) {
  const url = new URL("/settings", request.url);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const stateFromGoogle = url.searchParams.get("state");
  const errorFromGoogle = url.searchParams.get("error");

  if (errorFromGoogle) {
    // User declined, or Google rejected our request (bad scope, etc.).
    return NextResponse.redirect(
      settingsUrl(request, {
        calendarError:
          errorFromGoogle === "access_denied"
            ? "You cancelled the Google sign-in."
            : "Google refused the connection. Please try again.",
      }),
    );
  }
  if (!code) {
    return NextResponse.redirect(
      settingsUrl(request, { calendarError: "Missing auth code." }),
    );
  }

  // CSRF: state cookie was set by /connect and must match Google's echo.
  const jar = cookies();
  const cookieState = jar.get("noi_gcal_state")?.value;
  if (!cookieState || cookieState !== stateFromGoogle) {
    return NextResponse.redirect(
      settingsUrl(request, {
        calendarError: "Sign-in expired. Please try connecting again.",
      }),
    );
  }
  jar.delete("noi_gcal_state");

  // Must still be signed in — otherwise we don't know which family
  // member's connection to save.
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    const tokens = await exchangeCode(code);
    const identity = await fetchGoogleUserInfo(tokens.access_token);
    await saveGoogleConnection(user.id, tokens, identity);
  } catch (err) {
    console.error("[calendar/google/callback]", err);
    return NextResponse.redirect(
      settingsUrl(request, {
        calendarError:
          err instanceof Error
            ? err.message.slice(0, 140)
            : "Could not connect Google Calendar.",
      }),
    );
  }

  return NextResponse.redirect(
    settingsUrl(request, { calendarConnected: "1" }),
  );
}
