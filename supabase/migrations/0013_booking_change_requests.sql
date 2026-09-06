-- Zaptly — client-initiated reschedule/cancellation requests
--
-- The magic-link page never lets a client change a booking directly — it
-- only lets them REQUEST a change. The admin reviews and decides. This
-- mirrors "just like other company tactics" per the product decision: no
-- self-service reschedule/cancel, only a request + admin approval.

create table if not exists booking_change_requests (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings (id) on delete cascade,
  type text not null check (type in ('reschedule', 'cancel')),
  client_message text,
  -- Only meaningful for type = 'reschedule'. A proposal, not a guarantee —
  -- re-validated for real (availability, notice, booking window) at the
  -- moment the admin approves it, since time has passed since the client
  -- submitted it.
  preferred_start_time timestamptz,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists booking_change_requests_booking_id_idx on booking_change_requests (booking_id);
-- One pending request per booking at a time — enforced here AND in the RPC
-- below, so a race between two submissions can't sneak a second one past
-- the RPC's own pre-check.
create unique index if not exists booking_change_requests_one_pending_per_booking
  on booking_change_requests (booking_id)
  where status = 'pending';

alter table booking_change_requests enable row level security;

-- Scoped through the booking's own admin — same pattern as
-- discount_code_event_types being scoped through its parent code.
create policy "booking_change_requests_select_own"
  on booking_change_requests for select
  using (exists (select 1 from bookings b where b.id = booking_id and b.admin_id = current_admin_id()));

create policy "booking_change_requests_update_own"
  on booking_change_requests for update
  using (exists (select 1 from bookings b where b.id = booking_id and b.admin_id = current_admin_id()));

-- No INSERT policy for authenticated users — rows only ever arrive through
-- the SECURITY DEFINER RPC below, which the magic-link page (anonymous)
-- calls.

-- ============================================================================
-- Public submission RPC
-- ============================================================================
create or replace function create_change_request(
  p_token uuid,
  p_type text,
  p_message text,
  p_preferred_start timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking bookings%rowtype;
  v_request_id uuid;
begin
  if p_type not in ('reschedule', 'cancel') then
    raise exception 'Invalid request type.';
  end if;

  select * into v_booking from bookings b where b.manage_token = p_token;
  if not found then
    raise exception 'This booking link is not available.';
  end if;

  if v_booking.status not in ('confirmed') then
    raise exception 'This booking can no longer be changed.';
  end if;

  if v_booking.end_time < now() then
    raise exception 'This booking has already passed.';
  end if;

  if exists (
    select 1 from booking_change_requests r
    where r.booking_id = v_booking.id and r.status = 'pending'
  ) then
    raise exception 'A request is already pending for this booking.';
  end if;

  insert into booking_change_requests (booking_id, type, client_message, preferred_start_time)
  values (v_booking.id, p_type, nullif(trim(coalesce(p_message, '')), ''), p_preferred_start)
  returning id into v_request_id;

  return v_request_id;
end;
$$;

grant execute on function create_change_request(uuid, text, text, timestamptz) to anon, authenticated;

-- ============================================================================
-- Magic-link page needs to know about any existing request for this
-- booking, so it can show "request pending" instead of the buttons rather
-- than letting the client submit a second one blind.
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
    -- Only exposed so the magic-link page can offer a real slot picker
    -- when proposing a reschedule — the same public data an anonymous
    -- visitor already sees on /book/<slug>, nothing more sensitive.
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
    -- Unpaid holds have no magic link yet, and the page stops resolving a
    -- full day after the call ends.
    and b.status <> 'pending_payment'
    and b.end_time > now() - interval '24 hours';
$$;

grant execute on function get_booking_by_token(uuid) to anon, authenticated;
