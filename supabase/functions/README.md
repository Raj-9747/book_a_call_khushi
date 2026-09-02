# Supabase Edge Functions — Zaptly

These run server-side with the `service_role` key (never exposed to the browser). They handle anything the frontend-only architecture can't safely do itself: creating/updating Supabase Auth users, and later, relaying booking events to n8n.

## Functions

| Function | Purpose |
|---|---|
| `create-admin` | Super-admin "Add Admin" — creates the Auth user with an email + password the super-admin sets directly (no invite email), creates the `admins` row |
| `update-admin` | Super-admin "Edit Admin" — updates name/email, and/or resets the password directly |
| `remove-admin` | Super-admin "Remove Admin" — deletes the Auth user (cascades to their data) |

More will be added as we build the booking flow (e.g. a function to relay new bookings to the n8n webhook).

## One-time setup (do this once you have the Supabase CLI installed)

```bash
# Log in (opens a browser to authorize the CLI)
supabase login

# Link this repo to your Supabase project (finds the project ref in your dashboard URL)
supabase link --project-ref <your-project-ref>

# SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY are
# automatically available to Edge Functions — no secrets need to be set manually.

# Deploy
supabase functions deploy create-admin
supabase functions deploy update-admin
supabase functions deploy remove-admin
```

No Auth email templates or redirect URL configuration are required for admin management — accounts are created directly with a password, not via invite email.
