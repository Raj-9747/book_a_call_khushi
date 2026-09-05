-- Zaptly — Razorpay payments + booking magic links
--
-- Replaces the dummy payment path. Paid bookings are now created as
-- 'pending_payment' holding the slot for a short window, and only become
-- 'confirmed' once a payment is verified server-side (browser callback
-- signature, or the Razorpay webhook — whichever lands first).
--
-- Every amount is derived in the database from the event type's own price.
-- Nothing the browser sends is trusted, and `create_booking_priced` below
-- is revoked from anon entirely: the public page reaches it only through
-- the `create-booking` Edge Function, which holds the Razorpay secret.

-- ============================================================================
-- 1. New booking columns
-- ============================================================================
alter table bookings
  -- The magic link. Random UUID, unique, handed to the client only after
  -- the booking is actually confirmed.
  add column if not exists manage_token uuid not null default gen_random_uuid(),
  add column if not exists amount_paid numeric,
  add column if not exists razorpay_order_id text,
  add column if not exists razorpay_payment_id text,
  -- When an unpaid hold lapses and the slot is released.
  add column if not exists hold_expires_at timestamptz,
  -- Guards against the confirmation email going out twice (the DB webhook
  -- now fires on UPDATE as well as INSERT).
  add column if not exists confirmation_sent boolean not null default false,
  add column if not exists cancelled_by text,
  add column if not exists refund_amount numeric,
  add column if not exists refund_status text,
  add column if not exists refunded_at timestamptz;

create unique index if not exists bookings_manage_token_key on bookings (manage_token);
create index if not exists bookings_razorpay_order_id_idx on bookings (razorpay_order_id);
create index if not exists bookings_razorpay_payment_id_idx on bookings (razorpay_payment_id);
-- Used by the hold-expiry sweep.
create index if not exists bookings_pending_hold_idx
  on bookings (hold_expires_at)
  where status = 'pending_payment';

-- ============================================================================
-- 2. Status + payment_status vocabularies
-- ============================================================================
alter table bookings drop constraint if exists bookings_status_check;
alter table bookings add constraint bookings_status_check
  check (status in ('pending_confirmation', 'pending_payment', 'confirmed', 'cancelled', 'completed', 'expired'));

-- Order matters here. Existing rows were written under the dummy-payment
-- vocabulary and have to be folded into the new one, but 'paid' isn't a
-- legal value under the OLD constraint and 'paid_dummy' isn't legal under
-- the NEW one — so the only window in which the update can run is with
-- neither constraint attached. Drop, migrate the data, then re-add.
alter table bookings drop constraint if exists bookings_payment_status_check;

update bookings set payment_status = 'paid' where payment_status = 'paid_dummy';

alter table bookings add constraint bookings_payment_status_check
  check (payment_status in ('free', 'pending', 'paid', 'failed', 'refunded', 'partially_refunded'));

alter table bookings drop constraint if exists bookings_cancelled_by_check;
alter table bookings add constraint bookings_cancelled_by_check
  check (cancelled_by is null or cancelled_by in ('admin', 'client_request'));

-- Backfill: everything that existed before this migration was confirmed
-- and already notified, so it must not re-trigger a confirmation email
-- when the DB webhook starts firing on UPDATE.
update bookings set confirmation_sent = true where confirmation_sent = false;

-- ============================================================================
-- 3. An unpaid hold occupies the slot — but only while it's still live
-- ============================================================================
-- A lapsed hold whose sweep hasn't run yet must NOT keep blocking the
-- slot, so the freshness check is inline rather than relying on the cron
-- having already flipped the status.
create or replace function get_busy_ranges(p_admin_id uuid, p_from timestamptz, p_to timestamptz)
returns table (start_time timestamptz, end_time timestamptz)
language sql
security definer
set search_path = public
stable
as $$
  select b.start_time, b.end_time
  from bookings b
  where b.admin_id = p_admin_id
    and (
      b.status in ('pending_confirmation', 'confirmed')
      or (b.status = 'pending_payment' and b.hold_expires_at > now())
    )
    and b.start_time < p_to
    and b.end_time > p_from
  union all
  select bs.start_time, bs.end_time
  from blocked_slots bs
  where bs.admin_id = p_admin_id
    and bs.start_time < p_to
    and bs.end_time > p_from;
