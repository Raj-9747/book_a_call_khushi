-- Zaptly — payment totals for the Payments page
--
-- The transaction list itself is a plain paginated table query, but the
-- "collected / refunded / net" strip has to sum across EVERY matching row,
-- not just the visible page. Doing that client-side would mean fetching all
-- of them purely to add three numbers up.
--
-- Same guard as get_dashboard_overview: SECURITY DEFINER (so it can
-- aggregate) with the admin derived from the session rather than passed in,
-- because an admin_id argument on a definer function is a free read of
-- anyone else's revenue.
create or replace function get_payment_summary(
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_admin_id uuid := current_admin_id();
  v_result jsonb;
begin
  if v_admin_id is null then
    raise exception 'Not authorised.';
  end if;

  select jsonb_build_object(
    'collected', coalesce(sum(coalesce(b.amount_paid, 0)), 0),
    'refunded', coalesce(sum(coalesce(b.refund_amount, 0)), 0),
    'net', coalesce(sum(coalesce(b.amount_paid, 0) - coalesce(b.refund_amount, 0)), 0),
    'transactions', count(*)
  )
  into v_result
  from bookings b
  where b.admin_id = v_admin_id
    -- Only rows where money actually moved. Free bookings aren't
    -- transactions and would drag the count away from what the list shows.
    and b.amount_paid is not null
    and (p_from is null or b.created_at >= p_from)
    and (p_to is null or b.created_at < p_to);

  return v_result;
end;
$$;

grant execute on function get_payment_summary(timestamptz, timestamptz) to authenticated;
