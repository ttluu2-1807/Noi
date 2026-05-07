import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookiesToSet = Array<{ name: string; value: string; options: CookieOptions }>;

/**
 * Session-refresh helper called by middleware.ts on every request.
 * Keeps the auth cookie fresh so RSC reads never hit an expired token.
 *
 * Uses the @supabase/ssr v0.5+ `getAll` / `setAll` cookie contract. This
 * is the shape the SDK expects for PKCE flows to persist the code
 * verifier cookie correctly across the "send magic link → click link"
 * boundary.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookiesToSet) {
          // Mirror cookies back onto the request so subsequent reads in the
          // same request see the new values.
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          // Rebuild the response with the updated request, then apply the
          // cookies with their full options to the outgoing response.
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  // Touches the session so expired tokens get refreshed.
  await supabase.auth.getUser();

  return response;
}
