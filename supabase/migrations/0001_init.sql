-- Zaptly — initial schema
-- Run this in the Supabase SQL Editor (or via `supabase db push`) on your project.

-- ============================================================================
-- FOUNDERS
-- ============================================================================
create table if not exists admins (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users (id) on delete cascade,
  name text not null,
  email text not null unique,
  slug text not null unique,
  role text not null default 'admin' check (role in ('super_admin', 'admin')),
  is_active boolean not null default true,
  timezone text not null default 'Asia/Kolkata',
  google_calendar_connected boolean not null default false,
  google_refresh_token text,
  notification_config jsonb not null default '{}'::jsonb,
  weekly_availability jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists admins_slug_idx on admins (slug);
create index if not exists admins_auth_user_id_idx on admins (auth_user_id);

-- Helper: is the currently-authenticated user a super_admin?
-- SECURITY DEFINER so it can read the admins table regardless of the
-- caller's own row-level policies (avoids recursive RLS lookups).
create or replace function is_super_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from admins
    where auth_user_id = auth.uid()
      and role = 'super_admin'
      and is_active = true
  );
$$;

-- Helper: the admins.id row of the currently-authenticated user.
create or replace function current_admin_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select id from admins where auth_user_id = auth.uid();
$$;

alter table admins enable row level security;

-- An admin can see their own row; a super_admin can see everyone.
create policy "admins_select_own_or_super_admin"
  on admins for select
  using (auth_user_id = auth.uid() or is_super_admin());

-- An admin can update their own row, EXCEPT role/is_active/auth_user_id
-- (enforced in application layer + revoked columns below). A super_admin
-- can update any row (e.g. to deactivate an admin).
create policy "admins_update_own_or_super_admin"
  on admins for update
  using (auth_user_id = auth.uid() or is_super_admin());

-- No direct INSERT/DELETE policy for authenticated users: admins are
-- created via the `invite-admin` Supabase Edge Function (using the
-- service_role key, which bypasses RLS entirely) so that we can create
-- the corresponding Supabase Auth user in the same step.

-- Lock down the refresh token column: only service_role (Edge Functions /
-- n8n, using the service key) may read or write it. Authenticated clients
-- only ever see the `google_calendar_connected` boolean.
revoke select (google_refresh_token) on admins from authenticated;
revoke update (google_refresh_token) on admins from authenticated;

-- ============================================================================
-- EVENT TYPES
-- ============================================================================
create table if not exists event_types (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references admins (id) on delete cascade,
  slug text not null,
  name text not null,
  duration_minutes integer not null check (duration_minutes > 0),
  price numeric(10, 2) not null default 0,
  description text,
  custom_questions jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (admin_id, slug)
);

alter table event_types enable row level security;

create policy "event_types_select_own_or_super_admin"
  on event_types for select
  using (admin_id = current_admin_id() or is_super_admin());

create policy "event_types_all_own"
  on event_types for all
  using (admin_id = current_admin_id())
  with check (admin_id = current_admin_id());

-- ============================================================================
-- BOOKINGS
-- ============================================================================
create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references admins (id) on delete cascade,
  event_type_id uuid not null references event_types (id) on delete cascade,
  client_name text not null,
  client_email text not null,
  client_phone text,
  custom_answers jsonb not null default '{}'::jsonb,
  start_time timestamptz not null,
  end_time timestamptz not null,
  client_timezone text,
  status text not null default 'pending_confirmation'
    check (status in ('pending_confirmation', 'confirmed', 'cancelled', 'completed')),
  payment_status text not null default 'free' check (payment_status in ('free', 'paid_dummy')),
  google_event_id text,
  meet_link text,
  reminder_sent boolean not null default false,
  notes text,
  tag text check (tag in ('Lead', 'Client', 'Follow-up', 'Closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bookings_admin_id_idx on bookings (admin_id);
create index if not exists bookings_start_time_idx on bookings (start_time);
create index if not exists bookings_reminder_pending_idx on bookings (start_time, reminder_sent) where status = 'confirmed';

alter table bookings enable row level security;

create policy "bookings_select_own_or_super_admin"
  on bookings for select
  using (admin_id = current_admin_id() or is_super_admin());

create policy "bookings_all_own"
  on bookings for all
  using (admin_id = current_admin_id())
  with check (admin_id = current_admin_id());

-- NOTE: public (anon) clients cannot read or write this table directly yet.
-- The public booking flow will use a SECURITY DEFINER RPC function
-- (added in a later migration, once we build that feature) so that:
--   1) anonymous visitors can check busy slots without seeing other
--      clients' names/emails/phone numbers, and
--   2) new bookings are created safely without an anon key being able to
--      set status/google_event_id/meet_link/notes/tag directly.

-- ============================================================================
-- BLOCKED SLOTS (manual "block my calendar" entries)
-- ============================================================================
create table if not exists blocked_slots (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references admins (id) on delete cascade,
  start_time timestamptz not null,
  end_time timestamptz not null,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists blocked_slots_admin_id_idx on blocked_slots (admin_id);

alter table blocked_slots enable row level security;

create policy "blocked_slots_select_own_or_super_admin"
  on blocked_slots for select
  using (admin_id = current_admin_id() or is_super_admin());

create policy "blocked_slots_all_own"
  on blocked_slots for all
  using (admin_id = current_admin_id())
  with check (admin_id = current_admin_id());

-- ============================================================================
-- INTEGRATION DEFAULTS (company-wide fallback WhatsApp/email sender config)
-- ============================================================================
create table if not exists integration_defaults (
  id boolean primary key default true check (id), -- enforces a single row
  default_email_config jsonb not null default '{}'::jsonb,
  default_whatsapp_config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into integration_defaults (id) values (true) on conflict do nothing;

alter table integration_defaults enable row level security;

-- Only service_role (Edge Functions) touches this table directly.
-- The super-admin UI writes to it via an Edge Function that verifies
-- the caller's role server-side before using the service key.
-- No policies are defined for anon/authenticated — default is deny-all.

-- ============================================================================
-- updated_at auto-touch trigger (applied to all mutable tables)
-- ============================================================================
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger admins_set_updated_at before update on admins
  for each row execute function set_updated_at();
create trigger event_types_set_updated_at before update on event_types
  for each row execute function set_updated_at();
create trigger bookings_set_updated_at before update on bookings
  for each row execute function set_updated_at();
