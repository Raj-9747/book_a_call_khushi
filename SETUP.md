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
  - `0009_admin_profile.sql` — public profile fields (photo, headline, about, LinkedIn, Instagram), the accepting-bookings toggle, minimum-notice and booking-window settings, the `admin-photos` Storage bucket + its policies, and the public RPCs the new profile page uses
  - `0010_booking_enquiries.sql` — the `booking_enquiries` table (leads captured while an admin has bookings paused) and its public submission RPC; also re-creates `create_public_booking` so the toggle, minimum notice and booking window are enforced server-side, not just hidden in the UI
  - `0011_discount_codes.sql` — discount codes + which event types each one covers, price columns on `bookings`, the advisory `validate_discount_code` RPC, and a `create_public_booking` that prices the booking and redeems the code server-side
  - `0012_payments_and_magic_link.sql` — Razorpay columns + the `manage_token` magic link, the `pending_payment`/`expired` statuses and the new `payment_status` vocabulary (existing `paid_dummy` rows are folded into `paid`), and the RPCs behind booking creation, payment confirmation and hold expiry. **`create_public_booking` is revoked from anonymous callers here** — the public page now goes through the `create-booking` Edge Function instead
  - `0013_booking_change_requests.sql` — the `booking_change_requests` table (reschedule/cancel requests from the magic-link page), its public submission RPC, and a `get_booking_by_token` that also returns the admin's availability data (so the magic link can offer a real slot picker when proposing a reschedule) and any existing request on that booking
  - `0014_security_hardening.sql` — closes two real gaps found in a full security audit: an admin could self-promote to `super_admin` via a direct table write (no column-level check existed on the self-update RLS policy), and a deactivated admin's existing session kept full data access since the ownership check didn't look at `is_active`. Also removes an unintended super-admin bypass on bookings/event types/blocked slots that contradicted this project's own "siloed even from super-admin" decision. **Also re-deploy `update-admin`** — it now handles the one legitimate `is_active` write that used to be a direct client-side table update
  - `0015_admin_social_links.sql` — adds `x_url`/`website_url` to admins and re-creates `get_public_admin`/`get_booking_by_token` to return them. **Run this before deploying any frontend build that expects those columns** — skipping it makes `getCurrentAdmin()` fail silently and every admin gets bounced back to `/login`
  - `0016_recurring_blocked_slots.sql` — adds `recurrence_group_id` to `blocked_slots` (for weekly/fortnightly/monthly repeating blocks) plus a `btree_gist` exclusion constraint that rejects an overlapping block outright rather than silently allowing it
  - `0017_dashboard_overview.sql` — `get_dashboard_overview()`, the RPC behind the rebuilt Overview page (earnings, today's schedule, action items, top sessions)
  - `0018_payment_summary.sql` — `get_payment_summary()`, the collected/refunded/net totals behind the Payments page
  - `0019_meeting_summaries.sql` — adds `record_meeting` to event types, the `meeting_summaries` table Fireflies summaries land in, and re-creates `get_public_event_type`/`get_booking_by_token` to carry that flag and the client's copy of the MoM
  - `0020_abandoned_payment_reminders.sql` — adds `abandoned_reminder_sent` to bookings, and the two RPCs (`get_abandoned_bookings`, `mark_abandoned_reminder_sent`) the new abandoned-payment-reminder n8n cron calls

After running `0009`, confirm the bucket exists: Supabase Dashboard → Storage → you should see **`admin-photos`** (public, 2 MB limit, JPG/PNG/WebP only). The migration creates it, so there's nothing to click — this is just a check.

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

**Public profile page** (needs migrations `0009`–`0010` and the three re-deployed Edge Functions)
16. As an admin, go to **Profile** (the nav item that used to be Settings) → upload a photo, fill in headline, about, LinkedIn and Instagram → Save.
17. Open `/book/<your-slug>` in an incognito window → confirm the photo, name, headline, about and social icons all appear, and your active event types are listed with duration and price (a ₹0 event should read **Free**).
18. Clear the headline/about/socials and save → reload the public page → confirm those sections vanish cleanly rather than leaving gaps.
19. Click an event → it opens the booking page, with a back link to the profile.
20. Deactivate that admin from the super-admin panel → `/book/<slug>` should 404. Reactivate afterwards.
21. Set an event type to inactive → confirm it disappears from the profile list.

**Pause bookings**
22. Profile → toggle **Accepting bookings** off, optionally write a custom message → Save.
23. Reload `/book/<your-slug>` and an event page → both should show "Currently unavailable" with the short name/email/phone/message form instead of the slot picker.
24. Submit that form → confirm the success message, then check **Bookings → Enquiries** in the dashboard for the new row; try "Mark contacted" and "Mark closed".
25. Toggle bookings back on → confirm the slot picker returns.

**Booking rules**
26. Availability → **Booking rules** → set minimum notice to e.g. 4 hours and booking window to 7 days → Save.
27. Reload the public booking page → confirm no slots within the next 4 hours are offered, and no dates beyond 7 days out appear.

**Event page redesign**
28. Open a paid event's booking page → confirm the layout: admin photo/name/headline at the top, then event name with duration + price, an "About this session" block (the event type's description), the time picker, the discount link, and a **Continue** button that stays disabled until you pick a slot.
29. Pick a slot → it highlights, the chosen date/time appears above the button, and Continue enables → click it → the details form opens in a modal.
30. Fill the form → you get a price summary (list price, discount line, total) and the pay button → complete it → confirmation shows the amount paid.
31. Do the same on a **free** event → no discount box, no payment step, and the modal's button reads "Confirm booking".

