# Calendly/Topmate Clone — Single Admin Booking Platform

## 1. Goal

A booking platform for one admin to manage his own meetings — replacing Topmate/Calendly for internal use. Client/lead books a slot → Google Meet call gets scheduled automatically → admin manages everything from a dashboard. Later, this becomes a demo product to resell to other companies (multi-tenant, out of scope for v1).

## 2. Confirmed Decisions

| Area | Decision |
|---|---|
| Tenancy | **Multi-admin, single-company.** Not multi-tenant (one company only), but supports multiple admin/manager accounts, each running their own independent calendar/schedule/event types under one system. Not hardcoded — admins are added/removed entirely through UI. |
| Booking pages | Each admin gets their own separate public link (e.g. `/book/john/30min`, `/book/priya/intro-call`). No shared "pick an admin" landing page. |
| Data visibility | Siloed. An admin only sees their own bookings, leads, notes, availability, event types. Enforced via Supabase Row Level Security (RLS) keyed on `admin_id`. |
| Admin roles | Two roles: **Super-admin** (adds/removes/deactivates admin accounts, sees a company-wide admin list, but does not see into each admin's private bookings/leads unless explicitly needed later) and **Admin** (manages only their own calendar/events/leads). |
| Admin management | Fully UI-driven: super-admin has a "Manage Admins" screen to add an admin by setting their name, email, and an initial password directly, deactivate, or remove one. No manual DB edits, no hardcoded admin list/count. |
| No-hardcoding principle | Applies system-wide: availability, event types, admins, and integration credentials (Google Calendar connection, WhatsApp/email sender config) are all set up and stored via UI/DB — never hardcoded in code or manually pasted into n8n per admin. |
| Frontend-only architecture | No custom backend/API routes. Supabase (DB + Auth + Edge Functions) is the entire backend. |
| Admin auth | Supabase Auth, email + password. One admin user. |
| Calendar + Meet creation | Done via n8n workflow (Google Calendar API node), not custom backend code. |
| Trigger mechanism | Frontend writes booking to Supabase → a Supabase Edge Function (DB webhook/trigger) calls the n8n webhook server-side. Frontend never calls n8n directly. |
| WhatsApp notifications | Sent via n8n using Zaple as the WhatsApp provider. |
| Email notifications | Sent via n8n (email node) — confirmation + 1-hour-before reminder. |
| Reminder timing | 1 hour before the meeting only (no 24h reminder in v1). |
| Manual calendar block | App-only block, stored in Supabase. Hides slots on the public booking page. Does NOT create/sync anything on the admin's actual Google Calendar. |
| Timezones | Client sees slots in their own browser-detected timezone. Admin's availability is authored and stored in IST. All conversion happens client-side at render time; source of truth in DB is always UTC or IST-anchored. |
| Payment | Dummy only. Single "Pay Now" button — no card form. Clicking it immediately marks the booking as "paid" and proceeds to confirmation. No real payment gateway wired in v1. |
| Lead management | Dashboard supports notes + status tags (e.g. Lead / Client / Closed / Follow-up) per booking. |
| Event types | Multiple supported, each with its own duration, price (or free), description, and custom questions. |
| Client self-service | Not included in v1 (no self-reschedule/cancel link) — admin handles reschedule/cancel manually from dashboard. |
| Buffer time | Not included in v1 — can be added later as an availability-engine enhancement. |

## 3. Core Features (v1)

### Super-Admin Panel (new)
- Login (Supabase Auth, role = `super_admin`)
- **Manage Admins**: list all admins, add new admin (name, email, initial password set directly — plus edit/reset password later), deactivate/reactivate, remove
- Each admin row shows: Google Calendar connection status, active/inactive, number of upcoming bookings (metadata only — not full booking detail, keeping the siloed principle)
- Assigns each admin a unique slug used in their public booking URLs (auto-generated from name, editable)

### Admin Dashboard (per admin, behind Supabase Auth login, role = `admin`)
- Login screen (email/password)
- **Google Calendar connect**: each admin does their own OAuth connect from their dashboard (button: "Connect Google Calendar") — token stored against their own `admin_id`, nothing shared or hardcoded across admins
- **Event types manager**: create/edit/delete event types (name, duration, price or "Free", description, custom booking-form questions, active/inactive toggle) — scoped to that admin only
- **Availability settings**: weekly recurring schedule (per day start/end times, in IST) + date-specific overrides — scoped to that admin only
- **Manual block UI**: pick date/time range(s) to block; stored in Supabase, immediately removes those slots from that admin's public booking pages (no Google Calendar sync)
- **Bookings/leads dashboard**: table of that admin's own bookings only — filter by event type, status (upcoming/completed/cancelled), search by name/email
- **Lead detail view**: contact info, answers to custom questions, notes field, status/tag dropdown, manual cancel/mark-completed actions
- **Notification settings**: optionally override company-wide WhatsApp/email sender config with their own (see Integrations Settings below), otherwise inherits default

### Public Booking Page (no login, one link per admin + event type)
- `yourdomain.com/book/[admin-slug]/[event-type-slug]`
- Shows event type name, duration, price, description
- Calendar/slot picker: available slots = (admin's IST weekly availability) − (existing bookings) − (manual blocks) − (Google Calendar busy times, pulled via n8n/Calendar API), rendered in the visitor's local timezone
- Booking form: name, email, phone, custom questions from event type config
- If event type is paid: dummy "Pay Now" button → simulated success → proceed
- On submit: booking row created in Supabase (status: "pending_confirmation")
- Confirmation screen: "You're booked!" with meeting details (Meet link shown once n8n finishes creating it — see flow below)

### Notifications (via n8n)
- Booking confirmation: Email + WhatsApp (Zaple), sent immediately after Supabase confirms the calendar event was created
- Reminder: Email + WhatsApp, sent 1 hour before meeting start time (n8n scheduled/cron trigger polling Supabase for upcoming bookings)

## 4. End-to-End Flow

1. **Super-admin setup**: Super-admin logs in, adds an admin (name, email, password, auto-generated slug) via "Manage Admins" UI. The admin can log in immediately with those credentials — no invite email involved. Both the super-admin and the admin themselves can change the password later.
2. **Admin setup**: Admin logs in, connects their own Google Calendar (OAuth — token stored against their `admin_id`), sets weekly availability (IST), creates their event types.
3. **Client visits an admin's public booking link** (`/book/[admin-slug]/[event-type-slug]`) → frontend queries Supabase for that admin's availability + existing bookings + manual blocks, and separately n8n/Edge Function fetches that admin's Google Calendar busy times (using their stored token) → merges into open slots → renders in client's local timezone.
4. **Client picks a slot, fills form** → if paid event type, clicks dummy "Pay Now" → instantly proceeds.
5. **Frontend inserts a row into `bookings` table** in Supabase with `admin_id`, status `pending_confirmation`.
6. **Supabase Database Webhook** (on insert into `bookings`) fires a **Supabase Edge Function**, which calls the **n8n webhook** with the booking payload including `admin_id`.
7. **n8n workflow**:
   - Looks up that admin's stored Google Calendar credential + notification config (WhatsApp/email) using `admin_id` — never a hardcoded/single shared credential
   - Creates a Google Calendar event (with Google Meet conferencing auto-enabled) on that admin's calendar
   - Writes the generated Meet link + Google Calendar event ID back into the `bookings` row in Supabase
   - Sends confirmation Email to client (and optionally the admin)
   - Sends confirmation WhatsApp message via Zaple to client
   - Updates booking status to `confirmed`
8. **Frontend polls/subscribes** (Supabase Realtime) to the booking row → once status flips to `confirmed` and Meet link is present, shows it on the confirmation screen.
9. **1 hour before meeting**: a separate n8n workflow (Cron trigger, runs every few minutes) queries Supabase across all admins for bookings starting in ~1 hour that haven't been reminded yet → sends Email + WhatsApp reminder using the relevant admin's notification config → marks `reminder_sent = true`.
10. **Admin manages their own bookings** from their dashboard: add notes/tags, mark completed, cancel (cancelling only updates Supabase status — does not auto-delete the Google Calendar event in v1; admin deletes manually on Calendar if needed, OR we add an n8n "cancel" webhook later).
11. **Admin blocks time off** anytime from their dashboard UI → inserts into `blocked_slots` table scoped to their `admin_id` → immediately reflected on their own public booking page's available-slots calculation.
12. **Super-admin can deactivate an admin** anytime → their public booking pages stop accepting new bookings (existing bookings unaffected).

## 5. Data Model (Supabase/Postgres)

**`admins`**
- `id`, `auth_user_id` (fk to Supabase Auth user), `name`, `email`, `slug` (unique, used in public URL, editable via UI), `role` (`super_admin` / `admin`), `is_active` (bool), `timezone` (default `Asia/Kolkata`), `google_calendar_connected` (bool), `google_refresh_token` (encrypted), `weekly_availability` (jsonb: per-day start/end times in IST), `notification_config` (jsonb, optional per-admin override: WhatsApp/email sender settings — falls back to a company-wide default if empty), `created_at`

**`event_types`**
- `id`, `admin_id` (fk), `slug`, `name`, `duration_minutes`, `price` (nullable/0 = free), `description`, `custom_questions` (jsonb array), `is_active`

**`bookings`**
- `id`, `admin_id` (fk), `event_type_id` (fk), `client_name`, `client_email`, `client_phone`, `custom_answers` (jsonb), `start_time` (timestamptz), `end_time` (timestamptz), `client_timezone`, `status` (`pending_confirmation` / `confirmed` / `cancelled` / `completed`), `payment_status` (`free` / `paid_dummy`), `google_event_id`, `meet_link`, `reminder_sent` (bool), `notes` (text), `tag` (text: Lead/Client/Follow-up/Closed), `created_at`

**`blocked_slots`**
- `id`, `admin_id` (fk), `start_time`, `end_time`, `reason` (optional text)

**`integration_defaults`** (single row, super-admin managed)
- `id`, `default_email_config` (jsonb), `default_whatsapp_config` (jsonb) — used when an admin hasn't set their own override in `notification_config`

**Row Level Security**: every table except `admins` (for super-admin visibility) and `integration_defaults` is scoped by `admin_id = auth.uid()`-derived admin record, so an admin's queries only ever return their own rows. Super-admin role bypasses RLS only on `admins` (list/manage), not on other admins' `bookings`/`notes`.

## 6. Tech Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js (React) + Tailwind CSS — hosted on Vercel |
| Backend/API | None — Supabase client SDK used directly from frontend |
| Database | Supabase Postgres |
| Auth | Supabase Auth (email/password) |
| Realtime updates | Supabase Realtime (booking status changes reflected live on confirmation page) |
| Serverless glue | Supabase Edge Functions (DB webhook → n8n relay) |
| Calendar + Meet creation | n8n workflow using Google Calendar node (OAuth2 credential) |
| Email sending | n8n (Email/SMTP or transactional email node) |
| WhatsApp sending | n8n + Zaple node/HTTP request |
| Reminder scheduling | n8n Cron trigger workflow, polling Supabase |
| Hosting for n8n | Self-hosted or n8n Cloud (either works; webhook URL just needs to be reachable) |

## 7. Open Items / Things to Set Up Before Building

- [ ] Create Supabase project, define schema above, write RLS policies for admin-siloed access
- [ ] Google Cloud project + OAuth consent screen + Calendar API enabled — build a generic "Connect Google Calendar" flow any admin can run from their own dashboard (not a one-off manual setup)
- [ ] n8n instance running (cloud or self-hosted) with:
  - Webhook workflow: receive booking (with `admin_id`) → look up that admin's Calendar credential + notification config from Supabase → create Calendar event w/ Meet → write back to Supabase → send email + WhatsApp
  - Cron workflow: check upcoming bookings across all admins every ~5-10 min → send 1-hour reminders using each booking's admin's config
- [ ] Zaple account + API credentials for WhatsApp (default company-wide, with optional per-admin override)
- [ ] Decide transactional email provider/credentials for the n8n email node (same default + override pattern)
- [ ] Domain for hosting the Next.js app (Vercel)
- [x] Admin accounts are created directly (email + password set by super-admin), with edit/reset-password and a self-service "change password" setting — no invite email flow

## 8. Explicitly Out of Scope (v1)

- Full multi-tenant SaaS (multiple separate companies) — this is multi-admin within one company only
- Real payment gateway integration
- Client self-service reschedule/cancel
- Buffer time between bookings
- Super-admin visibility into admins' individual bookings/leads (siloed by design)

~~Syncing manual blocks to actual Google Calendar~~ and ~~automatic Google Calendar event deletion on cancel~~ — both since built (best-effort, via `sync-blocked-slot-calendar` and `delete-booking-calendar-event` Edge Functions).

Items below are superseded by Phase 10: ~~Real payment gateway integration~~ (Razorpay), ~~Client self-service reschedule/cancel~~ (request-based, admin-approved).

---

## 9. Phase 10 — Public Profile, Magic Links, Discounts & Razorpay

Everything from here down is the plan for the current phase. Nothing in sections 1–8 changes except where explicitly noted.

## 9.1 Scope

Six things, built in the order listed (each is independently testable):

1. **Admin profile fields + Profile page** (Settings renamed) — photo, headline, about, LinkedIn, Instagram, accepting-bookings toggle, min-notice and booking-window settings
2. **Public admin profile page** at `/book/[adminSlug]` — the missing route today
3. **Event page redesign** — admin header, price/duration, about-this-session, date/slot picker, Continue button, details modal, discount box
4. **Discount codes** — admin-managed, percent-only, scoped to chosen event types
5. **Razorpay** — replaces dummy payment entirely
6. **Magic link** (`/booking/[token]`) — read-only booking page with reschedule/cancel *requests*, plus the admin-side Requests queue

## 9.2 Confirmed decisions (this phase)

| Area | Decision |
|---|---|
| Backend | **Still no Next.js API routes.** Edge Functions are the backend — they run server-side with `service_role` and secrets the browser never sees. Razorpay order creation, signature verification and the webhook all live there. |
| Razorpay account | **One company-wide account.** Keys are Edge Function secrets, not per-admin. |
| Payment methods | Razorpay Checkout default set: UPI (intent + QR), cards, netbanking, wallets. Test mode simulates UPI. |
| Currency | INR only. |
| Dummy payment | **Removed entirely.** Free events skip payment; paid events go through Razorpay. |
| Booking lifecycle | Paid bookings are created as `pending_payment` and **hold the slot for 10 minutes**, then auto-expire. Confirmed only after payment is verified server-side. |
| Amount authority | **Always computed server-side** from the DB. The browser never sends a price. |
| Payment truth | The **webhook** is the source of truth; the browser callback is an optimistic fast-path only. |
| Magic link | Read-only booking details page. No self-serve reschedule/cancel — only **requests** to the admin. |
| Requests | Live in a dedicated **Requests** queue plus a status badge on the Bookings row. Admin approves/rejects. |
| Refunds | **Admin decides** — none / partial / full. Client-facing copy says "subject to approval, not guaranteed." |
| Request notifications | **Dashboard only** for now — no email/WhatsApp to the admin on a new request. |
| Discounts | Percent-only. Admin picks which of their event types each code applies to. Code stored and compared in ALL CAPS. |
| 100% discount | Skips Razorpay, books as free. |
| Bookings off | Admin toggle. Profile + event pages show "Currently unavailable" and a limited enquiry form (name, email, phone, message) → stored in a **separate `booking_enquiries` table**, surfaced as an Enquiries tab. |
| Min notice | New admin setting, default **60 min**. Also closes the reminder gap (short-notice bookings previously never hit the 55–65 min window). |
| Booking window | New admin setting, default **14 days** (currently hardcoded). |
| Profile photo | File upload → Supabase Storage bucket. |
| About-this-session | Reuses the existing `event_types.description`, relabelled in the UI. No new field. |
| Custom questions | Unchanged — still collected in the details modal. |
| Deactivated admin | Public profile and event pages 404. Inactive event types are hidden from the profile. |
| Reviews / GST invoices | Not this phase. |

## 9.3 Data model changes

### Migration `0009_admin_profile.sql`
`admins` gains:
- `photo_url text`, `headline text`, `about text`, `linkedin_url text`, `instagram_url text` — all nullable; each renders publicly only if set
- `accepting_bookings boolean not null default true`
- `unavailable_message text` — optional custom line shown when bookings are off
- `min_notice_minutes int not null default 60`
- `booking_window_days int not null default 14`

Also:
- Supabase **Storage** bucket `admin-photos` (public read; write restricted to the owning admin's folder `<admin_id>/…`)
- `drop function if exists get_public_admin(text);` then recreate returning the new profile fields + `accepting_bookings` *(reminder: Postgres can't change a function's return type via `CREATE OR REPLACE` — this bit us in `0007`)*
- New RPC `get_public_admin_event_types(p_slug text)` — SECURITY DEFINER, returns active event types for the profile page (name, slug, duration, price, description). No PII.

### Migration `0010_discount_codes.sql`
```
discount_codes
  id, admin_id, code (upper, unique per admin), percent (1–100),
  expires_at (nullable = never), max_uses (nullable = unlimited),
  times_used int default 0, is_active bool default true, created_at
discount_code_event_types
  discount_code_id, event_type_id   -- composite PK
```
- RLS: admin-scoped both tables.
- Unique index on `(admin_id, upper(code))`.
- RPC `validate_discount_code(p_admin_slug, p_event_slug, p_code)` — SECURITY DEFINER, anon-callable, returns `{valid, percent, reason}`. **Read-only — never increments.** It exists purely so the UI can show "20% off applied" before checkout; the authoritative re-validation happens again inside `create-razorpay-order`.

### Migration `0011_payments_and_magic_link.sql`
`bookings` gains:
- `manage_token uuid not null default gen_random_uuid()` + unique index — the magic link
- `base_amount numeric`, `discount_code_id uuid`, `discount_percent int`, `amount_due numeric`, `amount_paid numeric`, `currency text default 'INR'`
- `razorpay_order_id text`, `razorpay_payment_id text` (both indexed)
- `refund_amount numeric`, `refund_status text`, `refunded_at timestamptz`
- `cancelled_by text check (cancelled_by in ('admin','client_request'))`
- `hold_expires_at timestamptz` — when a `pending_payment` row goes stale
- `confirmation_sent boolean not null default false`

Constraint changes:
- `status` check gains `'pending_payment'` and `'expired'`
- `payment_status` check becomes `free | pending | paid | failed | refunded | partially_refunded`
- The double-booking unique index must treat `pending_payment` as **blocking** (a held slot is not bookable) but `expired`/`cancelled` as free

New public RPC `get_booking_by_token(p_token uuid)` — SECURITY DEFINER, returns the booking + admin profile + event type for the magic-link page. Returns nothing once past the visibility cutoff (see 9.6).

### Migration `0012_booking_change_requests.sql`
```
booking_change_requests
  id, booking_id, type ('reschedule'|'cancel'),
  client_message text, preferred_start_time timestamptz (nullable),
  status ('pending'|'approved'|'rejected'),
  admin_note text, created_at, resolved_at
```
- Public RPC `create_change_request(p_token, p_type, p_message, p_preferred_start)` — rate-limited by rejecting a second `pending` request on the same booking.
- RLS: admin can read/update requests on their own bookings.

### Migration `0013_booking_enquiries.sql`
```
booking_enquiries
  id, admin_id, event_type_id (nullable), name, email, phone, message,
  status ('new'|'contacted'|'closed'), created_at
```
- Public RPC `create_booking_enquiry(...)` for the bookings-off form.

## 9.4 Payment flow (the security-critical part)

```
Client picks slot → fills details → optionally enters discount code
        ↓
[Edge] create-razorpay-order          (--no-verify-jwt, anon-callable)
  1. Look up admin + event type by SLUG (never by id from the client)
  2. Reject if admin inactive / not accepting bookings / event inactive
  3. Re-validate the slot: inside availability, not blocked, not double-booked,
     >= min_notice_minutes away, <= booking_window_days out
  4. Read price FROM THE DB. Re-validate the discount code server-side
     (active, not expired, under max_uses, applies to THIS event type)
  5. amount = round(price * (100 - percent) / 100)
  6. If amount == 0 → insert booking as confirmed/free, return {free: true}
  7. Else insert booking as pending_payment, hold_expires_at = now() + 10 min
  8. Create the Razorpay order for that amount (secret stays server-side)
  9. Return { order_id, amount, key_id, booking_id } — NOT the manage_token
        ↓
Razorpay Checkout modal (UPI / QR / card / netbanking)
        ↓
   ┌────────────────────────────┴────────────────────────────┐
   ↓ browser callback (fast path)              ↓ Razorpay → server (truth)
[Edge] verify-razorpay-payment            [Edge] razorpay-webhook
  HMAC(order_id|payment_id, KEY_SECRET)     HMAC(raw body, WEBHOOK_SECRET)
  == razorpay_signature ?                   payment.captured / payment.failed
        └────────────────────────────┬────────────────────────────┘
                                     ↓
              Booking → confirmed, payment_status → paid
              (idempotent: whichever arrives first wins, second is a no-op)
                                     ↓
              manage_token returned to the client → confirmation screen
                                     ↓
              DB webhook → relay-booking-to-n8n → Calendar + Meet + email
```

**Security properties this gives us:**

| Threat | Mitigation |
|---|---|
| Client tampers with the price | Amount is read from the DB inside the Edge Function; the request body has no price field at all |
| Client forges a "paid" callback | Signature is HMAC-SHA256 with `RAZORPAY_KEY_SECRET`, which only the Edge Function holds |
| Client skips the callback after paying | The webhook confirms it independently |
| Webhook replay / duplicate delivery | Confirm is idempotent — keyed on `razorpay_payment_id`; a second delivery changes nothing |
| Forged webhook call | `X-Razorpay-Signature` verified against the **raw request body** (must read `await req.text()`, not `req.json()`, before parsing) |
| Discount abuse (expired / wrong event / over-used) | Re-validated server-side at order time; the pre-check RPC is advisory only |
| Slot stolen while paying | The `pending_payment` row holds it, and the unique index blocks a second booking |
| Slot held forever by an abandoned checkout | `hold_expires_at` + a cleanup job frees it after 10 min |
| Race: two people pay for the same slot | The DB unique index rejects the second insert *before* an order is ever created |
| Secrets leaking to the browser | Only `NEXT_PUBLIC_RAZORPAY_KEY_ID` is public (public by design). The secret and webhook secret live only as Edge Function secrets. |
| Enumerating other people's bookings | `manage_token` is a random UUID, returned only after successful payment, and `get_booking_by_token` returns nothing else |

**Cleanup job:** `expire-pending-bookings` Edge Function, called every 10 min by a new n8n schedule workflow (`expire-holds-cron.json`). Sets `status = 'expired'` where `pending_payment` and `hold_expires_at < now()`, freeing the slot.

**Refunds:** `refund-razorpay-payment` (authenticated, admin-only) issues a full or partial refund via Razorpay and writes `refund_amount` / `refund_status` / `refunded_at`. Only reachable from the Requests queue and the booking detail modal.

## 9.5 Confirmation-email regression to watch

Today the DB webhook fires `relay-booking-to-n8n` on **INSERT**, and bookings are inserted already-confirmed. With `pending_payment`, an insert-triggered email would go out **before payment**.

Fix: change the DB webhook to INSERT **or UPDATE**, and have `relay-booking-to-n8n` return early unless `status = 'confirmed' and confirmation_sent = false`. It sets `confirmation_sent = true` before dispatching, so an update storm can't double-send. This must be verified in testing — it's the easiest thing in this phase to break silently.

The confirmation email also gains the **magic link** (`{{base_url}}/booking/{{manage_token}}`).

## 9.6 Magic link page — `/booking/[token]`

Read-only. Shows admin photo + name, event name, about-this-session, date/time in the client's timezone, Meet link, amount paid, and status.

- A small "Need help?" corner offers **Request reschedule** / **Request cancellation**
- Reschedule lets the client optionally propose a slot (reuses the existing picker) plus a message; cancel is message-only
- On submit: "Your request has been sent to the admin" — the copy states clearly that **approval and any refund are at the admin's discretion**
- Request buttons hide once the call start time has passed
- The page stays reachable until **24h after the call ends**, then shows "this booking has passed"
- One pending request per booking; a second attempt shows the existing request's status instead
- `/booking` must be added to `PUBLIC_ROUTE_PREFIXES` in `src/lib/supabase/middleware.ts`

## 9.7 Pages & routes

| Route | Status | Notes |
|---|---|---|
| `/book/[adminSlug]` | **new** | Public profile — photo, name, headline, about, socials, event list. "Free" when price is 0. Bookings-off → unavailable state + enquiry form. |
| `/book/[adminSlug]/[eventSlug]` | redesign | Admin header, price + duration, about, picker, **Continue**, details modal, discount box |
| `/booking/[token]` | **new** | Magic link |
| `/dashboard/profile` | **renamed** from `/dashboard/settings` | Photo upload, headline, about, socials, bookings toggle, plus existing name/email/phone/password |
| `/dashboard/discounts` | **new** | Discount code CRUD + usage count |
| `/dashboard/requests` | **new** | Pending reschedule/cancel queue, approve/reject, refund decision |
| `/dashboard/bookings` | extended | Payment column, request badge on rows, **Enquiries** tab |
| `/dashboard/availability` | extended | Min notice + booking window settings |

Nav (`src/components/layout/nav-config.tsx`) gains Discounts and Requests; Settings becomes Profile. Requests carries a pending-count badge.

## 9.8 Edge Functions (new / changed)

| Function | Auth | Purpose |
|---|---|---|
| `create-razorpay-order` | `--no-verify-jwt` | Validates everything, creates the held booking + Razorpay order |
| `verify-razorpay-payment` | `--no-verify-jwt` | Verifies the browser callback signature, confirms the booking |
| `razorpay-webhook` | `--no-verify-jwt` | Authoritative confirm/fail/refund from Razorpay; raw-body HMAC |
| `expire-pending-bookings` | `--no-verify-jwt` + shared secret | Releases stale holds (n8n cron) |
| `refund-razorpay-payment` | authenticated | Admin-initiated full/partial refund |
| `relay-booking-to-n8n` | *changed* | Confirmed-only guard, `confirmation_sent` flag, magic link + payment info in the payload |

New secrets: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `PUBLIC_BASE_URL`.
New `.env.local` var: `NEXT_PUBLIC_RAZORPAY_KEY_ID` (public by design).

## 9.9 Edge cases to test

**Profile / availability**
- Admin with no photo/headline/about/socials — page must still look intentional, not broken
- Admin with zero active event types
- Deactivated admin → 404; inactive event type → 404
- Bookings toggled off mid-session while a client sits on the event page → blocked at order time, not just hidden in the UI
- Photo upload: oversized file, wrong MIME type, replacing an existing photo (old file should be cleaned up)

**Discounts**
- Expired, inactive, max-uses-reached, wrong event type, wrong admin's code, lowercase input, whitespace, nonexistent code
- 100% code → no Razorpay, booking is free
- Code applied in the UI then expires before the client clicks Pay → rejected server-side
- Same code used concurrently on its last remaining use

**Payments**
- Client closes the Checkout modal → slot stays held 10 min, then frees
- Payment fails → booking stays held, client can retry within the window
- Payment succeeds but the browser dies before the callback → webhook still confirms it
- Webhook arrives before the browser callback (common) → callback is a no-op
- Duplicate webhook delivery → no double-confirm, no double-email
- Two clients race for the last slot → second is rejected before an order is created
- Hold expires *while* the client is paying → payment captured for an expired booking: reconfirm the slot is still free; if not, flag it for admin refund rather than double-booking
- Amount rounding on odd percentages (Razorpay works in paise — all amounts converted with `Math.round(rupees * 100)`)

**Magic link**
- Invalid / random token → generic not-found, no information leak
- Token for a cancelled, expired, or completed booking
- Link opened after the 24h cutoff
- Two requests submitted in quick succession
- Client proposes a slot that's already taken → admin sees it flagged as unavailable

**Requests**
- Admin approves a reschedule → old Calendar event removed, new one created, client emailed
- Admin rejects → booking unchanged, client not auto-notified (dashboard-only this phase)
- Admin approves a cancellation with a partial refund → refund issued, Calendar event removed, `cancelled_by = 'client_request'`
- Refund attempted on a free booking, or one already refunded

**Regressions**
- Confirmation email fires exactly once, and only after payment
- Free bookings still work end to end (no Razorpay involvement)
- Reminder cron unaffected; short-notice gap now closed by min-notice
- Google Calendar conflict detection still respects the new booking-window setting

## 9.10 What you'll need to provide

- [x] Razorpay **test** Key ID + Key Secret
- [x] `razorpay-webhook` deployed, its URL added in the Razorpay dashboard (Settings → Webhooks) with events `payment.captured`, `payment.failed`, `refund.processed`, webhook secret set on both sides
- [x] Migrations `0009`–`0013` run, `admin-photos` Storage bucket created
- [x] `expire-holds-cron.json` imported and activated in n8n
- [x] Edge Functions deployed; Supabase DB webhook on `bookings` changed to fire on INSERT **and** UPDATE
- [x] Vercel Function Region set to `hnd1` (Tokyo), matching the Supabase project's region — a performance fix that came up during this phase, not originally planned, but worth recording here since it changed deploy config

## 9.11 Deferred to a later phase

Testimonials/reviews, earnings & payout dashboard, buffer time, daily booking limits, embed widget, post-call follow-up email, digital products, multiple durations per event type, no-show tracking, analytics, custom branding, Zoom/Teams, GST invoices.

Partly superseded by Phase 11 (§10): the **earnings dashboard** and basic **analytics** shipped as the Payments page and the rebuilt Overview. Payouts themselves are still out of scope — Razorpay settles to the bank account directly, so there's nothing for this app to compute.

## 9.12 Status — shipped

All six items in §9.1 are built, deployed, and tested. A few implementation details ended up differing from the original spec above as the work progressed — recorded here so this document stays accurate rather than aspirational:

- **Payment creation is one function, `create-booking`, not `create-razorpay-order`.** It does both jobs — pricing/validating the booking AND opening the Razorpay order — in a single call, since the two can't safely happen apart (the client must never be able to mint a booking without a matching order). `verify-razorpay-payment`, `razorpay-webhook`, `expire-pending-bookings`, and `refund-razorpay-payment` all shipped as planned.
- **The hold-expiry sweep runs every 5 minutes, not 10** (`expire-holds-cron.json`). A hold set for exactly 10 minutes therefore actually lapses somewhere between 10–15 minutes depending on schedule timing — never earlier, since the sweep only touches holds whose window has already passed. The slot itself frees at exactly 10 minutes regardless; the sweep is just bookkeeping (status + discount-code refund).
- **Reschedule approval doesn't need a new Edge Function or n8n workflow.** Approving reuses the *existing* confirmation pipeline: it clears the old Calendar event, updates the booking's time, and flips `confirmation_sent` back to false — which makes the same DB-webhook → `relay-booking-to-n8n` path fire again as if it were a brand new booking, creating a fresh Calendar event and re-sending a (now-correct) confirmation email. Approve/reject are otherwise plain RLS-guarded table writes from the browser; only the refund step needs the Razorpay secret.
- **Requests get a nav badge with a live pending count**, fetched server-side in `dashboard/layout.tsx` — this was called out as a nice-to-have in the original plan and did ship.

**Two extras shipped in this phase that weren't in the original six-item scope**, both raised during testing rather than planned upfront:

- **Bookings page: sorting + server-side pagination.** Sort by event date or by booking-created date (asc/desc), 20 rows/page with Prev/Next. Rebuilt as a real server-side query (`.range()`/`.order()`/`.ilike()`) rather than paginating an already-fetched list, specifically so it stays a fixed-cost query as booking history grows instead of degrading back into "fetch everything."
- **Every native `window.confirm()` replaced with a themed modal** (`ConfirmProvider`/`useConfirm()`), completing the standing "no native browser/OS UI" rule for the one control that had been missed — cancelling a booking, deleting an event type/discount code/enquiry, removing an admin, disconnecting Calendar.

**Slug editing, previously declined, was added back in.** Earlier in the project the decision was to auto-generate an admin's slug from their name and leave it fixed — no UI to change it, since two same-named admins were expected to be rare and auto-numbering (`harshal`, `harshal-2`, ...) handled the collision case. That held until it came up as a real question: an admin wants a more meaningful link than the auto-numbered fallback. Slug editing now exists in two places — the admin's own Profile page and the super-admin's Edit Admin modal — both going through the existing `update-own-profile` / `update-admin` Edge Functions (uniqueness re-checked server-side, race-safe via the column's existing DB-level unique constraint) and both requiring an explicit confirm, since changing it immediately breaks any `/book/<old-slug>` link already shared.

**Bugs found and fixed during this phase's testing**, worth keeping a record of since they weren't obvious from the plan:
- Razorpay Checkout was treating the *first* `payment.failed` (e.g. a declined card) as terminal, silently dropping a successful retry with a different method in the same session
- `Select` dropdown always opened downward with no viewport check, running off-screen near the bottom of a modal — now measures available space and flips upward when needed
- The booking details modal's "Back to your details" wiped name/email/phone (it was reusing the same state for both "what the client typed" and "which step to show"); custom question answers were unaffected since those lived in separate state
- `getCurrentAdmin()` was being called twice per navigation (once in a layout, once in the page under it) — wrapped in React's `cache()` to dedupe within a request
- A stray `paid_dummy` → `paid` data migration ordering bug (constraint had to be dropped before the backfill, not after)
- The `LeadDetailModal`'s notes/tag `useState` only initializes on mount, but the modal itself never unmounts (it renders `null` when nothing's selected) — one booking's unsaved notes were visibly bleeding into the next booking opened. Fixed with `key={selected?.id}` to force a remount per booking. A second bug in the same save path (`notes || undefined`) meant clearing a note was silently a no-op — fixed to send `null` explicitly.
- The favicon and every "Z" logo tile across the app were the Next.js default / a plain letter box — replaced with an actual mark (a lightning-bolt tile) used consistently in the nav, sidebar, footer, sign-in screen, and `icon.svg`.

**Documentation-accuracy corrections** — found during a full audit pass (three independent reviews: test-coverage, RLS/Edge-Function security, and plan-vs-code consistency) rather than user-reported bugs. Recorded here rather than silently rewritten into §9.1–§9.9 above, which stay as the historical planning record:

- §9.3's migration list is out of order versus what actually shipped. Correct order: `0010_booking_enquiries.sql`, `0011_discount_codes.sql`, `0012_payments_and_magic_link.sql`, `0013_booking_change_requests.sql` (§9.3 has enquiries and change-requests swapped to the wrong ends).
- `get_public_admin_event_types` takes `p_admin_id uuid`, not `p_slug text` as §9.3 states.
- The `discount_codes` schema in §9.3 omits the `applies_to_all` column, which is functionally load-bearing — a code applying to every event type skips the `discount_code_event_types` join table entirely.
- §9.8's Edge Function table still lists `create-razorpay-order`; the line right above it in this section already documents the correction (it shipped as `create-booking`), but the table itself was never updated.
- Two real, working routes are documented nowhere in this file: `/dashboard` (the admin's own stats overview — `DashboardStats`) and `/admin/settings` (the super-admin's own account/password page, distinct from `/dashboard/profile`). Both predate Phase 10 and simply were never added to any page inventory.
- §2's "WhatsApp notifications | Sent via n8n using Zaple" reads as an already-shipped decision. It's still just the decision — **WhatsApp was never actually built**; only email (Gmail via n8n) exists today. SETUP.md's "Still to come" section already says this correctly; this file didn't.
- §3's super-admin panel description promises "number of upcoming bookings (metadata only)" on each admin row. This was never built, and — per an explicit later decision in this project — was deliberately declined, not just deferred. `AdminsTable.tsx` shows admin/link/calendar-status/active-status only.

**Two real security bugs, present since `0001_init.sql` (day one), fixed in migration `0014_security_hardening.sql`:**

1. **Privilege escalation.** `admins_update_own_or_super_admin` had no `WITH CHECK` — it only verified *which row* an admin was touching, never *what value* they set. Any logged-in admin could call `supabase.from('admins').update({ role: 'super_admin' }).eq('id', ownId))` directly and RLS would allow it, for real — not a display bug, an actual role change that then legitimately unlocked every super-admin-gated Edge Function. The migration's own comment claimed this was "enforced in application layer + revoked columns below," but the only column actually revoked was `google_refresh_token`. Fixed by revoking client-side `UPDATE` on `role`/`is_active`/`auth_user_id` entirely (same technique already used for `google_refresh_token`) and moving the one legitimate `is_active` write (super-admin deactivating someone) into the `update-admin` Edge Function.
2. **Deactivating an admin didn't revoke their access.** `current_admin_id()` — the ownership check behind nearly every non-`admins` RLS policy — never checked `is_active`, unlike `is_super_admin()` which already did. A "deactivated" admin's existing session could still fully read/write their own bookings, event types, discount codes, etc. via the API directly; deactivation only blocked the app's own login screen. Fixed by adding `and is_active = true` to `current_admin_id()`.
3. **Super-admin could read every admin's bookings, event types, and blocked slots** — contradicting the "siloed even from super-admin" decision stated in §2, §5, and §8. Each of the three tables already had a same-admin-only policy that covered `SELECT` on its own; the extra `_select_own_or_super_admin` policies were dropped since their only real effect was the unwanted bypass.
4. **Moderate, defense-in-depth:** `refund-razorpay-payment` resolved a client-supplied `booking_change_requests.id` using the service-role client with no check that it belonged to the booking just refunded. Not cross-admin exploitable (the id is never exposed to another admin anywhere in the app), but tightened anyway — the update now runs through the RLS-scoped caller client, filtered on both `id` and `booking_id`.

None of these four needed a UI change or lost any working feature — confirmed no frontend code depended on the super-admin table-read bypass, and the `is_active` toggle already only had one call site.

**Two items flagged, not changed — worth a conscious decision, not a silent fix:**
- Any admin can still `insert`/`update` their own `bookings` rows directly (status, `amount_paid`, `payment_status`, etc.) — `bookings_all_own` has no column restriction. Doesn't cross admin boundaries, but it does mean the careful server-side pricing/conflict logic in `create_booking_priced` can be bypassed for an admin's own data (e.g. manually marking a booking "paid"). Worth deciding whether that's an accepted trade-off (useful for manual entry) or something to lock down.
- `approveReschedule`'s conflict check (`src/lib/api/changeRequests.ts`) only queries `bookings`/`blocked_slots` for `confirmed`/`pending_confirmation` status — it does not check live `pending_payment` holds or the admin's real Google Calendar, and doesn't re-check min-notice/booking-window despite the function's own comment implying it does. An admin could approve a reschedule onto a slot someone is mid-payment for. Narrow window, real gap — worth a follow-up fix.

---

## 10. Phase 11 — Product surface, theming and money visibility

Everything below shipped after the Phase 10 audit (§9.12). Unlike Phase 10 this wasn't planned up front as a block — it came out of testing the built product and reacting to what was missing or wrong, so this section is a record of what exists rather than a spec written ahead of it.

## 10.1 Scope

| Area | What shipped |
|---|---|
| Marketing site | Full landing page at `/`, which previously just redirected to `/login`. Nav, hero with a live product mock, features, how-it-works, payments, automation, teams, FAQ, CTA, footer. Deliberately no fabricated logos, testimonials or usage stats — the page is shown to real prospects, so its credibility comes from product mocks and specific capability copy. |
| Branding | Real logo mark (lightning bolt in a gradient tile) replacing the plain "Z" box, used in nav, sidebar, footer, sign-in and as `icon.svg`. The stock Next.js `favicon.ico` was still in place and has been removed. |
| Sign-in | Split-screen layout: form left, fixed-dark brand panel right. Explains that accounts are provisioned by a super-admin, turning the absent sign-up into a stated access model rather than a gap. |
| Dark mode | Token-based, **scoped to `/dashboard` and `/admin` only** — see §10.3. |
| App shell | Sidebar now collapsible on desktop, visually distinct from the content area, and no longer scrolls away with the page. |
| Public profile | `/book/[adminSlug]` rebuilt as a Topmate-style split: sticky identity panel (~38%) beside a session grid. |
| Payments | New `/dashboard/payments` — full transaction list, totals, refund status, CSV export. |
| Overview | Rebuilt from three counters into earnings, today's schedule, action items and top sessions. |
| Blocked time | Repeating blocks (weekly / fortnightly / monthly) and a DB-level overlap guard. |

## 10.2 Migrations added

- `0015_admin_social_links.sql` — `x_url` + `website_url` on admins; re-creates `get_public_admin` and `get_booking_by_token` to return them. **Note:** shipping the frontend before this migration ran caused a login loop — `ADMIN_COLUMNS` asked for columns that didn't exist, `getCurrentAdmin()` returned null, and every gated layout read that as "not signed in". `getCurrentAdmin()` now logs the query error instead of swallowing it, so the next schema drift is diagnosable in seconds.
- `0016_recurring_blocked_slots.sql` — `recurrence_group_id`, plus a `btree_gist` **exclusion constraint** preventing overlapping blocks per admin.
- `0017_dashboard_overview.sql` — `get_dashboard_overview()`.
- `0018_payment_summary.sql` — `get_payment_summary(from, to)`.

`0015`–`0018` must all be run before deploying the matching frontend — `0015` in particular, for the reason above.

Both new RPCs deliberately take **no `admin_id` argument**. They're `SECURITY DEFINER` (so they can aggregate across rows, which means RLS does not apply inside them) — an `admin_id` parameter would therefore be a free read of any other admin's revenue. They derive the admin from `current_admin_id()` instead, leaving nothing to tamper with.

## 10.3 Dark mode — how it's built, and why

Implemented by **re-pointing the design tokens** under a `.dark` class rather than adding `dark:` variants across ~70 components. Anything already built on `bg-surface` / `text-neutral-900` / `border-border` adapts with no per-component work.

Consequences worth knowing:

- **The neutral scale inverts.** `text-neutral-900` is the primary text colour, so in dark mode it must resolve light — which means `bg-neutral-900` resolves light too. Any surface that must stay dark in *both* themes (modal backdrops, the landing CTA panel, the sign-in brand panel, the public profile's indigo panel) uses raw `slate-*`/`indigo-*`, which sit outside the token system.
- **Semantic accents are tokenised.** ~24 raw `emerald`/`red`/`amber` utilities became `success`/`warning`/`danger` tokens; left alone they'd have produced dark-green text on a dark-green badge.
- **The class lives on `<html>`, not a wrapper.** Portal-rendered modals, dropdowns and date pickers mount to `document.body` and would escape any scoped container, leaving a light page with dark popups.
- **But it's applied only on `/dashboard` and `/admin`** (`isThemedRoute` in `src/lib/theme.ts`). Dark mode is an admin-workspace preference; the public booking pages, magic link and marketing site always render light. Enforced in two places — the provider re-evaluates on route change, and the pre-paint boot script does the same path check so an admin previewing their own booking page gets no dark flash.
- The boot script reads its storage key from a **plain module**, not the `"use client"` provider. A constant imported from a client module into a server component arrives as a client *reference proxy*, not the string — which emitted a broken script until caught.

## 10.4 Repeating blocked time — design note

A repeating block is **materialised as one row per occurrence** sharing a `recurrence_group_id`, not stored as a rule expanded at read time.

Conflict checking currently lives in four independent places — `get_busy_ranges`, `create_booking_priced`, the reschedule-approval query, and the Google Calendar sync. Concrete rows mean all four keep working untouched. A stored rule would mean teaching every one of them to expand recurrences, and missing any single one would silently let a client book over blocked time. Capped at 60 occurrences, since each is a real row that also syncs to Google Calendar.

## 10.5 Client-facing fixes

- Reschedule/cancel **reason is now mandatory** — the admin is being asked to approve a change and decide a refund; "no reason given" just forces another round-trip.
- **Country-code selector** (36 codes, India default) with per-country digit rules, and stricter email validation than zod's `.email()` allows. Phone stored as E.164.
- Dropdown questions always offer **"Other"** with a free-text box; the typed value is what's stored, so the admin sees the real answer rather than a literal "Other".
- Booking-details modal **cannot be dismissed by an outside click** — a client losing their typed details mid-booking is the highest-cost version of that mistake.

## 10.6 Admin-facing fixes

- Form modals refuse backdrop/Escape dismissal **once the form is dirty** (untouched modals still close freely); X and Cancel always work.
- Dropdowns are **searchable** past 8 options and open downward by default — the earlier "flip up when short on space" fix was making them open in the wrong direction inside modals.
- Native number-input spinners removed globally.
- Pagination on Bookings (server-side), and Discounts, Enquiries, Requests, Admins, Event Types (client-side, via `usePagination`). The split is deliberate: bookings grow without bound, the others are small-N.
- Discounts gained search + status + event-type filters. An "applies to all sessions" code correctly matches any event-type filter.
- Password show/hide toggle; `Edit` promoted out of the ⋯ menu on Discounts.
- Booking link card now shows the full URL with Copy / View / Edit.
- `LeadDetailModal` notes no longer bleed between bookings (the modal never unmounts, so its `useState` initialiser only ran once — fixed with a `key`); clearing a note now actually clears it.

## 10.7 Performance

Fixed: Vercel function region colocated with Supabase (Tokyo) — compute was in Virginia, crossing the Pacific per query; `getCurrentAdmin()` deduped with React `cache()` (layout and page both called it); `loading.tsx` added to all dashboard routes (Next.js holds the *old* page on screen until the new one renders, so navigation read as "nothing happened"); the overview's four client-side queries moved server-side into one RPC.

**Still outstanding:** Bookings, Event Types, Discounts, Requests, Enquiries and the Admins list still fetch client-side after mount, so those keep a shell → spinner → data pattern. Middleware and the layout each still call `auth.getUser()` — one could be removed by passing the validated id downstream in a request header, but it's fiddly around Supabase's cookie refresh and worth less now the regions are colocated.

## 10.8 Still open

- The two items flagged in §9.12 remain unaddressed: admins can write arbitrary values to their own `bookings` rows, and `approveReschedule` doesn't check live `pending_payment` holds or Google Calendar before approving.
- ~~WhatsApp/Zaple notifications are still not built — email only.~~ **Corrected 8 Sep:** Zaple *is* wired, for one message only — the admin's "new booking" alert (the `HTTP Request3` node in `create-booking-event.json`). Clients still get email only. Phase 12 (§11) fills the rest in.
- Payment-page view tracking / conversion rate ("120 viewed, 8 booked") would need new view logging on `/book/*`; deliberately not added.

---

## 11. Phase 12 — Meeting intelligence, MoM delivery and payment recovery

Three additions, requested 10 Sep:

1. **Fireflies on every recorded meeting**, with the summary stored against that booking on the admin side
2. **MoM (minutes of meeting) delivered to both the admin and the client** after the call
3. **Abandoned-payment reminder** — someone who reached checkout and let the hold lapse gets nudged back

All notifications reuse the existing Gmail + Zaple pipeline in n8n.

## 11.1 Where WhatsApp actually stands

Worth stating plainly, because §9.12 and §10.8 both said WhatsApp "was never built" and that stopped being true on 8 Sep:

| Recipient | Event | Email | WhatsApp |
|---|---|---|---|
| Admin | New booking | — | **Built** — `HTTP Request3` in `create-booking-event.json` |
| Client | Booking confirmed | Built (Gmail) | **Not planned** — email is enough |
| Client | 1 hour before | Built (Gmail) | **Not planned** — email is enough |
| Client | MoM ready | Phase 12 | Phase 12 |
| Admin | MoM ready | Phase 12 | Phase 12 |
| Client | Payment not completed | Phase 12 | Phase 12 |

The one built node is the template for all of them:

```
POST https://app.zaple.ai/api/v2/send-template-message
  template_id, country_code, send_to, template_argument1..N
```

`template_argumentN` maps to `{{N}}` in the approved Meta template.

**Phone formats differ between the two sides and this is a real trap.** `admins.phone` is a bare 10-digit string and the node hardcodes `country_code: "91"`. `bookings.client_phone` is **E.164** (`+919876543210`) since the Phase 11 country-code work. Zaple needs the dial code and the national number as separate fields, so the client's number has to be split back apart — by **longest-prefix match against `COUNTRY_CODES`**, never a fixed-length slice, since dial codes run 1–4 digits (`+1`, `+91`, `+971`, `+1264`). The split belongs in `relay-booking-to-n8n` and the new reminder RPC, so no n8n expression ever has to do it.

## 11.2 Confirmed decisions (this phase)

| Area | Decision |
|---|---|
| WhatsApp scope | **Three new messages only**: client MoM, admin MoM, client payment-not-completed. Booking confirmation and the 1-hour reminder stay email-only — they already work, and a WhatsApp duplicate of an email the client just received is noise rather than reach. |
| Fireflies account | **One company account.** A single API key + webhook secret held as Edge Function secrets, not per-admin credentials. Deliberately breaks the §2 no-hardcoding principle for this one integration: per-admin would mean every admin buying their own Fireflies seat, and the value here is a company-wide meeting record. Watch the seat's **concurrent-bot limit** — two admins in calls at the same time may need a second seat. |
| How the bot joins | **Invited as a calendar attendee** (`fred@fireflies.ai`) on the event n8n already creates. We decide per meeting what gets recorded, and no admin has to configure anything inside Fireflies. The alternative — each admin linking their calendar to Fireflies — would also record their non-Zaptly meetings and give us no per-event control. |
| What gets recorded | **Per event type**, via a `record_meeting` toggle. A paid strategy call is worth recording; a free 15-minute intro probably isn't. |
| Client consent | When `record_meeting` is on, the public event page states it before booking, and the confirmation email repeats it. A recording bot appearing unannounced in someone's call is the thing to avoid; saying "you'll get the notes afterwards" also turns it into a benefit. |
| MoM delivery | **Auto-sent to both** as soon as Fireflies finishes — no admin approval step. |
| MoM content split | The client gets **short summary + action items only**. The admin gets that plus the full overview, keywords and the transcript link. See the risk note in §11.6. |
| Canonical MoM home | The **existing magic-link page** `/booking/[token]`. Email and WhatsApp both point at it. |
| MoM over WhatsApp | Short "your notes are ready" template + the magic link. **A MoM cannot go in a WhatsApp template** — Meta rejects newlines, tabs and 4+ consecutive spaces inside variable values, and caps the body near 1024 characters. |
| MoM over email | Full text inline (email has neither limit) plus the same link. |
| Abandoned reminder timing | **One reminder, ~15 minutes after the hold expires** (so ~25 minutes after they started). Sending on expiry risks landing while they're actively retrying; a second reminder is spam aimed at someone who already declined. |
| Abandoned reminder honesty | The hold is released at expiry, so the slot is genuinely gone. The message must **not** say "your slot is reserved" — it sends them back to the event page to pick a time again. |
| Suppression | No reminder if that email already has a `confirmed` booking for the same event type created after the expired one — they retried and succeeded, and telling them otherwise is worse than silence. |

## 11.3 Data model changes

### Migration `0019_meeting_summaries.sql`

- `event_types.record_meeting boolean not null default false`
- `bookings.meet_link` gets an index — it's the join key from Fireflies back to a booking
- New table `meeting_summaries`:

| Column | Notes |
|---|---|
| `id` | uuid pk |
| `booking_id` | fk → bookings, **unique** — one summary per booking |
| `admin_id` | fk → admins; denormalised so RLS is a plain `admin_id = current_admin_id()` like every other table |
| `fireflies_meeting_id` | text, **unique** — the idempotency key; Fireflies can retry a webhook |
| `title`, `short_summary`, `overview` | text |
| `action_items`, `keywords` | jsonb arrays |
| `transcript_url`, `duration_minutes` | admin-only fields |
| `raw` | jsonb — the whole Fireflies payload, so a later change of mind about which fields matter needs no re-fetch |
| `mom_sent_at` | timestamptz null |
| `created_at` | |

RLS: admins `select` their own rows. **No client-side insert or update at all** — the row is written by the Edge Function under the service role, so an admin can't fabricate or edit a meeting record.

### Migration `0020_abandoned_payment_reminders.sql`

- `bookings.abandoned_reminder_sent boolean not null default false`
- Partial index on `(status, abandoned_reminder_sent)` where `status = 'expired'`
- `get_abandoned_bookings(p_min_age_minutes int)` — service-role only. Returns expired unpaid bookings older than the cutoff, already joined to admin name/slug, event-type name/slug and a pre-split `client_phone_country_code` / `client_phone_national`, and already filtered by the retry-suppression rule in §11.2. That `NOT EXISTS` check is why this is an RPC and not a PostgREST query from n8n.
- `mark_abandoned_reminder_sent(p_booking_id uuid)`

## 11.4 Fireflies flow

1. Booking confirmed → `relay-booking-to-n8n` fires as it does today, now also passing `event_type.record_meeting` and the split client phone.
2. n8n's Google Calendar node appends `fred@fireflies.ai` to `attendees` **only when `record_meeting` is true**. The bot joins from the calendar invite.
3. Call happens. Fireflies transcribes and summarises.
4. Fireflies fires its `Transcription completed` webhook at a new Edge Function, **`fireflies-webhook`**:
   - Verifies the `x-hub-signature` HMAC-SHA256 over the **raw body** — same pattern as `razorpay-webhook`, and for the same reason: re-serialising parsed JSON changes the bytes and breaks the signature.
   - Fetches the transcript from `https://api.fireflies.ai/graphql` (`summary { short_summary overview action_items keywords }`, `meeting_link`, `duration`, `transcript_url`).
   - **Matches `meeting_link` against `bookings.meet_link`**, normalised — lowercased, query string and trailing slash stripped. Matching on title or time would be guesswork; the Meet URL is exact.
   - No match → return 200 with `{skipped}`. Someone may have invited the bot to a non-Zaptly meeting; that is not an error and must not retry forever.
   - Upserts `meeting_summaries` on `fireflies_meeting_id`.
   - Posts to a new n8n webhook to send the MoM.
5. n8n `mom-ready` workflow sends four messages: email + WhatsApp to the admin, email + WhatsApp to the client.
6. `/booking/[token]` renders the client's MoM. `/dashboard/bookings` → booking detail renders the admin's fuller version.

**Why the webhook, not polling.** Fireflies takes minutes to finish and the wait varies with call length. A cron would either poll constantly or add lag; the webhook fires exactly once when the transcript is actually ready.

## 11.5 Abandoned-payment flow

`expire_pending_bookings()` already flips the status to `expired` every 5 minutes and refunds the discount-code use (§9.12). This hangs off that existing sweep rather than adding a second notion of "abandoned":

1. New n8n cron, every 10 minutes → `get_abandoned_bookings(15)`.
2. Split → send email + WhatsApp → `mark_abandoned_reminder_sent`.
3. Link goes to `/book/{admin_slug}/{event_slug}` — the event page, not a dead held slot.

**WhatsApp category.** All three templates were created and approved as **Utility**, the payment-recovery one included — it follows from a checkout the client themselves started, so it reads as transactional rather than promotional. That removes the opt-in requirement and the mandatory opt-out line that a Marketing classification would have forced, and means no consent checkbox is needed on the booking form. Worth knowing that Meta re-reviews template categories and can reclassify one after the fact; if that happens to the payment template it stops sending and falls back to email, without touching the two MoM templates.

## 11.6 Risk accepted: auto-sending the MoM

Auto-send to both was chosen over admin review. The real exposure is that an AI summary of a **sales** call can contain pricing strategy, an aside made before the client joined, or a mischaracterisation — and it reaches the client with nobody having read it.

Three things blunt it, none of which add an approval step:

- The client's copy is built from **`short_summary` + `action_items` only** — never `overview`, never the transcript link. Those are the fields most likely to carry stray context.
- `record_meeting` is **per event type and defaults off**, so a sales call can simply not be recorded.
- The client's MoM lives on `/booking/[token]`, so if something does go out wrong there's one place to correct it.

If this bites in practice, the smallest fix is a delay — hold the client's copy for 30 minutes, send the admin's immediately, and put a "don't send" button on the booking. Not building that now.

## 11.7 Files to add / change

**New:** `0019_meeting_summaries.sql`, `0020_abandoned_payment_reminders.sql`, `supabase/functions/fireflies-webhook/`, `n8n/workflows/mom-ready.json`, `n8n/workflows/abandoned-payment-cron.json`, a MoM block on `/booking/[token]`, a MoM panel in the booking detail view.

**Changed:** `relay-booking-to-n8n` (add `record_meeting`, split client phone), `create-booking-event.json` (Fireflies attendee; also rename `HTTP Request3` to something legible), `EventTypeFormModal` (`record_meeting` toggle), the public event page (recording notice). `reminder-cron.json` is untouched — the 1-hour reminder stays email-only.

## 11.8 What you'll need to provide

- Fireflies **paid plan with API access**, its API key, and a webhook secret
- ~~Approved Zaple/Meta templates~~ — done, all three approved as Utility:
  - Client MoM ready — `188758117891098742496888`
  - Admin MoM ready — `126497717891099281990193`
  - Client payment not completed — `272563817891100082631965`
- Confirmation of the Fireflies notetaker address — `fred@fireflies.ai` at time of writing, worth re-checking against their current docs

## 11.9 Open

- Fireflies seat concurrency if two admins run calls simultaneously
- Whether a client should be able to opt out of the recording at booking time, or only the admin decides per event type
