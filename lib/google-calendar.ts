/**
 * Minimal Google Calendar OAuth + read helper. No googleapis SDK —
 * we hit the OAuth 2.0 + Calendar v3 REST endpoints directly. Keeps
 * bundle small and dependencies few.
 *
 * Flow:
 *   1. buildAuthUrl(userId)   — redirect the user here to start OAuth
 *   2. exchangeCode(code)     — callback handler swaps code for tokens
 *   3. refreshAccessToken()   — server-side, extends expired access tokens
 *   4. listEvents()           — fetches events from the primary calendar
 *
 * We only ask for `calendar.readonly` scope — Noi never writes events.
 */

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const CALENDAR_ENDPOINT = "https://www.googleapis.com/calendar/v3";

// Scopes we request. Read-only calendar + user info (for display name
// + email on the connect confirmation UI).
const SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "openid",
  "email",
  "profile",
].join(" ");

interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/**
 * Read OAuth config from env — throws with a clear message if any is
 * missing so callers get actionable output rather than "undefined" from
 * inside the Google API.
 */
export function getOAuthConfig(): OAuthConfig {
  // Both client id and secret stay server-only — nothing in the
  // client bundle needs to know either. The OAuth flow is server-
  // initiated (see /api/calendar/google/connect) and the browser
  // just follows the redirect. Vercel's warning about
  // NEXT_PUBLIC_CLIENT_ID leaking to the browser is correct even
  // though OAuth client IDs are technically public — no reason to
  // ship it if we don't have to.
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Google OAuth env vars missing — set GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REDIRECT_URI.",
    );
  }
  return { clientId, clientSecret, redirectUri };
}

/**
 * Build the authorisation URL. `state` is a CSRF-protection nonce that
 * MUST be verified in the callback (we round-trip the calling user's
 * id + a random string, and check both).
 */
export function buildAuthUrl(state: string): string {
  const { clientId, redirectUri } = getOAuthConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES,
    // Ask for offline access so we get a refresh_token — otherwise
    // the connection dies as soon as the initial access_token expires
    // in an hour.
    access_type: "offline",
    // Force the consent screen even if the user has already granted —
    // otherwise Google won't re-issue a refresh_token on subsequent
    // grants, and if we lost the first one the user is stuck.
    prompt: "consent",
    state,
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

export interface TokenSet {
  access_token: string;
  refresh_token: string | null;
  expires_at: string; // ISO
  scope: string;
  token_type: string;
  id_token?: string;
}

interface RawTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
  id_token?: string;
}

/**
 * Exchange an authorisation code (from the OAuth callback) for a token
 * set. Called by the callback route handler.
 */
export async function exchangeCode(code: string): Promise<TokenSet> {
  const { clientId, clientSecret, redirectUri } = getOAuthConfig();
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google token exchange failed: ${res.status} ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as RawTokenResponse;
  return toTokenSet(data);
}

/**
 * Extend an expired access token using the stored refresh token.
 * Google's refresh tokens don't expire (for consumer apps) but they
 * can be revoked by the user; a 400 here means we should treat the
 * connection as dead and prompt reconnect.
 */
export async function refreshAccessToken(refreshToken: string): Promise<TokenSet> {
  const { clientId, clientSecret } = getOAuthConfig();
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google token refresh failed: ${res.status} ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as RawTokenResponse;
  // A refresh flow doesn't return a fresh refresh_token — preserve it.
  return {
    ...toTokenSet(data),
    refresh_token: refreshToken,
  };
}

function toTokenSet(raw: RawTokenResponse): TokenSet {
  const expiresAt = new Date(Date.now() + raw.expires_in * 1000).toISOString();
  return {
    access_token: raw.access_token,
    refresh_token: raw.refresh_token ?? null,
    expires_at: expiresAt,
    scope: raw.scope,
    token_type: raw.token_type,
    id_token: raw.id_token,
  };
}

/**
 * Fetch the calendar events for a connected user within a time window.
 * Uses the primary calendar only for v1 — later we can enumerate all
 * calendars the user granted access to (busy family calendars, work
 * calendars, etc.) via calendarList.list.
 */
export interface CalendarEvent {
  id: string;
  summary: string | null;
  start: string; // ISO
  end: string; // ISO
  all_day: boolean;
  location: string | null;
}

interface RawGoogleEvent {
  id: string;
  summary?: string;
  location?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  status?: string;
}

export async function listPrimaryEvents(
  accessToken: string,
  timeMinIso: string,
  timeMaxIso: string,
): Promise<CalendarEvent[]> {
  const params = new URLSearchParams({
    timeMin: timeMinIso,
    timeMax: timeMaxIso,
    singleEvents: "true", // expand recurring events into instances
    orderBy: "startTime",
    maxResults: "250",
  });
  const res = await fetch(
    `${CALENDAR_ENDPOINT}/calendars/primary/events?${params.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google Calendar list failed: ${res.status} ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as { items?: RawGoogleEvent[] };
  return (data.items ?? [])
    .filter((e) => e.status !== "cancelled")
    .map((e): CalendarEvent => {
      const startDt = e.start?.dateTime;
      const startDate = e.start?.date;
      const endDt = e.end?.dateTime;
      const endDate = e.end?.date;
      const allDay = !startDt && !!startDate;
      // For all-day events, Google gives just a date; convert to ISO
      // at UTC midnight so the DB timestamp column can store it.
      const startIso = startDt ?? `${startDate}T00:00:00Z`;
      const endIso = endDt ?? `${endDate}T00:00:00Z`;
      return {
        id: e.id,
        summary: (e.summary ?? null) as string | null,
        start: startIso,
        end: endIso,
        all_day: allDay,
        location: (e.location ?? null) as string | null,
      };
    });
}

/**
 * Return the Google user's email address for a token — used to show
 * "Connected as noi.parent@gmail.com" on the settings screen so the
 * user knows which account was linked.
 */
export async function fetchGoogleUserInfo(
  accessToken: string,
): Promise<{ email: string | null; name: string | null }> {
  const res = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return { email: null, name: null };
  const data = (await res.json()) as { email?: string; name?: string };
  return {
    email: data.email ?? null,
    name: data.name ?? null,
  };
}