**Discount codes**
32. Dashboard → **Discounts** → New code → e.g. `SAVE20`, 20%, never expires, unlimited uses, all sessions → Create. Confirm it's stored in caps even if you typed lowercase.
33. On a paid event page → click "Have a discount code?" → enter it → confirm the price updates everywhere (header, summary, pay button) and a green "applied" row appears with an × to remove it.
34. Enter a nonsense code → confirm the generic "isn't valid for this session" error.
35. Create a code scoped to **one specific** session → confirm it works there and is rejected on a different one.
36. Create a code with **max uses = 1** → use it on a booking → try it again → it should now be rejected, and Discounts should show `1 / 1` with a **Used up** badge.
37. Create a code expiring **yesterday** (edit an existing one) → confirm it's rejected and shows **Expired**.
38. Deactivate a code → confirm it's rejected on the public page and shows **Inactive**.
39. Book with a discount → check **Bookings**: the Amount column should show the discounted total with a `−20%` marker.
40. **Race check — not optional, this is the actual concurrency guarantee on a paid event.** With a max-uses-1 code, submit two bookings at once from two tabs (or two devices) for the same paid event type and the same slot → exactly one should succeed, the other should see "already been fully used" or "just booked", and the discount code's `times_used` must stay at 1, never 2.

---

## Razorpay (test mode)

Before testing payments:

- [ ] `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` and `PUBLIC_BASE_URL` as Edge Function secrets — see [`supabase/functions/README.md`](supabase/functions/README.md). Note there is nothing to add to `.env.local` for Razorpay — the Key ID comes back from `create-booking`'s response, not a client-side env var.
- [ ] Deploy `create-booking`, `verify-razorpay-payment`, `razorpay-webhook`, `expire-pending-bookings`, and re-deploy `relay-booking-to-n8n`
- [ ] Add the webhook in the Razorpay dashboard (URL + secret + the three events) — steps in the functions README
- [ ] **Change the existing Supabase Database Webhook on `bookings` to fire on `INSERT` *and* `UPDATE`** (Dashboard → Database → Webhooks → edit the one pointing at `relay-booking-to-n8n`)
- [ ] Import and activate `n8n/workflows/expire-holds-cron.json`

Razorpay test cards/UPI: use card `4111 1111 1111 1111` with any future expiry and any CVV, or pick UPI and choose "Success" on the simulated screen. Full list: <https://razorpay.com/docs/payments/payments/test-card-details/>

**Payments**
41. Book a paid session → after "Continue to payment" the Razorpay modal should open showing UPI, cards, netbanking and wallets → pay with a test card → confirmation shows the amount, and the booking lands in the dashboard as **confirmed**.
42. Check the client's inbox — the confirmation email should arrive **once**, and contain the magic link. Open it: the booking details page should render.
43. Start a paid booking and **close the Razorpay modal** without paying → you should see "your slot is held for a few more minutes", the booking sits in the dashboard as **awaiting payment**, and that slot is gone from the public page.
44. Wait ~10 minutes (or run the n8n workflow manually) → the booking flips to **expired** and the slot comes back. If a discount code was applied, its `times_used` should tick back down.
45. Pay, then immediately reload the dashboard → confirm exactly one confirmed booking and no duplicate email.
46. Use a **100% discount code** on a paid session → Razorpay should be skipped entirely and the booking confirmed as free.
47. Webhook check: Razorpay Dashboard → Webhooks → your webhook → recent deliveries should show `payment.captured` with a 200. Then in Supabase, `razorpay_payment_id` and `amount_paid` should be filled in on the booking.
48. Tamper check (worth doing once): with a paid event, use browser devtools to call the `create-booking` function with an extra `amount` field — confirm it's ignored and you're still charged the real price.

---

## Reschedule/cancellation requests (needs migration `0013` + `refund-razorpay-payment` deployed)

