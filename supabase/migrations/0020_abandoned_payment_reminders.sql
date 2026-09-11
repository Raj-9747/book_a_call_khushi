-- Zaptly — abandoned-payment reminders (Phase 12, §11.3, §11.5)
--
-- `expire_pending_bookings()` (0012) already flips a lapsed hold's status
-- to 'expired' every 5 minutes. This adds a one-time WhatsApp+email nudge
-- for those bookings, called from a new n8n cron — it does not touch the
-- expiry sweep itself.

alter table bookings
  add column if not exists abandoned_reminder_sent boolean not null default false;

-- Matches only 'expired' rows, which is a small and shrinking slice of the
-- table — cheaper than an index over every status.
create index if not exists bookings_abandoned_reminder_idx
  on bookings (status, abandoned_reminder_sent)
  where status = 'expired';

-- ============================================================================
-- get_abandoned_bookings — service-role only, called from n8n's
-- abandoned-payment-cron. Returns expired, unreminded, unpaid bookings
-- older than p_min_age_minutes, pre-joined and pre-split so no n8n
-- expression has to reach into admins/event_types or parse E.164 itself.
--
-- Revoked from anon/authenticated like create_booking_priced and
-- expire_pending_bookings: this reads across every admin's bookings, which
-- would be a cross-admin data leak if any logged-in admin could call it.
-- ============================================================================
create or replace function get_abandoned_bookings(p_min_age_minutes integer default 15)
returns table (
  booking_id uuid,
  client_name text,
  client_email text,
  client_phone_country_code text,
  client_phone_national text,
  admin_name text,
  admin_slug text,
  event_type_name text,
  event_type_slug text,
  start_time_ist text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    b.id,
    b.client_name,
    b.client_email,
    -- Longest-prefix split against the same dial-code list as
    -- supabase/functions/_shared/phoneSplit.ts (Deno can't import this SQL
    -- function, so both must be kept in sync by hand): tries each known
    -- code as a prefix of the number right after '+', longest first, so
    -- e.g. "+1..." can't be mis-split by a shorter code that happens to
    -- also match.
    split.country_code,
    split.national,
    a.name,
    a.slug,
    et.name,
    et.slug,
    to_char(b.start_time at time zone 'Asia/Kolkata', 'DD Mon YYYY, HH12:MI AM')
  from bookings b
  join admins a on a.id = b.admin_id
  join event_types et on et.id = b.event_type_id
  -- LEFT, not CROSS: a booking with no phone, or one whose number matches
  -- no known dial code, must still come back (with the two split columns
  -- null) so it still gets the email side of the reminder — n8n gates the
  -- WhatsApp send on these being non-null and sends email regardless.
  left join lateral (
    select
      code as country_code,
      substring(b.client_phone from length(code) + 2) as national
    from unnest(array[
      '91','1','44','61','65','971','966','49','33','31','353','64',
      '27','60','62','63','81','82','86','852','55','52','34','39',
      '41','46','47','45','48','90','20','234','254','880','94','977'
    ]) as code
    where b.client_phone like '+' || code || '%'
    order by length(code) desc
    limit 1
  ) split on true
  where b.status = 'expired'
    and b.abandoned_reminder_sent = false
    and b.updated_at <= now() - (p_min_age_minutes || ' minutes')::interval
    -- Suppression: don't nudge someone who already retried and succeeded.
    -- "Succeeded" means a confirmed booking for the same email + event
    -- type, created after this expired attempt.
    and not exists (
      select 1 from bookings b2
      where b2.client_email = b.client_email
        and b2.event_type_id = b.event_type_id
        and b2.status = 'confirmed'
        and b2.created_at > b.created_at
    );
end;
$$;

revoke all on function get_abandoned_bookings(integer) from public, anon, authenticated;

-- ============================================================================
-- mark_abandoned_reminder_sent — same access pattern. Separate from the
-- select above (rather than doing it inline in n8n via PostgREST) so the
-- "already sent" guard lives in one place instead of being re-implemented
-- per caller.
-- ============================================================================
create or replace function mark_abandoned_reminder_sent(p_booking_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update bookings set abandoned_reminder_sent = true where id = p_booking_id;
$$;

revoke all on function mark_abandoned_reminder_sent(uuid) from public, anon, authenticated;
