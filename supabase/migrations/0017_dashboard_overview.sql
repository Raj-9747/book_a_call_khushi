-- Zaptly — dashboard overview aggregates
--
-- One RPC instead of the four client-side count queries the overview used
-- to fire. Two reasons beyond the round-trip saving:
--   1. Revenue is a SUM across all bookings ever. Doing that in JS means
--      shipping every booking row to the browser and adding it up there —
--      fine at 20 bookings, ruinous at 5,000. Postgres sums it in place.
--   2. "Top event types" needs a GROUP BY + ORDER BY + LIMIT, which
--      PostgREST can't express cleanly from the client.
--
-- Takes no admin_id parameter on purpose. It's SECURITY DEFINER (so it can
-- aggregate across rows), which means RLS does NOT apply inside it — an
-- admin_id argument would be trivially spoofable into reading another
-- admin's revenue. Deriving the id from `current_admin_id()` leaves nothing
-- to tamper with.
create or replace function get_dashboard_overview()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_tz constant text := 'Asia/Kolkata';
  v_admin_id uuid := current_admin_id();
  v_today_start timestamptz;
  v_today_end timestamptz;
  v_month_start timestamptz;
  v_last_month_start timestamptz;
  v_earnings jsonb;
  v_today jsonb;
  v_actions jsonb;
  v_top_events jsonb;
  v_counts jsonb;
begin
  -- Also covers deactivated admins: current_admin_id() returns null for
  -- them since migration 0014.
  if v_admin_id is null then
    raise exception 'Not authorised.';
  end if;

  -- Day and month boundaries in IST, matching how the admin reads every
  -- other date in the product.
  v_today_start := date_trunc('day', now() at time zone v_tz) at time zone v_tz;
  v_today_end := v_today_start + interval '1 day';
  v_month_start := date_trunc('month', now() at time zone v_tz) at time zone v_tz;
  v_last_month_start := (date_trunc('month', now() at time zone v_tz) - interval '1 month') at time zone v_tz;

  -- Revenue is NET: what was actually collected, minus anything refunded.
  -- Attributed to `created_at` (when the payment was taken), not
  -- `start_time` — money received this month for a call next month is this
  -- month's revenue.
  select jsonb_build_object(
    'this_month', coalesce(sum(net) filter (where b.created_at >= v_month_start), 0),
    'last_month', coalesce(sum(net) filter (
      where b.created_at >= v_last_month_start and b.created_at < v_month_start
    ), 0),
    'all_time', coalesce(sum(net), 0)
  )
  into v_earnings
  from (
    select b.created_at, coalesce(b.amount_paid, 0) - coalesce(b.refund_amount, 0) as net
    from bookings b
    where b.admin_id = v_admin_id and b.amount_paid is not null
  ) b;

  -- Today's confirmed calls, earliest first.
  select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
  into v_today
  from (
    select b.id, b.client_name, b.start_time, b.end_time, b.meet_link, et.name as event_name
    from bookings b
    join event_types et on et.id = b.event_type_id
    where b.admin_id = v_admin_id
      and b.status = 'confirmed'
      and b.start_time >= v_today_start
      and b.start_time < v_today_end
    order by b.start_time
  ) t;

  -- The three things that actually need the admin to do something.
  select jsonb_build_object(
    'pending_requests', (
      select count(*) from booking_change_requests r
      join bookings b on b.id = r.booking_id
      where b.admin_id = v_admin_id and r.status = 'pending'
    ),
    'new_enquiries', (
      select count(*) from booking_enquiries e
      where e.admin_id = v_admin_id and e.status = 'new'
    ),
    -- Live payment holds only — a lapsed one is nobody's problem.
    'awaiting_payment', (
      select count(*) from bookings b
      where b.admin_id = v_admin_id
        and b.status = 'pending_payment'
        and b.hold_expires_at > now()
    )
  )
  into v_actions;

  -- Which sessions actually earn. Ordered by volume, since that's what an
  -- admin scans for first; revenue rides along for the pricing decision.
  select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
  into v_top_events
  from (
    select
      et.name,
      count(*) as bookings,
      coalesce(sum(coalesce(b.amount_paid, 0) - coalesce(b.refund_amount, 0)), 0) as revenue
    from bookings b
    join event_types et on et.id = b.event_type_id
    where b.admin_id = v_admin_id and b.status in ('confirmed', 'completed')
    group by et.id, et.name
    order by count(*) desc, et.name
    limit 5
  ) t;

  select jsonb_build_object(
    'upcoming', (
      select count(*) from bookings b
      where b.admin_id = v_admin_id and b.status = 'confirmed' and b.start_time >= now()
    ),
    'today', jsonb_array_length(v_today),
    'total', (select count(*) from bookings b where b.admin_id = v_admin_id)
  )
  into v_counts;

  return jsonb_build_object(
    'earnings', v_earnings,
    'today', v_today,
    'actions', v_actions,
    'top_event_types', v_top_events,
    'counts', v_counts
  );
end;
$$;

grant execute on function get_dashboard_overview() to authenticated;
