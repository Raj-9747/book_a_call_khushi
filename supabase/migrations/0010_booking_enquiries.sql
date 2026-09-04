-- Zaptly — booking enquiries
--
-- When an admin turns off "accepting bookings", the public profile and
-- event pages swap the slot picker for a short "let me know when you're
-- free" form. Those submissions land here, NOT in `bookings`: a booking
-- row with no start_time would break slot conflict math, Google Calendar
-- sync, and the reminder cron. Kept as its own table with its own
-- lifecycle instead.

create table if not exists booking_enquiries (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references admins (id) on delete cascade,
  -- Which session they were looking at, if they came from an event page
  -- rather than the profile page. Kept nullable and ON DELETE SET NULL so
  -- deleting an event type never destroys the lead.
  event_type_id uuid references event_types (id) on delete set null,
  name text not null,
  email text not null,
  phone text,
  message text,
  status text not null default 'new' check (status in ('new', 'contacted', 'closed')),
  created_at timestamptz not null default now()
);

create index if not exists booking_enquiries_admin_id_idx
  on booking_enquiries (admin_id, created_at desc);

alter table booking_enquiries enable row level security;

-- An admin sees and manages only their own enquiries. No INSERT policy for
-- authenticated users — rows only ever arrive through the SECURITY DEFINER
-- RPC below, which anonymous visitors call.
create policy "booking_enquiries_select_own"
  on booking_enquiries for select
  using (admin_id = current_admin_id());

create policy "booking_enquiries_update_own"
  on booking_enquiries for update
  using (admin_id = current_admin_id());

create policy "booking_enquiries_delete_own"
  on booking_enquiries for delete
  using (admin_id = current_admin_id());

-- ============================================================================
-- Public submission RPC
-- ============================================================================
-- Takes slugs rather than ids so an anonymous caller can't aim an enquiry
-- at an arbitrary admin_id, and validates the admin is real + active. Only
-- accepts submissions while the admin actually has bookings turned off —
-- otherwise the normal booking flow is what should have been used.
create or replace function create_booking_enquiry(
  p_admin_slug text,
  p_event_slug text,
  p_name text,
  p_email text,
  p_phone text,
  p_message text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin admins%rowtype;
  v_event_type_id uuid;
  v_enquiry_id uuid;
begin
  select * into v_admin from admins a where a.slug = p_admin_slug and a.is_active = true;
  if not found then
    raise exception 'This page is not available.';
  end if;

  if v_admin.accepting_bookings then
    raise exception 'This admin is accepting bookings — please book a slot instead.';
  end if;

  if coalesce(trim(p_name), '') = '' then
    raise exception 'Please enter your name.';
  end if;
  if coalesce(trim(p_email), '') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Please enter a valid email address.';
  end if;

  if p_event_slug is not null then
    select et.id into v_event_type_id
    from event_types et
    where et.admin_id = v_admin.id and et.slug = p_event_slug and et.is_active = true;
  end if;

  insert into booking_enquiries (admin_id, event_type_id, name, email, phone, message)
  values (
    v_admin.id,
    v_event_type_id,
    trim(p_name),
    lower(trim(p_email)),
    nullif(trim(coalesce(p_phone, '')), ''),
    nullif(trim(coalesce(p_message, '')), '')
  )
  returning id into v_enquiry_id;

  return v_enquiry_id;
end;
$$;

grant execute on function create_booking_enquiry(text, text, text, text, text, text) to anon, authenticated;

-- ============================================================================
-- Enforce the new booking settings server-side
-- ============================================================================
-- The public page already hides paused admins, slots inside the notice
-- window, and dates past the booking window — but all three of those are
-- presentation. This is the guard: a stale tab, a replayed request, or a
-- hand-crafted RPC call all get rejected here.
--
-- Output columns are unchanged, so CREATE OR REPLACE is fine (unlike the
-- return-type change in 0007/0009 that needed a DROP first).
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

  if not v_admin.accepting_bookings then
    raise exception 'This admin is not accepting bookings right now.';
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

  if p_start_time < now() + make_interval(mins => v_admin.min_notice_minutes) then
    raise exception 'That slot is too soon — please pick a later time.';
  end if;

  if p_start_time > now() + make_interval(days => v_admin.booking_window_days) then
    raise exception 'That date is too far out. Please pick an earlier slot.';
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
    -- 'confirmed' immediately, per 0005 — Calendar/Meet is best-effort and
    -- attached asynchronously by n8n afterwards.
    'confirmed', v_payment_status
  )
  returning bookings.id into v_booking_id;

  return query
    select b.id, b.start_time, b.end_time, b.status
    from bookings b
    where b.id = v_booking_id;
end;
$$;

grant execute on function create_public_booking(uuid, uuid, text, text, text, jsonb, timestamptz, text) to anon, authenticated;