49. Run `0013_booking_change_requests.sql`, then `supabase functions deploy refund-razorpay-payment`.
50. Make a confirmed booking, open its magic link from the confirmation email → confirm you see **Request reschedule** and **Request cancellation** buttons at the bottom.
51. Click **Request reschedule** → a slot picker should load (same one as the public booking page) → optionally pick a time and add a message → Send. Confirm the page now shows "your request has been sent" instead of the buttons, and a second attempt is blocked with the same message rather than creating a duplicate.
52. In the dashboard, check the **Requests** nav item — it should show a badge with a pending count, and the **Bookings** table should show a "Reschedule requested" tag on that row.
53. Open **Requests** → click the request → approve it (either the proposed time, or pick a different one) → confirm: the booking's time updates, the Bookings table shows the new time, a fresh confirmation email goes out (since this reuses the existing pipeline), and — if Calendar is connected — the old event is gone and a new one exists at the new time.
54. Repeat with **Request cancellation** on a paid booking → in Requests, try **No refund**, **Full refund**, and **Partial** on different test bookings → confirm the booking flips to cancelled, the Calendar event disappears, and for a refund, `refund_status`/`refund_amount` appear on the booking (check the Razorpay dashboard's Refunds tab too).
55. Reject a request instead of approving → confirm the booking is untouched and the request shows as rejected.
56. Try requesting a change on a booking whose call time has already passed → the buttons should be gone entirely.

---

## Bookings — sorting & pagination

No migration needed — this is a frontend-only change (the list query is now server-side paginated/sorted/filtered instead of fetching every booking at once).

57. Bookings page → a new **sort** dropdown next to the filters: Event date (newest/oldest), Booked on (newest/oldest). Switching it should reorder the table and jump back to page 1.
58. With more than 20 bookings, confirm a **Prev/Next** pager appears at the bottom of the table showing "X–Y of Z", and paging through doesn't refetch everything — just the next slice.
59. Type in the search box → confirm it doesn't fire a request on every keystroke (only after you pause typing), and that it also resets to page 1.
60. Change the status or event-type filter while on page 2+ → confirm it jumps back to page 1 rather than showing an empty page.

---

## Booking link (slug) editing

No migration — needs `update-admin` and `update-own-profile` re-deployed (see [`supabase/functions/README.md`](supabase/functions/README.md)).

61. Dashboard → Profile → the new **Your booking link** card → Edit → change it → Save → confirm a warning appears first ("the old link will stop working"), then confirm it → the link updates and the old `/book/<old-slug>` now 404s.
62. Try a slug that's too short, has spaces/symbols, or is already taken by another admin (e.g. try the super-admin's own slug) → confirm each gets a clear error, not a raw database message.
63. Super-admin → Admins → Edit an admin → change their **Booking link** field the same way → same confirm warning → confirm the change reflects immediately in their public page and in the Admins table.
64. Confirm any friendly Edge Function error (a taken slug, a duplicate email) now shows its actual message in the toast — not the generic "Edge Function returned a non-2xx status code" text (this was a pre-existing bug in `updateAdmin`/`updateOwnProfile`, fixed alongside slug editing since it would have swallowed the new "link already taken" message too).

---

---

## Security fixes — verify these before anything else

Run migration `0014_security_hardening.sql`, then re-deploy `update-admin` (it now also handles `is_active`). These close two real, exploitable gaps found in a full audit pass — both present since the very first migration, neither ever exploited as far as anyone knows, but real enough to verify the fix actually took rather than just trusting the diff.

65. **Privilege escalation is closed.** Log in as a *regular* admin (not super-admin) in the browser, then open DevTools → Application/Storage → Local Storage → find the `sb-<project-ref>-auth-token` entry and copy its `access_token` value. Then, from a terminal:
    ```bash
    curl -X PATCH "https://<project-ref>.supabase.co/rest/v1/admins?id=eq.<your-own-admin-id>" \
      -H "apikey: <your anon key>" \
      -H "Authorization: Bearer <the access_token you copied>" \
      -H "Content-Type: application/json" \
      -d '{"role":"super_admin"}'
    ```
    Before the fix this silently succeeded. After it, expect an error (a `42501`/permission-denied on the `role` column) — the row must NOT change. Confirm by checking that admin's row in the SQL editor still shows `role = 'admin'`.
