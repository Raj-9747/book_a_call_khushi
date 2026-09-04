# Supabase Edge Functions — Zaptly

These run server-side with the `service_role` key (never exposed to the browser). They handle anything the frontend-only architecture can't safely do itself: creating/updating Supabase Auth users, exchanging Google OAuth codes, and later, relaying booking events to n8n.

## Functions

| Function | Purpose |
|---|---|
| `create-admin` | Super-admin "Add Admin" — creates the Auth user with an email + password the super-admin sets directly (no invite email), creates the `admins` row (including phone) |
| `update-admin` | Super-admin "Edit Admin" — updates name/email/phone, and/or resets the password directly. Changing the email clears the stored Google Calendar connection, forcing a reconnect |
| `update-own-profile` | Any admin editing their OWN name/email/phone from Settings — same email-change → reconnect-Calendar behavior as `update-admin` |
| `remove-admin` | Super-admin "Remove Admin" — deletes the Auth user (cascades to their data) |
| `connect-google-calendar` | An admin's "Connect Google Calendar" — exchanges the OAuth code Google returns for a refresh token, stores it against that admin's own row |
| `disconnect-google-calendar` | Revokes the token with Google and clears it from that admin's row |
| `relay-booking-to-n8n` | Fires on every new booking (via a Supabase Database Webhook, not a user action) — refreshes the admin's Google access token if connected, then hands the booking off to n8n for Calendar/Meet creation + confirmation email |
| `get-google-busy-times` | Called by the public booking page (anonymous visitors) to check the admin's real Google Calendar for conflicts, e.g. a meeting created directly in Google rather than through Zaptly. Fails open (returns no busy times) on any error, including an expired token |
| `sync-blocked-slot-calendar` | Called when an admin blocks/unblocks time — mirrors it onto their real Google Calendar as a plain busy event (or removes it). Best-effort; never fails the block itself over a Calendar-side error |
| `delete-booking-calendar-event` | Called when an admin cancels a booking — removes the corresponding event from their real Google Calendar, if one was created. Best-effort, same reasoning |

## One-time setup (do this once you have the Supabase CLI installed)

```bash
# Log in (opens a browser to authorize the CLI)
supabase login

# Link this repo to your Supabase project (finds the project ref in your dashboard URL)
supabase link --project-ref <your-project-ref>

# SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY are
# automatically available to Edge Functions — no need to set those manually.

# Google Calendar OAuth needs these two (same Client ID as
# NEXT_PUBLIC_GOOGLE_CLIENT_ID in .env.local, plus its secret — the secret
# NEVER goes in the Next.js app):
supabase secrets set GOOGLE_CLIENT_ID=<your-google-oauth-client-id>
supabase secrets set GOOGLE_CLIENT_SECRET=<your-google-oauth-client-secret>

# The booking → n8n relay needs these two (see n8n/README.md for how to get
# the webhook URL and pick the random secret):
supabase secrets set N8N_BOOKING_WEBHOOK_URL=<your-n8n-webhook-url>
supabase secrets set BOOKING_WEBHOOK_SECRET=<a-random-string-you-generate>

# Deploy
supabase functions deploy create-admin
supabase functions deploy update-admin
supabase functions deploy update-own-profile
supabase functions deploy remove-admin
supabase functions deploy connect-google-calendar
supabase functions deploy disconnect-google-calendar
supabase functions deploy relay-booking-to-n8n --no-verify-jwt
supabase functions deploy get-google-busy-times --no-verify-jwt
supabase functions deploy sync-blocked-slot-calendar
supabase functions deploy delete-booking-calendar-event
```

> **Re-deploy needed after migration `0009`:** `create-admin`, `update-admin` and `update-own-profile` now return the new profile columns via the shared `_shared/adminColumns.ts` list. Without a re-deploy, editing a profile from the dashboard will still work but the response will be missing the new fields.

`relay-booking-to-n8n` is deployed with `--no-verify-jwt` because it's called by a Supabase Database Webhook, not by a logged-in user — it authorizes the caller with the `x-webhook-secret` header instead (see `n8n/README.md`). `get-google-busy-times` is also `--no-verify-jwt` since it's called by anonymous public booking-page visitors — it's a read-only, non-sensitive lookup (same trust model as the public RPCs), so no auth check is needed.

No Auth email templates or redirect URL configuration are required for admin management — accounts are created directly with a password, not via invite email.

## Google Cloud OAuth client setup

In your Google Cloud project's OAuth 2.0 Client (APIs & Services → Credentials):

- **Authorized redirect URIs** — add both, so it works locally and once deployed:
  - `http://localhost:3000/dashboard/calendar/callback`
  - `https://<your-production-domain>/dashboard/calendar/callback`
- **Scope requested**: `https://www.googleapis.com/auth/calendar` (read + write — needed both to check for conflicts and to create events later)
- Make sure the **Google Calendar API** is enabled for the project (APIs & Services → Library).
