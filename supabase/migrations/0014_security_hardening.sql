-- Zaptly — security hardening: privilege escalation + stale-session access
--
-- Two real gaps found in a full audit pass, both in the ORIGINAL admins
-- policies from 0001_init.sql and present since day one. Neither requires
-- anything beyond a normal logged-in admin session to exploit — no admin
-- console access, no service_role key needed.

-- ============================================================================
-- 1. Privilege escalation: any admin could self-promote to super_admin
-- ============================================================================
-- `admins_update_own_or_super_admin` (0001_init.sql) has no WITH CHECK, so
-- Postgres reuses its USING clause — which only re-checks WHICH row you're
-- touching (`auth_user_id = auth.uid()`), never WHAT you set on it. The
-- 0001 comment claims role/is_active/auth_user_id are "enforced ... +
-- revoked columns below", but the only column actually revoked there is
-- google_refresh_token. In practice, any logged-in admin could call:
--
--   supabase.from('admins').update({ role: 'super_admin' }).eq('id', selfId)
--
-- and RLS would allow it — a genuine escalation from admin to super_admin,
-- which then unlocks every super_admin-gated Edge Function for real (they
-- check the role column, which now legitimately reads 'super_admin').
--
-- Fixed the same way google_refresh_token already is: revoke client-side
-- UPDATE on the three identity/privilege columns entirely. No legitimate
-- UI flow needs it — `role` is only ever set once, at creation, by
-- `create-admin` (service_role); `auth_user_id` is never changed by any
-- client code; and `is_active` is moved into `update-admin` below so the
-- one remaining legitimate write (super-admin deactivating someone) still
-- works, just through the service-role path like every other admin
-- mutation already does.
revoke update (role) on admins from authenticated;
revoke update (is_active) on admins from authenticated;
revoke update (auth_user_id) on admins from authenticated;

-- ============================================================================
-- 2. Deactivating an admin didn't actually revoke their data access
-- ============================================================================
-- `current_admin_id()` is the ownership check behind nearly every
-- non-admins RLS policy (event_types, bookings, blocked_slots,
-- booking_enquiries, discount_codes, discount_code_event_types,
-- booking_change_requests, the admin-photos storage policies). It never
-- checked `is_active`, unlike `is_super_admin()` which already does. So
-- "deactivating" an admin only blocked the app's own login screen and
-- dashboard gate — their existing Supabase session could still read and
-- write all of their bookings, event types, discount codes, etc. via the
-- API directly, for as long as their JWT/refresh token stayed valid.
create or replace function current_admin_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select id from admins where auth_user_id = auth.uid() and is_active = true;
$$;

-- ============================================================================
-- 3. Super-admin could read every admin's event types, bookings and
--    blocked slots — contradicting a decision stated three separate times
--    in PLAN.md (the "Confirmed Decisions" table, the RLS description in
--    section 5, and section 8's "Explicitly Out of Scope" list all say
--    super_admin's RLS bypass applies ONLY to the `admins` table itself,
--    e.g. "not on other admins' bookings/notes"). This was a day-one
--    implementation bug, not an intentional change: each of these three
--    tables already has a same-admin-only "_all_own" policy that covers
--    SELECT too (Postgres `FOR ALL` includes select), so the
--    "_select_own_or_super_admin" policy on each was ADDITIVE — its only
--    real effect was the unwanted `or is_super_admin()` bypass. Dropping
--    it costs a regular admin nothing; a super_admin now sees only their
--    OWN bookings/event types/blocked slots here, exactly like every
--    other admin, and keeps their company-wide view solely on the
--    `admins` list itself (name/email/phone/slug/status), matching the
--    documented "siloed by design" intent.
drop policy if exists "event_types_select_own_or_super_admin" on event_types;
drop policy if exists "bookings_select_own_or_super_admin" on bookings;
drop policy if exists "blocked_slots_select_own_or_super_admin" on blocked_slots;
