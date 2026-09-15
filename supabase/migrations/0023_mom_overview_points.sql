-- Zaptly — structured MoM overview + gist (Phase 12 cont.)
--
-- The MoM was reading as a single dense paragraph. Fireflies actually
-- returns two under-used fields that fix this without any LLM call:
--   - `gist` — a one-sentence TL;DR
--   - `overview` — already a bulleted, "**heading:** detail" markdown list
-- The n8n pipeline parses `overview`'s markdown into a real array of
-- {heading, text} objects ONCE, and every consumer (PDF, admin dashboard,
-- client magic-link page) renders that same structured data — instead of
-- three different places each re-parsing markdown independently.
--
-- Also fixes a real bug: `overview` was being computed in the n8n
-- pipeline's "ready yet?" check but never actually written to this table,
-- so meeting_summaries.overview has been silently empty on every row.

alter table meeting_summaries
  add column if not exists gist text,
  add column if not exists overview_points jsonb not null default '[]'::jsonb;

-- get_booking_by_token — recreated to also return the client's copy of
-- these two fields, so the magic-link page's MoM matches what's in the PDF
-- (same structure that was already the client-safe subset: short_summary,
-- action_items, and now gist + overview_points join that set — still never
-- the raw `overview` text or the transcript link, per the existing
-- "MoM content split" in PLAN.md §11.2).
drop function if exists get_booking_by_token(uuid);

create function get_booking_by_token(p_token uuid)
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
  admin_id uuid,
  admin_name text,
  admin_slug text,
  admin_photo_url text,
  admin_headline text,
  admin_weekly_availability jsonb,
  admin_google_calendar_connected boolean,
  admin_min_notice_minutes integer,
  admin_booking_window_days integer,
  event_type_id uuid,
  event_name text,
  event_description text,
  duration_minutes integer,
  request_id uuid,
  request_type text,
  request_status text,
  request_preferred_start timestamptz,
  mom_short_summary text,
  mom_action_items jsonb,
  mom_pdf_url text,
  mom_gist text,
  mom_overview_points jsonb
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
    a.id, a.name, a.slug, a.photo_url, a.headline,
    a.weekly_availability, a.google_calendar_connected,
    a.min_notice_minutes, a.booking_window_days,
    et.id, et.name, et.description, et.duration_minutes,
    r.id, r.type, r.status, r.preferred_start_time,
    ms.short_summary, ms.action_items, ms.mom_pdf_url, ms.gist, ms.overview_points
  from bookings b
  join admins a on a.id = b.admin_id
  join event_types et on et.id = b.event_type_id
  left join lateral (
    select id, type, status, preferred_start_time
    from booking_change_requests
    where booking_id = b.id
    order by created_at desc
    limit 1
  ) r on true
  left join meeting_summaries ms on ms.booking_id = b.id
  where b.manage_token = p_token
    and b.status <> 'pending_payment'
    and b.end_time > now() - interval '24 hours';
$$;

grant execute on function get_booking_by_token(uuid) to anon, authenticated;
