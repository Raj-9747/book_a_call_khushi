-- Zaptly — public admin profile fields, photo storage, booking toggle,
-- and the booking-window/notice settings that were previously hardcoded.
--
-- Backs the new public profile page at /book/<admin-slug> and the renamed
-- dashboard Profile page. Every profile field is optional: the public page
-- renders each one only when the admin has actually filled it in.

-- ============================================================================
-- 1. New admin columns
-- ============================================================================
alter table admins
  add column if not exists photo_url text,
  add column if not exists headline text,
  add column if not exists about text,
  add column if not exists linkedin_url text,
  add column if not exists instagram_url text,
  -- When false, the public profile + event pages show an "unavailable"
  -- state with a limited enquiry form instead of the slot picker.
  add column if not exists accepting_bookings boolean not null default true,
  add column if not exists unavailable_message text,
  -- Previously hardcoded in the frontend. Minimum notice also closes the
  -- gap where a booking made <55 min out never fell into the reminder
  -- cron's 55–65 minute catch window.
  add column if not exists min_notice_minutes integer not null default 60,
  add column if not exists booking_window_days integer not null default 14;

-- ADD CONSTRAINT has no IF NOT EXISTS, so guard it to keep this file
-- safely re-runnable.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'admins_min_notice_minutes_check') then
    alter table admins add constraint admins_min_notice_minutes_check
      check (min_notice_minutes between 0 and 10080);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'admins_booking_window_days_check') then
    alter table admins add constraint admins_booking_window_days_check
      check (booking_window_days between 1 and 365);
  end if;
end $$;

-- ============================================================================
-- 2. Storage bucket for profile photos
-- ============================================================================
-- Public read (the photo is shown on an anonymous booking page), writes
-- restricted to the owning admin's own folder: <admin_id>/<filename>.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'admin-photos',
  'admin-photos',
  true,
  2097152, -- 2 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "admin_photos_public_read" on storage.objects;
create policy "admin_photos_public_read"
  on storage.objects for select
  using (bucket_id = 'admin-photos');

-- An admin may only write inside a folder named after their own admins.id,
-- so one admin can never overwrite or delete another's photo.
drop policy if exists "admin_photos_own_folder_insert" on storage.objects;
create policy "admin_photos_own_folder_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'admin-photos'
    and (storage.foldername(name))[1] = current_admin_id()::text
  );

drop policy if exists "admin_photos_own_folder_update" on storage.objects;
create policy "admin_photos_own_folder_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'admin-photos'
    and (storage.foldername(name))[1] = current_admin_id()::text
  );

drop policy if exists "admin_photos_own_folder_delete" on storage.objects;
create policy "admin_photos_own_folder_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'admin-photos'
    and (storage.foldername(name))[1] = current_admin_id()::text
  );

-- ============================================================================
-- 3. Public admin lookup — now returns the profile fields
-- ============================================================================
-- Postgres won't let CREATE OR REPLACE change a function's output columns,
-- so the old version has to be dropped first (same reason as 0007).
drop function if exists get_public_admin(text);

create function get_public_admin(p_slug text)
returns table (
  id uuid,
  name text,
  slug text,
  timezone text,
  weekly_availability jsonb,
  google_calendar_connected boolean,
  photo_url text,
  headline text,
  about text,
  linkedin_url text,
  instagram_url text,
  accepting_bookings boolean,
  unavailable_message text,
  min_notice_minutes integer,
  booking_window_days integer
)
language sql
security definer
set search_path = public
stable
as $$
  select
    id, name, slug, timezone, weekly_availability, google_calendar_connected,
    photo_url, headline, about, linkedin_url, instagram_url,
    accepting_bookings, unavailable_message, min_notice_minutes, booking_window_days
  from admins
  where slug = p_slug and is_active = true;
$$;

grant execute on function get_public_admin(text) to anon, authenticated;

-- ============================================================================
-- 4. Public event-type list for the profile page
-- ============================================================================
-- Only active event types, and no PII — this is the "pick a session" list
-- an anonymous visitor sees on /book/<admin-slug>.
create or replace function get_public_admin_event_types(p_admin_id uuid)
returns table (
  id uuid,
  slug text,
  name text,
  duration_minutes integer,
  price numeric,
  description text
)
language sql
security definer
set search_path = public
stable
as $$
  select id, slug, name, duration_minutes, price, description
  from event_types
  where admin_id = p_admin_id and is_active = true
  order by price asc, duration_minutes asc, name asc;
$$;

grant execute on function get_public_admin_event_types(uuid) to anon, authenticated;
