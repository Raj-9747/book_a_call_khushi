import { createClient } from "@/lib/supabase/client";

const GOOGLE_SCOPE = "https://www.googleapis.com/auth/calendar";

export function getGoogleAuthUrl(redirectUri: string): string {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error("Google Calendar isn't configured yet (missing client ID).");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_SCOPE,
    access_type: "offline",
    // Forces Google to re-issue a refresh token even if the admin already
    // granted consent before — otherwise a reconnect can silently fail to
    // produce one.
    prompt: "consent",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function connectGoogleCalendar(code: string, redirectUri: string): Promise<void> {
  const supabase = createClient();
  const { data, error } = await supabase.functions.invoke("connect-google-calendar", {
    body: { code, redirect_uri: redirectUri },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}

export async function disconnectGoogleCalendar(): Promise<void> {
  const supabase = createClient();
  const { data, error } = await supabase.functions.invoke("disconnect-google-calendar", { body: {} });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}
