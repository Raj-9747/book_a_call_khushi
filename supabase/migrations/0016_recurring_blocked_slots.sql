-- Zaptly — repeating blocked time
--
-- For standing commitments: a weekly client call every Thursday, a monthly
-- review, etc. Previously the admin had to re-block the same slot by hand
-- every single week.
--
-- Design note: a repeating block is MATERIALISED as one row per occurrence
-- sharing a `recurrence_group_id`, rather than stored as a rule that gets
-- expanded at read time. That's deliberate — conflict checking currently
-- lives in several independent places (`get_busy_ranges`, the booking
-- creation RPC, the reschedule-approval query, the Google Calendar sync).
-- Concrete rows mean every one of those keeps working untouched; a stored
-- rule would mean teaching all of them to expand recurrences, and any one
-- of them missed would silently let a client book over a blocked slot.

alter table blocked_slots
  add column if not exists recurrence_group_id uuid;

create index if not exists blocked_slots_recurrence_group_idx
  on blocked_slots (recurrence_group_id)
  where recurrence_group_id is not null;

-- ============================================================================
-- Overlap guard
-- ============================================================================
-- Nothing stopped an admin blocking 2–3pm twice, or blocking a window that
-- swallowed an existing one. Duplicates aren't harmful to availability (the
-- slot is blocked either way) but they clutter the list, make the Calendar
-- sync create redundant events, and leave the admin unsure what's actually
-- blocked.
--
-- Enforced with an exclusion constraint rather than app-side checks so it
-- holds regardless of which code path inserts — and it's per-admin, so two
-- admins blocking the same wall-clock time don't collide with each other.
create extension if not exists btree_gist;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'blocked_slots_no_overlap') then
    alter table blocked_slots
      add constraint blocked_slots_no_overlap
      exclude using gist (
        admin_id with =,
        tstzrange(start_time, end_time, '[)') with &&
      );
  end if;
end $$;
