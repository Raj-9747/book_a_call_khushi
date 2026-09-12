-- Zaptly — company branding on the MoM, and a PDF copy of it (Phase 12 cont.)
--
-- Two additions:
--   1. Optional company name + logo, set per-admin like every other public
--      profile field (headline, about, etc.) — shown on the MoM only when
--      an admin has actually filled them in.
--   2. mom_pdf_url on meeting_summaries — the generated PDF is now built
--      and uploaded from the n8n pipeline (Gotenberg + Supabase Storage),
--      not from fireflies-webhook, so this is just a column to hold the
--      result and a bucket for n8n to upload into.

-- ============================================================================
-- 1. Company name + logo
-- ============================================================================
alter table admins
  add column if not exists company_name text,
  add column if not exists company_logo_url text;

-- Same shape as the admin-photos bucket in 0009 — public read (the logo
-- appears on a document sent to clients), writes confined to the owning
-- admin's own folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'admin-logos',
  'admin-logos',
  true,
  2097152, -- 2 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "admin_logos_public_read" on storage.objects;
create policy "admin_logos_public_read"
  on storage.objects for select
  using (bucket_id = 'admin-logos');

drop policy if exists "admin_logos_own_folder_insert" on storage.objects;
create policy "admin_logos_own_folder_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'admin-logos'
    and (storage.foldername(name))[1] = current_admin_id()::text
  );

drop policy if exists "admin_logos_own_folder_update" on storage.objects;
create policy "admin_logos_own_folder_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'admin-logos'
    and (storage.foldername(name))[1] = current_admin_id()::text
  );

drop policy if exists "admin_logos_own_folder_delete" on storage.objects;
create policy "admin_logos_own_folder_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'admin-logos'
    and (storage.foldername(name))[1] = current_admin_id()::text
  );

-- ============================================================================
-- 2. mom_pdf_url + a bucket for n8n to upload the generated PDF into
-- ============================================================================
alter table meeting_summaries
  add column if not exists mom_pdf_url text;

-- Public read only — nobody writes here except the n8n pipeline, which
-- uses the service_role key and so bypasses these policies entirely (same
-- reasoning as every other n8n-writes-to-a-table case in this project).
-- No authenticated/anon write policy is needed or added.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'meeting-moms',
  'meeting-moms',
  true,
  10485760, -- 10 MB — generous for a text-only PDF, no reason to cap tighter
  array['application/pdf']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "meeting_moms_public_read" on storage.objects;
create policy "meeting_moms_public_read"
  on storage.objects for select
  using (bucket_id = 'meeting-moms');

-- ============================================================================
-- 3. get_booking_by_token — recreated to also return mom_pdf_url, so the
--    magic-link page can offer the PDF download alongside the text summary
--    already added in 0019.
-- ============================================================================
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
  mom_pdf_url text
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
    ms.short_summary, ms.action_items, ms.mom_pdf_url
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
