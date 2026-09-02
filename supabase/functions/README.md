# Supabase Edge Functions — Zaptly

These run server-side with the `service_role` key (never exposed to the browser). They handle anything the frontend-only architecture can't safely do itself: creating Supabase Auth users, and later, relaying booking events to n8n.

## Functions

| Function | Purpose |
|---|---|
| `invite-admin` | Super-admin "Add Admin" — creates the Auth user, sends the invite email, creates the `admins` row |
| `remove-admin` | Super-admin "Remove Admin" — deletes the Auth user (cascades to their data) |

More will be added as we build the booking flow (e.g. a function to relay new bookings to the n8n webhook).

## One-time setup (do this once you have the Supabase CLI installed)

```bash
# Link this repo to your Supabase project (finds the project ref in your dashboard URL)
supabase link --project-ref <your-project-ref>

# Set the secrets these functions need (never committed to git)
supabase secrets set SITE_URL=http://localhost:3000   # or your deployed URL
# SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY are
# automatically available to Edge Functions — no need to set them manually.

# Deploy
supabase functions deploy invite-admin
supabase functions deploy remove-admin
```

## Auth redirect configuration (required for invites to work)

In the Supabase dashboard → Authentication → URL Configuration:
- **Site URL**: your app's URL (e.g. `http://localhost:3000` for local dev, or your production domain later)
- **Redirect URLs**: add `<your-app-url>/auth/callback`

Without this, the invite email link won't be allowed to redirect back into the app.
