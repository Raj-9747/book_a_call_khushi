-- Zaptly — bound the abandoned-payment reminder window
--
-- Bug found in testing: get_abandoned_bookings only checked "expired more
-- than p_min_age_minutes ago" with no upper bound, so a booking that
-- expired days ago matched just as well as one that expired minutes ago —
-- on first activation this swept up the entire historical backlog of
-- expired test bookings and, combined with a separate n8n-side bug (see
-- abandoned-payment-cron.json), kept re-sending them every cron tick.
--
-- Adds a ceiling: only bookings that expired between p_min_age_minutes and
-- p_max_age_minutes ago are eligible. Past that window, reminding someone
-- about a checkout they abandoned days ago is stale and the copy itself
-- ("your slot has been released") stops making sense as a prompt.
--
-- Drop the old single-argument overload FIRST, not after — PostgREST
-- resolves { "p_min_age_minutes": 15 } against whichever function
-- signatures exist at call time, and briefly having both a 1-arg and
-- 2-arg get_abandoned_bookings live together (even mid-migration) risks
-- an ambiguous-function error rather than a clean cutover.
drop function if exists get_abandoned_bookings(integer);

create or replace function get_abandoned_bookings(
  p_min_age_minutes integer default 15,
  p_max_age_minutes integer default 120
)
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
    and b.updated_at >= now() - (p_max_age_minutes || ' minutes')::interval
    and not exists (
      select 1 from bookings b2
      where b2.client_email = b.client_email
        and b2.event_type_id = b.event_type_id
        and b2.status = 'confirmed'
        and b2.created_at > b.created_at
    );
end;
$$;

revoke all on function get_abandoned_bookings(integer, integer) from public, anon, authenticated;

-- n8n's existing call (body: { "p_min_age_minutes": 15 }) needs no change —
-- it resolves against this new signature with p_max_age_minutes defaulting
-- to 120.
