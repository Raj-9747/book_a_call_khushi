# Zaptly — Setup Checklist

Things needed from your side to get the current build running and testable. This file grows as we add features — right now it only covers **Step 1: Auth + Super-Admin + Multi-Admin foundation**.

## 1. Supabase project

You said this is already created. I need:

- [ ] **Project URL** and **anon public key** (Project Settings → API) → paste into `.env.local` (copy `.env.local.example` → `.env.local` first)
- [ ] Run the SQL in [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) via the Supabase Dashboard → SQL Editor → New Query → paste → Run
- [ ] Already ran `0001_init.sql` before the founder→admin rename? Also run [`supabase/migrations/0002_rename_founder_to_admin.sql`](supabase/migrations/0002_rename_founder_to_admin.sql) — it renames the `founders` table to `admins`, updates the role values/columns/functions to match, and is safe to run even if you already inserted your bootstrap super-admin row (it updates existing data in place). Skip this file entirely on a brand-new project that only ever ran `0001_init.sql` after this point.
- [ ] In Authentication → URL Configuration, set:
  - **Site URL**: `http://localhost:3000` (for now)
  - **Redirect URLs**: add `http://localhost:3000/auth/callback`
- [ ] In Authentication → Providers → Email, make sure "Confirm email" / invite flow is enabled (default is fine)

## 2. Bootstrap the first super-admin (one-time, manual — chicken-and-egg problem)

Every other admin is created through the in-app "Add Admin" flow, but the very first super-admin account can't invite itself. Do this once:

1. Supabase Dashboard → Authentication → Users → **Add user** → enter your email, set a temporary password, and **check "Auto Confirm User"**.
2. Copy the new user's UID.
3. Supabase Dashboard → SQL Editor, run:
   ```sql
   insert into admins (auth_user_id, name, email, slug, role, is_active)
   values ('2dbc1eba-c078-4ee3-ae37-57abe54a6e6b', 'Your Name', 'harshalnelge@email.com', 'admin', 'super_admin', true);
   ```
4. You can now log in at `/login` with that email + the password you set.

## 3. Supabase Edge Functions (needed for "Add Admin" to work)

- [ ] Install the Supabase CLI if you don't have it: `npm install -g supabase`
- [ ] Follow [`supabase/functions/README.md`](supabase/functions/README.md) to link the project, set the `SITE_URL` secret, and deploy `invite-admin` and `remove-admin`

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
2. Click "Add admin" → enter a name + a real email you can check → they receive an invite email.
3. Admin clicks the invite link → redirected to set a password → lands on their empty `/dashboard`.
4. Log back in as super-admin → deactivate that admin → confirm they can no longer log in.
5. Reactivate → confirm they can log in again.
6. Remove an admin → confirm their account is gone (and Supabase Dashboard → Authentication → Users shows them deleted too).

---

## Still to come (not needed yet, listed so nothing is a surprise later)

- Google Cloud project + OAuth credentials (Calendar connect) — needed before the "connect calendar" feature
- n8n instance URL + credentials (Google Calendar, Zaple WhatsApp, email/SMTP) — needed before the booking-confirmation flow
- Zaple account/API key — needed before WhatsApp notifications
- A domain, once we're ready to deploy beyond `localhost`