$$;

grant execute on function get_busy_ranges(uuid, timestamptz, timestamptz) to anon, authenticated;

-- ============================================================================
-- 4. Booking creation, service-role only
-- ============================================================================
-- The anon-callable version is dropped: a public caller must not be able
-- to mint a booking without going through the Edge Function that creates
-- the matching Razorpay order.
drop function if exists create_public_booking(uuid, uuid, text, text, text, jsonb, timestamptz, text, text);

create or replace function create_booking_priced(
  p_admin_slug text,
  p_event_slug text,
  p_client_name text,
  p_client_email text,
  p_client_phone text,
  p_custom_answers jsonb,
  p_start_time timestamptz,
  p_client_timezone text,
  p_discount_code text default null,
  p_hold_minutes integer default 10
)
returns table (
  id uuid,
  start_time timestamptz,
  end_time timestamptz,
  status text,
  amount_due numeric,
  manage_token uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_type event_types%rowtype;
  v_admin admins%rowtype;
  v_end_time timestamptz;
  v_status text;
  v_payment_status text;
  v_hold_expires_at timestamptz;
  v_conflict_count integer;
  v_booking_id uuid;
  v_code discount_codes%rowtype;
  v_discount_code_id uuid := null;
  v_discount_percent integer := null;
  v_base_amount numeric;
  v_amount_due numeric;
  v_redeemed integer;
begin
  -- Slugs, not ids: the caller identifies the target the same way the
  -- public URL does, so it can't aim a booking at an arbitrary row.
  select * into v_admin from admins a where a.slug = p_admin_slug and a.is_active = true;
  if not found then
    raise exception 'This booking page is not available.';
  end if;

  if not v_admin.accepting_bookings then
    raise exception 'This admin is not accepting bookings right now.';
  end if;

  select * into v_event_type
  from event_types et
  where et.admin_id = v_admin.id and et.slug = p_event_slug and et.is_active = true;
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
  -- Pricing. Derived here from the event type's own price; the caller
  -- never supplies an amount.
  -- --------------------------------------------------------------------
  v_base_amount := coalesce(v_event_type.price, 0);
  v_amount_due := v_base_amount;

  if coalesce(trim(p_discount_code), '') <> '' and v_base_amount > 0 then
    select * into v_code
    from discount_codes dc
    where dc.admin_id = v_admin.id and upper(trim(dc.code)) = upper(trim(p_discount_code));

    if not found
       or not v_code.is_active
       or (v_code.expires_at is not null and v_code.expires_at <= now())
       or not (
         v_code.applies_to_all
         or exists (
           select 1 from discount_code_event_types dcet
           where dcet.discount_code_id = v_code.id and dcet.event_type_id = v_event_type.id
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
    -- Rounded to whole rupees: Razorpay charges in paise, and a fractional
    -- rupee here would drift from the amount actually collected.
    v_amount_due := round(v_base_amount * (100 - v_code.percent) / 100.0);
  end if;

  -- A booking that costs nothing (free session, or a 100% code) skips
  -- payment entirely and is confirmed on the spot.
  if v_amount_due > 0 then
    v_status := 'pending_payment';
    v_payment_status := 'pending';
    v_hold_expires_at := now() + make_interval(mins => greatest(p_hold_minutes, 1));
  else
    v_status := 'confirmed';
    v_payment_status := 'free';
    v_hold_expires_at := null;
  end if;

  -- Re-check for conflicts at insert time (not just when the client loaded
  -- the page) to prevent two people double-booking the same slot. Every
  -- column reference here is table-aliased and qualified — `id`,
  -- `start_time`, `end_time`, `status`, `amount_due` and `manage_token` are
  -- ALSO the names of this function's own RETURNS TABLE output parameters,
  -- which PL/pgSQL treats as in-scope variables, so any bare column
  -- reference matching one of those names is ambiguous (42702) rather than
  -- obviously the table column.
  select count(*) into v_conflict_count
  from (
    select b.start_time as conflict_start, b.end_time as conflict_end
    from bookings b
    where b.admin_id = v_admin.id
      and (
        b.status in ('pending_confirmation', 'confirmed')
        or (b.status = 'pending_payment' and b.hold_expires_at > now())
      )
      and b.start_time < v_end_time and b.end_time > p_start_time
    union all
    select bs.start_time as conflict_start, bs.end_time as conflict_end
    from blocked_slots bs
    where bs.admin_id = v_admin.id
      and bs.start_time < v_end_time and bs.end_time > p_start_time
  ) conflicts;

  if v_conflict_count > 0 then
    -- Raising rolls the whole function back, including the times_used
    -- increment above — a failed booking doesn't burn the discount code.
    raise exception 'That slot was just booked or blocked. Please pick another time.';
  end if;

  insert into bookings (
    admin_id, event_type_id, client_name, client_email, client_phone,
    custom_answers, start_time, end_time, client_timezone,
    status, payment_status, hold_expires_at,
    base_amount, discount_code_id, discount_percent, amount_due
  ) values (
    v_admin.id, v_event_type.id, p_client_name, p_client_email, p_client_phone,
    coalesce(p_custom_answers, '{}'::jsonb), p_start_time, v_end_time, p_client_timezone,
    v_status, v_payment_status, v_hold_expires_at,
    v_base_amount, v_discount_code_id, v_discount_percent, v_amount_due
  )
  returning bookings.id into v_booking_id;

  return query
    select b.id, b.start_time, b.end_time, b.status, b.amount_due, b.manage_token
    from bookings b
    where b.id = v_booking_id;
end;
$$;

-- service_role only. Deliberately NOT granted to anon or authenticated.
revoke all on function create_booking_priced(text, text, text, text, text, jsonb, timestamptz, text, text, integer) from public, anon, authenticated;

-- ============================================================================
-- 5. Confirming a payment
-- ============================================================================
-- Idempotent by design: the browser callback and the Razorpay webhook both
-- call this, in either order, sometimes more than once. The WHERE clause
-- only matches a booking still awaiting payment, so every call after the
-- first is a no-op that still reports success.
--
-- Re-checks the slot before confirming: a hold can lapse while Razorpay is
-- capturing, and someone else may have taken the slot in between. Rather
-- than double-book, such a booking is confirmed but flagged for the admin
-- to refund — the money is already taken, so silently failing would be
-- worse than an explicit conflict to resolve.
create or replace function confirm_booking_payment(
  p_booking_id uuid,
  p_razorpay_order_id text,
  p_razorpay_payment_id text,
  p_amount_paid numeric
)
returns table (id uuid, status text, manage_token uuid, already_confirmed boolean, slot_conflict boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking bookings%rowtype;
  v_conflict_count integer;
begin
  select * into v_booking from bookings b where b.id = p_booking_id;
  if not found then
    raise exception 'Booking not found.';
  end if;

  if v_booking.status <> 'pending_payment' then
    -- Already handled (or cancelled). Report the current state rather than
    -- erroring — a duplicate webhook delivery is normal, not a failure.
    return query select v_booking.id, v_booking.status, v_booking.manage_token, true, false;
    return;
  end if;

  select count(*) into v_conflict_count
  from (
    select 1
    from bookings b
    where b.admin_id = v_booking.admin_id
      and b.id <> v_booking.id
      and (
        b.status in ('pending_confirmation', 'confirmed')
        or (b.status = 'pending_payment' and b.hold_expires_at > now())
      )
      and b.start_time < v_booking.end_time and b.end_time > v_booking.start_time
    union all
    select 1
    from blocked_slots bs
    where bs.admin_id = v_booking.admin_id
      and bs.start_time < v_booking.end_time and bs.end_time > v_booking.start_time
  ) conflicts;

  update bookings b
  set status = 'confirmed',
      payment_status = 'paid',
      razorpay_order_id = coalesce(p_razorpay_order_id, b.razorpay_order_id),
      razorpay_payment_id = p_razorpay_payment_id,
      amount_paid = p_amount_paid,
      hold_expires_at = null,
      -- Surfaced to the admin as a booking needing attention: paid for, but
      -- the slot was taken while payment was in flight.
      notes = case
        when v_conflict_count > 0
        then coalesce(b.notes || E'\n\n', '') ||
             '[Zaptly] Payment captured after this slot was taken by another booking. Needs rescheduling or a refund.'
        else b.notes
      end
  where b.id = p_booking_id;

  return query
    select b.id, b.status, b.manage_token, false, v_conflict_count > 0
    from bookings b
    where b.id = p_booking_id;
end;
$$;

revoke all on function confirm_booking_payment(uuid, text, text, numeric) from public, anon, authenticated;

-- ============================================================================
-- 6. Failed payments and lapsed holds
-- ============================================================================
create or replace function fail_booking_payment(p_booking_id uuid, p_razorpay_payment_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Stays 'pending_payment' so the client can retry within the hold
  -- window; only the payment_status records the failure.
  update bookings b
  set payment_status = 'failed',
      razorpay_payment_id = coalesce(p_razorpay_payment_id, b.razorpay_payment_id)
  where b.id = p_booking_id and b.status = 'pending_payment';
end;
$$;

revoke all on function fail_booking_payment(uuid, text) from public, anon, authenticated;

-- Releases holds nobody completed. Refunds the discount-code use too, so
-- an abandoned checkout doesn't quietly consume a limited code.
create or replace function expire_pending_bookings()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expired integer;
begin
  -- Both CTEs are data-modifying, so Postgres runs each exactly once and
  -- to completion regardless of whether the outer query reads it — which
  -- is why `refunded` works without being selected from. Counting via
  -- `select count(*) from released` rather than GET DIAGNOSTICS, since the
  -- latter would report the discount update's row count, not the bookings'.
  with released as (
    update bookings b
    set status = 'expired', hold_expires_at = null
    where b.status = 'pending_payment' and b.hold_expires_at is not null and b.hold_expires_at <= now()
    returning b.discount_code_id
  ),
  refunded as (
    update discount_codes dc
    set times_used = greatest(dc.times_used - sub.uses, 0)
    from (
      select r.discount_code_id, count(*) as uses
      from released r
      where r.discount_code_id is not null
      group by r.discount_code_id
    ) sub
    where dc.id = sub.discount_code_id
    returning dc.id
  )
  select count(*) into v_expired from released;

  return v_expired;
end;
$$;

revoke all on function expire_pending_bookings() from public, anon, authenticated;

-- ============================================================================
-- 7. Magic link lookup
-- ============================================================================
-- Reachable by anyone holding the token, which is a random UUID handed out
-- only after confirmation. Returns the booking plus the admin/event
-- context the page needs — and nothing about any other booking.
create or replace function get_booking_by_token(p_token uuid)
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
  admin_name text,
  admin_slug text,
  admin_photo_url text,
  admin_headline text,
  event_name text,
  event_description text,
  duration_minutes integer
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
    a.name, a.slug, a.photo_url, a.headline,
    et.name, et.description, et.duration_minutes
  from bookings b
  join admins a on a.id = b.admin_id
  join event_types et on et.id = b.event_type_id
  where b.manage_token = p_token
    -- Unpaid holds have no magic link yet, and the page stops resolving a
    -- full day after the call ends.
    and b.status <> 'pending_payment'
    and b.end_time > now() - interval '24 hours';
$$;

grant execute on function get_booking_by_token(uuid) to anon, authenticated;
