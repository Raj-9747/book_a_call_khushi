-- Zaptly — discount codes
--
-- Percent-only discounts an admin creates for their own sessions. A code
-- either applies to every event type they own, or to a hand-picked subset
-- (the join table below).
--
-- The public page can pre-check a code so the client sees the new price
-- before committing, but that check is advisory: `create_public_booking`
-- re-validates and re-prices from scratch at booking time. A code that
-- expires, is deactivated, or runs out of uses between those two moments
-- is rejected at the second one.

create table if not exists discount_codes (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references admins (id) on delete cascade,
  -- Stored as the admin typed it; matched case-insensitively via the
  -- unique index below, so "SAVE20" and "save20" can't both exist.
  code text not null check (char_length(trim(code)) between 3 and 32),
  percent integer not null check (percent between 1 and 100),
  -- null = never expires
  expires_at timestamptz,
  -- null = unlimited
  max_uses integer check (max_uses is null or max_uses > 0),
  times_used integer not null default 0,
  applies_to_all boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists discount_codes_admin_code_key
  on discount_codes (admin_id, upper(trim(code)));

-- Which event types a non-"applies_to_all" code covers.
create table if not exists discount_code_event_types (
  discount_code_id uuid not null references discount_codes (id) on delete cascade,
  event_type_id uuid not null references event_types (id) on delete cascade,
  primary key (discount_code_id, event_type_id)
);

alter table discount_codes enable row level security;
alter table discount_code_event_types enable row level security;

create policy "discount_codes_all_own"
  on discount_codes for all
  using (admin_id = current_admin_id())
  with check (admin_id = current_admin_id());

-- Scoped through the parent code's owner, so an admin can't attach their
-- code to somebody else's event type (or read who else uses one).
create policy "discount_code_event_types_all_own"
  on discount_code_event_types for all
  using (
    exists (
      select 1 from discount_codes dc
      where dc.id = discount_code_id and dc.admin_id = current_admin_id()
    )
  )
  with check (
    exists (
      select 1 from discount_codes dc
      where dc.id = discount_code_id and dc.admin_id = current_admin_id()
    )
    and exists (
      select 1 from event_types et
      where et.id = event_type_id and et.admin_id = current_admin_id()
    )
  );

-- ============================================================================
-- Booking price columns
-- ============================================================================
-- What the client was actually charged, and why. Recorded even on the
-- current dummy-payment path so the numbers are already right when
-- Razorpay replaces it.
alter table bookings
  add column if not exists base_amount numeric,
  add column if not exists discount_code_id uuid references discount_codes (id) on delete set null,
  add column if not exists discount_percent integer,
  add column if not exists amount_due numeric,
  add column if not exists currency text not null default 'INR';

-- ============================================================================
-- Advisory pre-check for the public page
-- ============================================================================
-- Read-only: never increments times_used. Returns a reason string the UI
-- can show verbatim rather than a bare boolean.
create or replace function validate_discount_code(
  p_admin_slug text,
  p_event_slug text,
  p_code text
)
returns table (valid boolean, percent integer, reason text)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_admin_id uuid;
  v_event_type_id uuid;
  v_code discount_codes%rowtype;
begin
  select a.id into v_admin_id from admins a where a.slug = p_admin_slug and a.is_active = true;
  if not found then
    return query select false, null::integer, 'This page is not available.';
    return;
  end if;

  select et.id into v_event_type_id
  from event_types et
  where et.admin_id = v_admin_id and et.slug = p_event_slug and et.is_active = true;
  if not found then
    return query select false, null::integer, 'This session is no longer available.';
    return;
  end if;

  select * into v_code
  from discount_codes dc
  where dc.admin_id = v_admin_id and upper(trim(dc.code)) = upper(trim(p_code));

  -- Every rejection below returns the same generic message on purpose: a
  -- specific one ("that code expired") confirms the code exists, which
  -- turns this into an oracle for guessing other people's codes.
  if not found
     or not v_code.is_active
     or (v_code.expires_at is not null and v_code.expires_at <= now())
     or (v_code.max_uses is not null and v_code.times_used >= v_code.max_uses)
     or not (
       v_code.applies_to_all
       or exists (
         select 1 from discount_code_event_types dcet
         where dcet.discount_code_id = v_code.id and dcet.event_type_id = v_event_type_id
       )
     )
  then
    return query select false, null::integer, 'That code isn''t valid for this session.';
    return;
  end if;

  return query select true, v_code.percent, null::text;
end;
$$;

grant execute on function validate_discount_code(text, text, text) to anon, authenticated;

-- ============================================================================
-- Booking creation — now prices the booking and redeems the code
-- ============================================================================
-- Adds an optional p_discount_code parameter. Because this changes the
-- signature it's a NEW function rather than a replacement; the old
-- 8-argument version is dropped so nothing can call the unpriced path.
drop function if exists create_public_booking(uuid, uuid, text, text, text, jsonb, timestamptz, text);

create or replace function create_public_booking(
  p_admin_id uuid,
  p_event_type_id uuid,
  p_client_name text,
  p_client_email text,
  p_client_phone text,
  p_custom_answers jsonb,
  p_start_time timestamptz,
  p_client_timezone text,
  p_discount_code text default null
)
returns table (id uuid, start_time timestamptz, end_time timestamptz, status text, amount_due numeric)
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
  v_code discount_codes%rowtype;
  v_discount_code_id uuid := null;
  v_discount_percent integer := null;
  v_base_amount numeric;
  v_amount_due numeric;
  v_redeemed integer;
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

  -- --------------------------------------------------------------------
  -- Pricing. The client never sends an amount — it's derived here from
  -- the event type's own price and, if a code is supplied, re-validated
  -- from scratch. Whatever the browser was showing is irrelevant.
  -- --------------------------------------------------------------------
  v_base_amount := coalesce(v_event_type.price, 0);
  v_amount_due := v_base_amount;

  if coalesce(trim(p_discount_code), '') <> '' and v_base_amount > 0 then
    select * into v_code
    from discount_codes dc
    where dc.admin_id = p_admin_id and upper(trim(dc.code)) = upper(trim(p_discount_code));

    if not found
       or not v_code.is_active
       or (v_code.expires_at is not null and v_code.expires_at <= now())
       or not (
         v_code.applies_to_all
         or exists (
           select 1 from discount_code_event_types dcet
           where dcet.discount_code_id = v_code.id and dcet.event_type_id = p_event_type_id
         )
       )
    then
      raise exception 'That discount code isn''t valid for this session.';
    end if;

    -- Redeem and bump the counter in ONE statement, with the limit in the
    -- WHERE clause. Two people racing for the last remaining use can't both
    -- succeed: the row lock serializes them and the loser matches no row.
    update discount_codes dc
    set times_used = dc.times_used + 1
    where dc.id = v_code.id
      and (dc.max_uses is null or dc.times_used < dc.max_uses);
    get diagnostics v_redeemed = row_count;

    if v_redeemed = 0 then
      raise exception 'That discount code has already been fully used.';
    end if;

    v_discount_code_id := v_code.id;
    v_discount_percent := v_code.percent;
    -- Rounded to whole rupees: Razorpay works in paise and a fractional
    -- rupee here would drift from the amount actually charged.
    v_amount_due := round(v_base_amount * (100 - v_code.percent) / 100.0);
  end if;

  v_payment_status := case when v_amount_due > 0 then 'paid_dummy' else 'free' end;

  -- Re-check for conflicts at insert time (not just when the client loaded
  -- the page) to prevent two people double-booking the same slot. Every
  -- column reference here is table-aliased and qualified — `id`,
  -- `start_time`, `end_time`, `status` and `amount_due` are ALSO the names
  -- of this function's own RETURNS TABLE output parameters, which PL/pgSQL
  -- treats as in-scope variables, so any bare column reference matching one
  -- of those names is ambiguous (42702) rather than obviously the column.
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
    -- Raising here rolls the whole function back, including the
    -- times_used increment above — the code isn't burned by a failed
    -- booking.
    raise exception 'That slot was just booked or blocked. Please pick another time.';
  end if;

  insert into bookings (
    admin_id, event_type_id, client_name, client_email, client_phone,
    custom_answers, start_time, end_time, client_timezone,
    status, payment_status,
    base_amount, discount_code_id, discount_percent, amount_due
  ) values (
    p_admin_id, p_event_type_id, p_client_name, p_client_email, p_client_phone,
    coalesce(p_custom_answers, '{}'::jsonb), p_start_time, v_end_time, p_client_timezone,
    -- 'confirmed' immediately, per 0005 — Calendar/Meet is best-effort and
    -- attached asynchronously by n8n afterwards.
    'confirmed', v_payment_status,
    v_base_amount, v_discount_code_id, v_discount_percent, v_amount_due
  )
  returning bookings.id into v_booking_id;

  return query
    select b.id, b.start_time, b.end_time, b.status, b.amount_due
    from bookings b
    where b.id = v_booking_id;
end;
$$;

grant execute on function create_public_booking(uuid, uuid, text, text, text, jsonb, timestamptz, text, text) to anon, authenticated;
