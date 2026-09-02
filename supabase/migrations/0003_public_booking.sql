-- Zaptly — public booking page support
--
-- The public booking flow needs anonymous visitors to (1) look up an admin
-- and event type by slug, (2) see busy time windows without seeing any
-- other client's name/email/phone, and (3) create a booking without being
-- able to set internal-only fields (status, google_event_id, meet_link,
-- notes, tag). All three are SECURITY DEFINER functions that return only
-- the specific columns needed — anon gets NO direct table grants on
-- admins/event_types/bookings/blocked_slots.

-- ============================================================================
-- 1. Look up an active admin's public profile by slug
-- ============================================================================
create or replace function get_public_admin(p_slug text)
returns table (id uuid, name text, slug text, timezone text, weekly_availability jsonb)
language sql
security definer
set search_path = public
stable
as $$
  select id, name, slug, timezone, weekly_availability
  from admins
  where slug = p_slug and is_active = true;
$$;

grant execute on function get_public_admin(text) to anon, authenticated;

-- ============================================================================
-- 2. Look up an active event type by admin + slug
-- ============================================================================
create or replace function get_public_event_type(p_admin_id uuid, p_slug text)
returns table (
  id uuid,
  admin_id uuid,
  slug text,
  name text,
  duration_minutes integer,
  price numeric,
  description text,
  custom_questions jsonb
)
language sql
security definer
set search_path = public
stable
as $$
  select id, admin_id, slug, name, duration_minutes, price, description, custom_questions
  from event_types
  where admin_id = p_admin_id and slug = p_slug and is_active = true;
$$;

grant execute on function get_public_event_type(uuid, text) to anon, authenticated;

-- ============================================================================
-- 3. Busy time ranges for an admin within a window (bookings + manual
--    blocks combined) — start/end only, never client PII.
-- ============================================================================
create or replace function get_busy_ranges(p_admin_id uuid, p_from timestamptz, p_to timestamptz)
returns table (start_time timestamptz, end_time timestamptz)
language sql
security definer
set search_path = public
stable
as $$
  select start_time, end_time
  from bookings
  where admin_id = p_admin_id
    and status in ('pending_confirmation', 'confirmed')
    and start_time < p_to
    and end_time > p_from
  union all
  select start_time, end_time
  from blocked_slots
  where admin_id = p_admin_id
    and start_time < p_to
    and end_time > p_from;
$$;

grant execute on function get_busy_ranges(uuid, timestamptz, timestamptz) to anon, authenticated;

-- ============================================================================
-- 4. Create a booking — validates the slot is real, active, and free of
--    conflicts, and sets every internal field itself (status,
--    payment_status, reminder_sent, etc). The caller cannot override these.
-- ============================================================================
create or replace function create_public_booking(
  p_admin_id uuid,
  p_event_type_id uuid,
  p_client_name text,
  p_client_email text,
  p_client_phone text,
  p_custom_answers jsonb,
  p_start_time timestamptz,
  p_client_timezone text
)
returns table (id uuid, start_time timestamptz, end_time timestamptz, status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_type event_types%rowtype;
  v_admin admins%rowtype;
  v_end_time timestamptz;
  v_payment_status text;
  v_conflict_count integer;
  v_booking_id uuid;
begin
  select * into v_admin from admins a where a.id = p_admin_id and a.is_active = true;
  if not found then
    raise exception 'This booking page is not available.';
  end if;

  select * into v_event_type
  from event_types et
  where et.id = p_event_type_id and et.admin_id = p_admin_id and et.is_active = true;
  if not found then
    raise exception 'This event type is no longer available.';
  end if;

  if p_start_time < now() then
    raise exception 'That time has already passed. Please pick another slot.';
  end if;

  v_end_time := p_start_time + make_interval(mins => v_event_type.duration_minutes);
  v_payment_status := case when v_event_type.price > 0 then 'paid_dummy' else 'free' end;

  -- Re-check for conflicts at insert time (not just when the client loaded
  -- the page) to prevent two people double-booking the same slot. Every
  -- column reference here is table-aliased and qualified — `id`,
  -- `start_time`, `end_time`, and `status` are ALSO the names of this
  -- function's own RETURNS TABLE output parameters, which PL/pgSQL treats
  -- as in-scope variables, so any bare column reference matching one of
  -- those names is ambiguous (42702) rather than obviously the table column.
  select count(*) into v_conflict_count
  from (
    select b.start_time as conflict_start, b.end_time as conflict_end
    from bookings b
    where b.admin_id = p_admin_id
      and b.status in ('pending_confirmation', 'confirmed')
      and b.start_time < v_end_time and b.end_time > p_start_time
    union all
    select bs.start_time as conflict_start, bs.end_time as conflict_end
    from blocked_slots bs
    where bs.admin_id = p_admin_id
      and bs.start_time < v_end_time and bs.end_time > p_start_time
  ) conflicts;

  if v_conflict_count > 0 then
    raise exception 'That slot was just booked or blocked. Please pick another time.';
  end if;

  insert into bookings (
    admin_id, event_type_id, client_name, client_email, client_phone,
    custom_answers, start_time, end_time, client_timezone,
    status, payment_status
  ) values (
    p_admin_id, p_event_type_id, p_client_name, p_client_email, p_client_phone,
    coalesce(p_custom_answers, '{}'::jsonb), p_start_time, v_end_time, p_client_timezone,
    'pending_confirmation', v_payment_status
  )
  returning bookings.id into v_booking_id;

  return query
    select b.id, b.start_time, b.end_time, b.status
    from bookings b
    where b.id = v_booking_id;
end;
$$;

grant execute on function create_public_booking(uuid, uuid, text, text, text, jsonb, timestamptz, text) to anon, authenticated;
