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
- Syncing manual blocks to actual Google Calendar
- Automatic Google Calendar event deletion on cancel (manual for now)
- Super-admin visibility into admins' individual bookings/leads (siloed by design)
