# Zaptly — Setup Checklist

Things needed from your side to get the current build running and testable. This file grows as we add features — right now it only covers **Step 1: Auth + Super-Admin + Multi-Admin foundation**.

## 1. Supabase project

You said this is already created. I need:

- [ ] **Project URL** and **anon public key** (Project Settings → API) → paste into `.env.local` (copy `.env.local.example` → `.env.local` first)
- [ ] Run the SQL in [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) via the Supabase Dashboard → SQL Editor → New Query → paste → Run

No Auth email/redirect configuration is needed — admins are created directly with an email + password the super-admin sets, not via invite email.

## 2. Bootstrap the first super-admin (one-time, manual — chicken-and-egg problem)

Every other admin is created through the in-app "Add Admin" flow, but the very first super-admin account can't create itself. Do this once:

1. Supabase Dashboard → Authentication → Users → **Add user** → enter your email, set a password, and **check "Auto Confirm User"**.
2. Copy the new user's UID.
3. Supabase Dashboard → SQL Editor, run:
   ```sql
   insert into admins (auth_user_id, name, email, slug, role, is_active)
   values ('<paste-the-user-uid-here>', 'Your Name', 'your@email.com', 'admin', 'super_admin', true);
   ```
4. You can now log in at `/login` with that email + the password you set.

## 3. Supabase Edge Functions (needed for "Add Admin" / "Edit Admin" / "Remove Admin" to work)

- [ ] Install the Supabase CLI if you don't have it: `npm install -g supabase`
- [ ] Follow [`supabase/functions/README.md`](supabase/functions/README.md) to log in, link the project, and deploy `create-admin`, `update-admin`, and `remove-admin`

## 4. Local app setup

```bash
cp .env.local.example .env.local
# fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_SITE_URL
npm install
npm run dev
```

Visit `http://localhost:3000` — you should land on `/login`.

## What you can test after this step

1. Log in as the super-admin you bootstrapped above → should land on `/admin`.
2. Click "Add admin" → enter a name, email, and password → the new admin can log in immediately with those credentials (no email involved).
3. Log in as that new admin → lands on their empty `/dashboard` → try Settings → Change password.
4. Log back in as super-admin → open the admin's "Edit" menu → change their name/email, or set a new password → confirm it takes effect.
5. Deactivate that admin → confirm they can no longer log in. Reactivate → confirm they can log in again.
6. Remove an admin → confirm their account is gone (and Supabase Dashboard → Authentication → Users shows them deleted too).

---

## Still to come (not needed yet, listed so nothing is a surprise later)

- Google Cloud project + OAuth credentials (Calendar connect) — needed before the "connect calendar" feature
- n8n instance URL + credentials (Google Calendar, Zaple WhatsApp, email/SMTP) — needed before the booking-confirmation flow
- Zaple account/API key — needed before WhatsApp notifications
- A domain, once we're ready to deploy beyond `localhost`
