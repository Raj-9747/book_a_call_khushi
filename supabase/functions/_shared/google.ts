// Shared Google OAuth token refresh — used by every Edge Function that
// needs to act on an admin's Google Calendar on their behalf (relay to
// n8n, FreeBusy check, calendar event create/delete for manual blocks and
// cancellations).
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

export async function refreshGoogleAccessToken(refreshToken: string): Promise<string | null> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      grant_type: "refresh_token",
    }),
  });
  const data = await response.json();
  return response.ok ? data.access_token : null;
}
