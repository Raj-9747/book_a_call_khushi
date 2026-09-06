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
| `create-booking` | The public booking page's only write path. Validates admin/event/slot/notice/window/discount and prices the booking **in Postgres**, then opens the matching Razorpay order. Free bookings are confirmed on the spot; paid ones hold the slot for 10 minutes. The request body has no price field — the amount is never client-supplied |
| `verify-razorpay-payment` | The browser's fast path after Checkout succeeds. Verifies the `order_id\|payment_id` HMAC against `RAZORPAY_KEY_SECRET`, confirms the booking, and returns the magic-link token. Not authoritative on its own |
| `razorpay-webhook` | The authoritative payment channel — Razorpay calls it server-to-server, so it works even if the client's browser never returns. Authorized by the `X-Razorpay-Signature` HMAC over the **raw** body. Handles `payment.captured`, `payment.failed`, `refund.processed`. Idempotent with the function above |
| `expire-pending-bookings` | Called every 5 minutes by n8n — releases lapsed payment holds and refunds the discount-code uses they consumed. Authorized by `x-webhook-secret` |
| `refund-razorpay-payment` | Called from the admin's Requests page when they approve a cancellation with a refund attached. The only part of the requests flow that needs the Razorpay secret — everything else (approve/reject, reschedule) is a plain RLS-guarded table write from the browser |

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

# Where the app is reachable from — used to build the client's magic link
# in the confirmation email. No trailing slash.
supabase secrets set PUBLIC_BASE_URL=http://localhost:3000

# Razorpay. The Key ID is also in .env.local as NEXT_PUBLIC_RAZORPAY_KEY_ID
# (it's public by design — it identifies the account when opening Checkout).
# The other two NEVER go anywhere near the Next.js app.
supabase secrets set RAZORPAY_KEY_ID=<your-razorpay-key-id>
supabase secrets set RAZORPAY_KEY_SECRET=<your-razorpay-key-secret>
# You invent this one, then paste the same string into the Razorpay
# dashboard when creating the webhook (see below).
supabase secrets set RAZORPAY_WEBHOOK_SECRET=<a-random-string-you-generate>

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
supabase functions deploy create-booking --no-verify-jwt
supabase functions deploy verify-razorpay-payment --no-verify-jwt
supabase functions deploy razorpay-webhook --no-verify-jwt
supabase functions deploy expire-pending-bookings --no-verify-jwt
supabase functions deploy refund-razorpay-payment
```

## Razorpay webhook setup

Do this once, after `razorpay-webhook` is deployed:

1. Get the function URL — it's `https://<your-project-ref>.supabase.co/functions/v1/razorpay-webhook`.
2. Razorpay Dashboard (make sure you're in **Test Mode**) → **Account & Settings → Webhooks → Add New Webhook**.
3. **Webhook URL**: the URL from step 1.
4. **Secret**: the exact string you set as `RAZORPAY_WEBHOOK_SECRET` above.
5. **Active Events**: tick `payment.captured`, `payment.failed`, `refund.processed`.
6. Save. Razorpay sends a test ping — a 401 means the secret doesn't match.

The four payment-related functions are deployed with `--no-verify-jwt` because their callers aren't logged-in users: `create-booking` and `verify-razorpay-payment` are called by anonymous booking-page visitors, `razorpay-webhook` by Razorpay's servers (authorized by its signature header instead), and `expire-pending-bookings` by n8n (authorized by `x-webhook-secret`).

> **Re-deploy needed after migration `0009`:** `create-admin`, `update-admin` and `update-own-profile` now return the new profile columns via the shared `_shared/adminColumns.ts` list. Without a re-deploy, editing a profile from the dashboard will still work but the response will be missing the new fields.

> **Re-deploy needed for slug editing:** `update-admin` and `update-own-profile` now also accept a `slug` field, validated by the new `_shared/slug.ts`. Re-deploy both:
> ```bash
> supabase functions deploy update-admin
> supabase functions deploy update-own-profile
> ```

`relay-booking-to-n8n` is deployed with `--no-verify-jwt` because it's called by a Supabase Database Webhook, not by a logged-in user — it authorizes the caller with the `x-webhook-secret` header instead (see `n8n/README.md`). `get-google-busy-times` is also `--no-verify-jwt` since it's called by anonymous public booking-page visitors — it's a read-only, non-sensitive lookup (same trust model as the public RPCs), so no auth check is needed.

No Auth email templates or redirect URL configuration are required for admin management — accounts are created directly with a password, not via invite email.

## Google Cloud OAuth client setup

In your Google Cloud project's OAuth 2.0 Client (APIs & Services → Credentials):

- **Authorized redirect URIs** — add both, so it works locally and once deployed:
  - `http://localhost:3000/dashboard/calendar/callback`
  - `https://<your-production-domain>/dashboard/calendar/callback`
- **Scope requested**: `https://www.googleapis.com/auth/calendar` (read + write — needed both to check for conflicts and to create events later)
- Make sure the **Google Calendar API** is enabled for the project (APIs & Services → Library).
