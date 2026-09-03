# Supabase Edge Functions — Zaptly

These run server-side with the `service_role` key (never exposed to the browser). They handle anything the frontend-only architecture can't safely do itself: creating/updating Supabase Auth users, exchanging Google OAuth codes, and later, relaying booking events to n8n.

## Functions

| Function | Purpose |
|---|---|
| `create-admin` | Super-admin "Add Admin" — creates the Auth user with an email + password the super-admin sets directly (no invite email), creates the `admins` row |
| `update-admin` | Super-admin "Edit Admin" — updates name/email, and/or resets the password directly |
| `remove-admin` | Super-admin "Remove Admin" — deletes the Auth user (cascades to their data) |
| `connect-google-calendar` | An admin's "Connect Google Calendar" — exchanges the OAuth code Google returns for a refresh token, stores it against that admin's own row |
| `disconnect-google-calendar` | Revokes the token with Google and clears it from that admin's row |

More will be added once the n8n booking-confirmation relay is built.

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

# Deploy
supabase functions deploy create-admin
supabase functions deploy update-admin
supabase functions deploy remove-admin
supabase functions deploy connect-google-calendar
supabase functions deploy disconnect-google-calendar
```

No Auth email templates or redirect URL configuration are required for admin management — accounts are created directly with a password, not via invite email.

## Google Cloud OAuth client setup

In your Google Cloud project's OAuth 2.0 Client (APIs & Services → Credentials):

- **Authorized redirect URIs** — add both, so it works locally and once deployed:
  - `http://localhost:3000/dashboard/calendar/callback`
  - `https://<your-production-domain>/dashboard/calendar/callback`
- **Scope requested**: `https://www.googleapis.com/auth/calendar` (read + write — needed both to check for conflicts and to create events later)
- Make sure the **Google Calendar API** is enabled for the project (APIs & Services → Library).
