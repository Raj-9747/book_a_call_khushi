# Zaptly — Setup Checklist

Things needed from your side to get the current build running and testable. Grows as features land.

## 1. Supabase project

- [ ] **Project URL** and **anon public key** (Project Settings → API) → paste into `.env.local` (copy `.env.local.example` → `.env.local` first)
- [ ] Run every file in [`supabase/migrations/`](supabase/migrations/) **in order** via the Supabase Dashboard → SQL Editor → New Query → paste → Run:
  - `0001_init.sql` — core schema (admins, event types, bookings, blocked slots)
  - `0002_restrict_event_type_delete.sql` — prevents deleting an event type that already has bookings
  - `0003_public_booking.sql` — RPC functions the public booking page depends on
  - `0004_fix_create_public_booking_ambiguity.sql` — bug fix for `0003`'s booking-creation function
  - `0005_booking_confirmed_immediately.sql` — bookings are confirmed on creation regardless of Calendar connection
  - `0006_add_admin_phone.sql` — adds a `phone` column to admins (needed for WhatsApp notifications), backfills existing admins with a placeholder number you should update to their real one
  - `0007_public_admin_calendar_flag.sql` — exposes `google_calendar_connected` on the public admin lookup, so the booking page knows whether to check Google Calendar for conflicts
  - `0008_blocked_slots_calendar_event.sql` — adds `google_event_id` to `blocked_slots`, so a manual block can be synced to (and removed from) the admin's real Google Calendar

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

## 5. n8n — booking confirmation + reminders

You have an n8n instance running. To wire it up:

- [ ] Import `n8n/workflows/create-booking-event.json` and `n8n/workflows/reminder-cron.json` into n8n
- [ ] Connect a **Gmail OAuth2** credential to the Gmail node in both workflows (this is the account confirmation/reminder emails send from)
- [ ] Decide how the workflows get your Supabase URL + service role key (self-hosted env vars vs. hardcoded in n8n Cloud) — see `n8n/README.md`
- [ ] Activate `create-booking-event.json`, copy its Production Webhook URL
- [ ] Set Edge Function secrets: `N8N_BOOKING_WEBHOOK_URL` (that URL) and `BOOKING_WEBHOOK_SECRET` (a random string you generate)
- [ ] Deploy the relay function: `supabase functions deploy relay-booking-to-n8n --no-verify-jwt`
- [ ] Supabase Dashboard → Database → Webhooks → create one on `bookings` INSERT → pointing at the `relay-booking-to-n8n` Edge Function → with header `x-webhook-secret: <same random string>`
- [ ] Activate `reminder-cron.json` too

Full step-by-step in [`n8n/README.md`](n8n/README.md).

## 6. Local app setup

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

**Booking confirmation pipeline**
9. With Google Calendar connected, book a slot via the public page → check the n8n execution log for `create-booking-event` fired → confirm the event appeared on the admin's actual Google Calendar with a Meet link, and the booking row in Supabase got `meet_link`/`google_event_id` filled in.
10. Check the client's inbox for the confirmation email.
11. To test reminders without waiting: temporarily create a booking ~1 hour out, or manually run the `reminder-cron` workflow once from n8n's UI and check `reminder_sent` flips to `true` and the email arrives.

**Google Calendar conflict detection**
12. With Calendar connected, manually create an event directly in the admin's Google Calendar (not through Zaptly) at some time in the next 14 days → reload the admin's public booking page → confirm that time no longer shows as an available slot.

**Manual block ↔ Calendar sync**
13. With Calendar connected, block a day/time from Availability → check the admin's real Google Calendar → confirm a "Blocked (Zaptly)" event appeared at that time.
14. Remove that block from Zaptly → confirm the event disappears from Google Calendar too.

**Cancel → Calendar cleanup**
15. Book a slot (with Calendar connected) so a real Calendar event + Meet link gets created → cancel that booking from the Bookings dashboard → confirm the event is removed from the admin's Google Calendar.

---

## Still to come (not needed yet, listed so nothing is a surprise later)

- Zaple account/API key — WhatsApp confirmation/reminders (email via Gmail is built; WhatsApp isn't yet)
- A domain, once we're ready to deploy beyond `localhost` (also needs adding to the Google OAuth redirect URIs)
