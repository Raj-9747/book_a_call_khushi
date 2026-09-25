-- Zaptly — refund ledger
--
-- Until now a refund was only ever a number on the booking (refund_amount)
-- plus a status the webhook flipped. Razorpay's own refund id was thrown
-- away, so the dashboard could show "refunded" with nothing to look up on
-- Razorpay's side, and a second partial refund overwrote the first.
--
-- One row per refund actually created on Razorpay. The function inserts it
-- with the id/status Razorpay returned; the webhook settles it. The booking's
-- refund_amount becomes the sum of PROCESSED rows only, so the totals on the
-- Payments page/overview no longer count money Razorpay hasn't confirmed.

create table if not exists booking_refunds (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  razorpay_refund_id text not null unique,
  razorpay_payment_id text not null,
  amount numeric not null check (amount > 0),
  -- 'pending' (Razorpay accepted it, bank not settled) | 'processed' | 'failed'
  status text not null default 'pending' check (status in ('pending', 'processed', 'failed')),
  reason text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists booking_refunds_booking_id_idx on booking_refunds (booking_id);

alter table booking_refunds enable row level security;

drop policy if exists "Admins read own booking refunds" on booking_refunds;
create policy "Admins read own booking refunds"
  on booking_refunds for select
  using (exists (select 1 from bookings b where b.id = booking_refunds.booking_id and b.admin_id = auth.uid()));

-- Writes come only from Edge Functions (service role), so no insert/update policy.

-- Recomputes a booking's refund fields from its ledger. Called by the
-- functions after every ledger change so the logic lives in one place.
create or replace function sync_booking_refund(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_processed numeric;
  v_pending numeric;
  v_failed_latest boolean;
  v_paid numeric;
  v_last timestamptz;
begin
  select coalesce(sum(amount) filter (where status = 'processed'), 0),
         coalesce(sum(amount) filter (where status = 'pending'), 0),
         max(processed_at)
    into v_processed, v_pending, v_last
    from booking_refunds where booking_id = p_booking_id;

  select coalesce(amount_paid, 0) into v_paid from bookings where id = p_booking_id;

  select exists (
    select 1 from booking_refunds
    where booking_id = p_booking_id and status = 'failed'
      and created_at = (select max(created_at) from booking_refunds where booking_id = p_booking_id)
  ) into v_failed_latest;

  update bookings set
    refund_amount = nullif(v_processed, 0),
    refund_status = case
      when v_pending > 0 then 'processing'
      when v_failed_latest then 'failed'
      when v_processed > 0 then 'processed'
      else null end,
    refunded_at = v_last,
    payment_status = case
      when v_processed > 0 and v_processed >= v_paid and v_paid > 0 then 'refunded'
      when v_processed > 0 then 'partially_refunded'
      else payment_status end
  where id = p_booking_id;
end;
$$;

revoke all on function sync_booking_refund(uuid) from public, anon, authenticated;

-- Backfill: refunds recorded before this ledger existed have no Razorpay id.
-- They're carried over (so totals don't change or vanish) but flagged in
-- `reason` so they can be checked against Razorpay by payment id.
insert into booking_refunds (booking_id, razorpay_refund_id, razorpay_payment_id, amount, status, reason, processed_at)
select b.id, 'legacy-' || b.id, coalesce(b.razorpay_payment_id, ''), b.refund_amount,
       case when b.refund_status = 'processed' then 'processed' else 'pending' end,
       'Recorded before refund tracking — verify on Razorpay',
       b.refunded_at
from bookings b
where b.refund_amount is not null and b.refund_amount > 0
on conflict (razorpay_refund_id) do nothing;
