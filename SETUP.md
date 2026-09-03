# Zaptly — Setup Checklist

Things needed from your side to get the current build running and testable. Grows as features land.

## 1. Supabase project

- [ ] **Project URL** and **anon public key** (Project Settings → API) → paste into `.env.local` (copy `.env.local.example` → `.env.local` first)
- [ ] Run every file in [`supabase/migrations/`](supabase/migrations/) **in order** via the Supabase Dashboard → SQL Editor → New Query → paste → Run:
  - `0001_init.sql` — core schema (admins, event types, bookings, blocked slots)
  - `0002_restrict_event_type_delete.sql` — prevents deleting an event type that already has bookings
  - `0003_public_booking.sql` — RPC functions the public booking page depends on
  - `0004_fix_create_public_booking_ambiguity.sql` — bug fix for `0003`'s booking-creation function

No Auth email/redirect configuration is needed for admin accounts — they're created directly with an email + password the super-admin sets, not via invite email.

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

## 3. Supabase Edge Functions

- [ ] Install the Supabase CLI if you don't have it: `npm install -g supabase`
- [ ] Follow [`supabase/functions/README.md`](supabase/functions/README.md) to log in, link the project, set secrets, and deploy every function listed there

## 4. Google Cloud OAuth (needed for "Connect Google Calendar")

You said you already have a Google Cloud project + OAuth credentials. Make sure:

- [ ] The **Google Calendar API** is enabled for that project (APIs & Services → Library)
- [ ] Your OAuth 2.0 Client's **Authorized redirect URIs** include `http://localhost:3000/dashboard/calendar/callback` (add your production domain's equivalent later)
- [ ] Paste the **Client ID** into `.env.local` as `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
- [ ] Set the **Client Secret** as an Edge Function secret only (never in `.env.local`) — see `supabase/functions/README.md`
- [ ] Deploy `connect-google-calendar` and `disconnect-google-calendar` (part of step 3 above)

### ⚠️ Recurring step: add every admin as a Google test user

If your OAuth consent screen is in **Testing** status (the default until you explicitly publish it), Google only lets accounts you've explicitly whitelisted through the consent screen — anyone else gets an "access blocked" error, even though the app code works correctly for them.

**Each time you add a new admin who needs Google Calendar connected**, go to Google Cloud Console → APIs & Services → OAuth consent screen → **Test users** → **Add users** → enter their Google account email. This takes effect immediately, no review needed (limit: 100 test users, plenty for an internal team). Skip this only if you've published the app to Production (not recommended for now — the calendar scope is "sensitive," so Google requires an app review with a privacy policy and domain verification, which is overkill for an internal tool).

## 5. Local app setup

```bash
cp .env.local.example .env.local
# fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_GOOGLE_CLIENT_ID
npm install
npm run dev
```

Visit `http://localhost:3000` — you should land on `/login`.

## What you can test after this step

**Admin management**
1. Log in as the super-admin you bootstrapped above → should land on `/admin`.
2. Add an admin (name, email, password) → log in as them → change password from Settings.
3. Edit/deactivate/reactivate/remove an admin from the super-admin panel.

**Event types, availability, bookings**
4. As an admin: create an event type, set weekly availability, block a day off.
5. Open that event type's public `/book/...` link in an incognito window → book a slot (try a paid one to see the dummy payment step) → confirm it lands in your Bookings dashboard.
6. Try booking the exact same slot from two tabs to confirm the conflict message.

**Google Calendar**
7. From Settings (or the dashboard banner), click "Connect Google Calendar" → grant access → confirm it shows "Connected" afterward.
8. Disconnect → confirm it reverts to "Not connected."

---

## Still to come (not needed yet, listed so nothing is a surprise later)

- n8n instance URL + credentials (Google Calendar, Zaple WhatsApp, email/SMTP) — needed before the booking-confirmation flow (creating the actual Calendar event + Meet link, sending confirmation/reminders)
- Zaple account/API key — needed before WhatsApp notifications
- A domain, once we're ready to deploy beyond `localhost` (also needs adding to the Google OAuth redirect URIs)
