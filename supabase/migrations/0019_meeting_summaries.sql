-- Zaptly — Fireflies meeting summaries (Phase 12, §11.3)
--
-- Two things: a per-event-type opt-in for recording, and the table that
-- stores the summary Fireflies sends back once a call finishes.

-- ============================================================================
-- 1. Recording opt-in, per event type. Defaults off — a client on a free
--    intro call shouldn't get a recording bot with no warning, and an admin
--    running sales calls may not want every word transcribed either.
-- ============================================================================
alter table event_types
  add column if not exists record_meeting boolean not null default false;

-- ============================================================================
-- 2. meeting_summaries — one row per booking, written only by the
--    fireflies-webhook Edge Function under the service role.
--
--    No client-side insert/update policy at all: an admin has no legitimate
--    reason to write this table directly, and allowing it would mean an
--    admin could fabricate a "summary" for a call that never happened, or
--    edit one after the fact with nothing to show it was changed.
-- ============================================================================
create table if not exists meeting_summaries (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references bookings (id) on delete cascade,
  -- Denormalised so RLS here is the same one-liner as every other table
  -- (`admin_id = current_admin_id()`) instead of a join through bookings.
  admin_id uuid not null references admins (id) on delete cascade,
  -- Fireflies can retry its own webhook delivery; this is the idempotency
  -- key the webhook upserts on.
  fireflies_meeting_id text not null unique,
  title text,
  short_summary text,
  overview text,
  action_items jsonb not null default '[]'::jsonb,
  keywords jsonb not null default '[]'::jsonb,
  transcript_url text,
  duration_minutes integer,
  -- The full Fireflies payload, kept verbatim — so a later decision to
  -- surface one more field doesn't need a re-fetch from their API.
  raw jsonb not null default '{}'::jsonb,
  mom_sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists meeting_summaries_admin_id_idx on meeting_summaries (admin_id);

alter table meeting_summaries enable row level security;

create policy meeting_summaries_select_own
  on meeting_summaries for select
  to authenticated
  using (admin_id = current_admin_id());

-- ============================================================================
-- 3. bookings.meet_link needs an index — it's the join key the webhook uses
--    to match a Fireflies transcript back to the booking it belongs to.
-- ============================================================================
create index if not exists bookings_meet_link_idx on bookings (meet_link) where meet_link is not null;

-- ============================================================================
-- 4. get_public_event_type — recreated to also return record_meeting, so
--    the public event page can show a recording notice before the client
--    books rather than a bot appearing unannounced in the call.
-- ============================================================================
drop function if exists get_public_event_type(uuid, text);

create function get_public_event_type(p_admin_id uuid, p_slug text)
returns table (
  id uuid,
  admin_id uuid,
  slug text,
  name text,
  duration_minutes integer,
  price numeric,
  description text,
  custom_questions jsonb,
  record_meeting boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select id, admin_id, slug, name, duration_minutes, price, description, custom_questions, record_meeting
  from event_types
  where admin_id = p_admin_id and slug = p_slug and is_active = true;
$$;

grant execute on function get_public_event_type(uuid, text) to anon, authenticated;

-- ============================================================================
-- 5. get_booking_by_token — recreated to also return the client-safe half
--    of the meeting summary, so /booking/[token] can render the MoM once
--    it's ready. Deliberately NOT the admin's fuller fields (overview,
--    keywords, transcript_url) — see PLAN.md §11.2's "MoM content split".
-- ============================================================================
drop function if exists get_booking_by_token(uuid);

create function get_booking_by_token(p_token uuid)
returns table (
  id uuid,
  start_time timestamptz,
  end_time timestamptz,
  status text,
  payment_status text,
  amount_paid numeric,
  amount_due numeric,
  client_name text,
  client_email text,
  client_timezone text,
  meet_link text,
  admin_id uuid,
  admin_name text,
  admin_slug text,
  admin_photo_url text,
  admin_headline text,
  admin_weekly_availability jsonb,
  admin_google_calendar_connected boolean,
  admin_min_notice_minutes integer,
  admin_booking_window_days integer,
  event_type_id uuid,
  event_name text,
  event_description text,
  duration_minutes integer,
  request_id uuid,
  request_type text,
  request_status text,
  request_preferred_start timestamptz,
  mom_short_summary text,
  mom_action_items jsonb
)
language sql
security definer
set search_path = public
stable
as $$
  select
    b.id, b.start_time, b.end_time, b.status, b.payment_status,
    b.amount_paid, b.amount_due,
    b.client_name, b.client_email, b.client_timezone, b.meet_link,
    a.id, a.name, a.slug, a.photo_url, a.headline,
    a.weekly_availability, a.google_calendar_connected,
    a.min_notice_minutes, a.booking_window_days,
    et.id, et.name, et.description, et.duration_minutes,
    r.id, r.type, r.status, r.preferred_start_time,
    ms.short_summary, ms.action_items
  from bookings b
  join admins a on a.id = b.admin_id
  join event_types et on et.id = b.event_type_id
  left join lateral (
    select id, type, status, preferred_start_time
    from booking_change_requests
    where booking_id = b.id
    order by created_at desc
    limit 1
  ) r on true
  left join meeting_summaries ms on ms.booking_id = b.id
  where b.manage_token = p_token
    and b.status <> 'pending_payment'
    and b.end_time > now() - interval '24 hours';
$$;

grant execute on function get_booking_by_token(uuid) to anon, authenticated;
