import { createServerClient as createSSRClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

type CookiesToSet = Array<{ name: string; value: string; options: CookieOptions }>;

/**
 * Supabase client for Server Components, Route Handlers, and Server Actions.
 *
 * Uses the `getAll` / `setAll` cookie API — this is the @supabase/ssr v0.5+
 * recommended contract. The old `get`/`set`/`remove` shape still compiles
 * but doesn't play well with the PKCE flow (the verifier cookie can be
 * dropped between "send magic link" and the callback), so we use the new
 * batched API throughout.
 *
 * `setAll` is wrapped in a try/catch because the same client is used from
 * Server Components, where cookies can't be mutated. Middleware refreshes
 * the session cookie on every request, so missing a write here is harmless.
 */
export function createServerClient() {
  const cookieStore = cookies();

  return createSSRClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Called from a Server Component — ignore. Middleware handles refresh.
          }
        },
      },
    },
  );
}

/**
 * Service-role client — bypasses RLS. Use ONLY in server-only code paths
 * where you've verified the user's identity and need to act with elevated
 * privileges (e.g. creating a profile row during first-time setup).
 * NEVER import this from a Client Component.
 */
export function createServiceRoleClient() {
  return createSSRClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll: () => [],
        setAll: () => {},
      },
    },
  );
}
