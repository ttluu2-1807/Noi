import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { refreshAccessToken, type TokenSet } from "@/lib/google-calendar";

/**
 * Storage + refresh helpers for calendar_connections rows.
 *
 * Table shape (see the SQL migration in Slice A comments):
 *   id                          uuid pk
 *   user_id                     uuid (auth.users)
 *   provider                    text ('google')
 *   refresh_token               text (long-lived, treat as secret)
 *   access_token                text (short-lived, refreshed on-demand)
 *   access_token_expires_at     timestamptz
 *   connected_email             text (which Google account was linked)
 *   connected_name              text
 *   connected_at                timestamptz default now()
 *   updated_at                  timestamptz default now()
 *
 * RLS: users can only read/write their own row. Sync jobs use the
 * service-role client (createServiceRoleClient) to bypass RLS.
 */

export interface CalendarConnection {
  id: string;
  user_id: string;
  provider: "google";
  refresh_token: string;
  access_token: string;
  access_token_expires_at: string;
  connected_email: string | null;
  connected_name: string | null;
}

/**
 * Fetch this user's Google connection (or null if not connected).
 * Uses the supplied Supabase client — server actions pass their RLS-
 * scoped client, cron jobs pass the service-role client.
 */
export async function getGoogleConnection(
  supabase: SupabaseClient,
  userId: string,
): Promise<CalendarConnection | null> {
  const { data } = await supabase
    .from("calendar_connections")
    .select(
      "id, user_id, provider, refresh_token, access_token, access_token_expires_at, connected_email, connected_name",
    )
    .eq("user_id", userId)
    .eq("provider", "google")
    .maybeSingle();
  if (!data) return null;
  return data as CalendarConnection;
}

/**
 * Upsert a Google connection on OAuth success. If the user re-connects
 * (e.g. switched Google accounts) we replace the token set in place.
 */
export async function saveGoogleConnection(
  userId: string,
  tokens: TokenSet,
  identity: { email: string | null; name: string | null },
): Promise<void> {
  // refresh_token is mandatory — without it the connection dies as soon
  // as the access token expires (~1 hour) and the user has to re-auth.
  if (!tokens.refresh_token) {
    throw new Error(
      "Google returned no refresh_token — the OAuth flow needs access_type=offline + prompt=consent.",
    );
  }
  const admin = createServiceRoleClient();
  const { error } = await admin.from("calendar_connections").upsert(
    {
      user_id: userId,
      provider: "google",
      refresh_token: tokens.refresh_token,
      access_token: tokens.access_token,
      access_token_expires_at: tokens.expires_at,
      connected_email: identity.email,
      connected_name: identity.name,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,provider" },
  );
  if (error) throw new Error(`saveGoogleConnection: ${error.message}`);
}

/**
 * Delete this user's Google connection. Called from the settings
 * "Disconnect" button. RLS-scoped so a user can only delete their own.
 */
export async function deleteGoogleConnection(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  await supabase
    .from("calendar_connections")
    .delete()
    .eq("user_id", userId)
    .eq("provider", "google");
}

/**
 * Return a valid (non-expired) access token for this user, refreshing
 * it against Google's token endpoint if the stored one has expired or
 * is within 60 seconds of expiring. The refreshed token is persisted.
 *
 * Throws if the user has no connection, or if Google rejects the
 * refresh (usually means they revoked access — connection should be
 * treated as dead + the user prompted to re-connect).
 */
export async function getValidAccessToken(
  supabase: SupabaseClient,
  userId: string,
): Promise<string> {
  const conn = await getGoogleConnection(supabase, userId);
  if (!conn) throw new Error("No Google connection for user");

  const expiresAt = new Date(conn.access_token_expires_at).getTime();
  const now = Date.now();
  // Refresh if within 60s of expiry — dodges races where the token
  // becomes stale mid-request.
  if (expiresAt - now > 60_000) return conn.access_token;

  const refreshed = await refreshAccessToken(conn.refresh_token);
  const admin = createServiceRoleClient();
  await admin
    .from("calendar_connections")
    .update({
      access_token: refreshed.access_token,
      access_token_expires_at: refreshed.expires_at,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("provider", "google");
  return refreshed.access_token;
}
