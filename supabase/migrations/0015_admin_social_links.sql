-- Zaptly — additional public profile links (X/Twitter + personal website)
--
-- Same treatment as the existing linkedin_url/instagram_url: optional, and
-- rendered on the public profile only when actually filled in.
--
-- Column is `x_url` rather than `twitter_url` — the platform rebranded to X
-- in 2023, and the admin-facing label says "X (Twitter)" so it's still
-- recognisable to people who know it by the old name.

alter table admins
  add column if not exists x_url text,
  add column if not exists website_url text;

-- ============================================================================
-- Public admin lookup — return the two new links
-- ============================================================================
-- Postgres won't let CREATE OR REPLACE change a function's output columns,
-- so the old version has to be dropped first (same reason as 0007 and 0009).
drop function if exists get_public_admin(text);

create function get_public_admin(p_slug text)
returns table (
  id uuid,
  name text,
  slug text,
  timezone text,
  weekly_availability jsonb,
  google_calendar_connected boolean,
  photo_url text,
  headline text,
  about text,
  linkedin_url text,
  instagram_url text,
  x_url text,
  website_url text,
  accepting_bookings boolean,
  unavailable_message text,
  min_notice_minutes integer,
  booking_window_days integer
)
language sql
security definer
set search_path = public
stable
as $$
  select
    id, name, slug, timezone, weekly_availability, google_calendar_connected,
    photo_url, headline, about, linkedin_url, instagram_url, x_url, website_url,
    accepting_bookings, unavailable_message, min_notice_minutes, booking_window_days
  from admins
  where slug = p_slug and is_active = true;
$$;

grant execute on function get_public_admin(text) to anon, authenticated;

-- ============================================================================
-- Magic-link lookup — same two links, so the booking page's admin header
-- matches the public profile rather than silently dropping them.
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
  request_preferred_start timestamptz
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
    r.id, r.type, r.status, r.preferred_start_time
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
  where b.manage_token = p_token
    and b.status <> 'pending_payment'
    and b.end_time > now() - interval '24 hours';
$$;

grant execute on function get_booking_by_token(uuid) to anon, authenticated;