66. **Deactivate → reactivate still works end to end** from the super-admin's Admins page (this moved from a direct table write to going through `update-admin` — confirm nothing broke).
67. **A super-admin can no longer deactivate their own account** — try it on your own row from the Admins page; expect a clean "You can't deactivate your own account" error, not a raw one.
68. **Deactivation actually revokes access now, not just the login screen.** Deactivate an admin who is *currently logged in elsewhere* (a second browser/incognito session) — without logging them out — and confirm that session can no longer load their Bookings/Event Types/Discounts pages (they should now fail to load data, not just still work until they happen to log out and back in).
69. **Cross-admin data isolation** — with two admin accounts, log in as Admin A and confirm you cannot see Admin B's bookings, event types, blocked slots, discount codes, or enquiries anywhere, including via the super-admin's own login (a super-admin should now only see the admins list itself — name/email/phone/slug/status — not drill into anyone's bookings).

## Other high-value gaps worth testing (found in the same audit, not yet covered by any step above)

Not exhaustive — prioritized by "what would be most damaging if broken in a live demo or with real money."

70. **Retry after a declined card, in the same Checkout session** — this exact bug was found and fixed once already (`payment.failed` was being treated as terminal, silently dropping a successful retry). Use a card Razorpay's test docs mark as "always declined," let it fail, then pay with a working method in the *same* modal — confirm the booking still confirms correctly. This is the single most likely regression to reintroduce silently.
71. **Kill the tab immediately after a successful payment**, before the browser callback can fire — confirm the webhook alone still confirms the booking (check the Supabase row a minute later, not the UI).
72. **Approve a reschedule onto a slot someone else is actively paying for** (a `pending_payment` hold, not yet expired) — this is currently a real gap: the reschedule-approval conflict check does not look at live payment holds. Confirm whether it lets the double-booking through; if so, this needs a follow-up fix, not just a test.
73. **Custom booking questions**, end to end — add one to an event type, confirm it's required correctly on the public booking page, and that the answer shows up on the booking in the dashboard.
74. **Delete an event type that already has bookings** — confirm it's refused with a clear message pointing at "deactivate instead," not a raw foreign-key error.
75. **Google Calendar token expired/revoked** — with Calendar connected, revoke access from your Google account settings, then load the public booking page for that admin — confirm slots still show (fail-open), rather than the page breaking.

---

## Fireflies summaries, MoM delivery & abandoned-payment reminders (needs migrations `0019`, `0020`)

Full background in `PLAN.md` §11. Three new n8n workflows/edge changes: `record_meeting` toggle on event types, `fireflies-webhook`, `mom-ready.json`, `abandoned-payment-cron.json`.

76. Run `0019_meeting_summaries.sql` and `0020_abandoned_payment_reminders.sql`. Set up Fireflies per `n8n/README.md`'s "Fireflies setup" section, import + activate `mom-ready.json` and `abandoned-payment-cron.json`, and set the new Edge Function secrets (`FIREFLIES_API_KEY`, `FIREFLIES_WEBHOOK_SECRET`, `N8N_MOM_WEBHOOK_URL`) before testing anything below.
77. Event Types → edit one → confirm the **"Record & summarise this meeting"** toggle exists and defaults off. Turn it on and save.
78. Book that event type as a client → confirm the public event page shows the recording notice ("This session is recorded...") before you book — and that a different event type with the toggle off shows nothing.
79. Complete a real call on that booking (Google Calendar connected, Fireflies bot should join as an attendee) → after Fireflies finishes processing, confirm: `meeting_summaries` gets a new row, the magic-link page (`/booking/<token>`) shows a "Meeting notes" block with the short summary + action items, and the dashboard's booking detail (LeadDetailModal) shows the fuller version (summary + action items + transcript link) — plus both client and admin receive the MoM by email and WhatsApp.
80. Book (and complete) an event type with the toggle **off** → confirm no bot joins, no `meeting_summaries` row appears, and neither the magic link nor the booking detail shows a "Meeting notes" section at all.
81. Start a paid booking, get to the Razorpay checkout, then abandon it (close the tab without paying) → wait for the hold to expire (5-minute sweep) plus the abandoned-reminder cron's 15-minute cutoff → confirm the client gets exactly one email + WhatsApp nudge linking back to the event page (not a dead "your slot is held" link), and `abandoned_reminder_sent` flips to `true` on that booking so it isn't sent twice.
82. Abandon a checkout, then **immediately rebook and pay successfully** for the same event type with the same email before the reminder would fire → confirm no abandoned-payment reminder is ever sent for the failed attempt (the suppression check in `get_abandoned_bookings`).

## Still to come (not needed yet, listed so nothing is a surprise later)

- ~~Zaple account/API key — WhatsApp confirmation/reminders (email via Gmail is built; WhatsApp isn't yet)~~ — done: the admin new-booking alert, the client/admin MoM messages, and the abandoned-payment nudge are all built. Booking confirmation and the 1-hour reminder are a deliberate exception — staying email-only, see `PLAN.md` §11.2
- A domain, once we're ready to deploy beyond `localhost` (also needs adding to the Google OAuth redirect URIs)
