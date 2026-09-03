-- Zaptly — bookings are confirmed immediately, calendar/Meet is best-effort
--
-- Decision: a booking is 'confirmed' the moment it's created, regardless of
-- whether the admin has connected Google Calendar. If they have, n8n
-- attaches a Meet link asynchronously afterward; if not, the booking still
-- stands and the admin arranges the call manually. This also means
-- reminders (which only fire for 'confirmed' bookings) work for every
-- admin, not just ones with Calendar connected.

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
    'confirmed', v_payment_status
  )
  returning bookings.id into v_booking_id;

  return query
    select b.id, b.start_time, b.end_time, b.status
    from bookings b
    where b.id = v_booking_id;
end;
$$;
