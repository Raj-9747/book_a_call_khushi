-- Zaptly — expose google_calendar_connected on the public admin lookup
--
-- Needed so the public booking page knows whether to bother calling the
-- Google FreeBusy check at all — no point calling it for an admin who
-- hasn't connected Calendar. Not sensitive: it's just a boolean, and the
-- admin's own row is already publicly reachable via their booking slug.

-- Postgres won't let CREATE OR REPLACE change a function's output columns
-- (adding google_calendar_connected counts as a row-type change) — the old
-- version must be dropped first.
drop function if exists get_public_admin(text);

create function get_public_admin(p_slug text)
returns table (id uuid, name text, slug text, timezone text, weekly_availability jsonb, google_calendar_connected boolean)
language sql
security definer
set search_path = public
stable
as $$
  select id, name, slug, timezone, weekly_availability, google_calendar_connected
  from admins
  where slug = p_slug and is_active = true;
$$;

grant execute on function get_public_admin(text) to anon, authenticated;
