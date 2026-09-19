-- Zaptly — first-run onboarding + reschedule-aware notifications
--
-- 1. admins.onboarding_dismissed_at
--    Set when an admin closes or skips the first-visit setup popup, so it
--    only ever pops up once (across devices — hence a column, not
--    localStorage). The persistent "Getting started" checklist on the
--    overview page is separate: it derives every step from real state and
--    stays until each step is genuinely done.
--
-- 2. bookings.rescheduled_at / previous_start_time
--    A reschedule reuses the exact same confirmation pipeline as a new
--    booking (approveReschedule flips confirmation_sent back to false and
--    the DB webhook fires again), so nothing downstream could tell the two
--    apart — clients got "Your booking is confirmed" for a meeting that had
--    only moved. These two columns are written in the same UPDATE as the
--    new time, so they're already on the webhook record when the relay runs.
--    Null on any booking that has never been rescheduled.

alter table admins
  add column if not exists onboarding_dismissed_at timestamptz;

alter table bookings
  add column if not exists rescheduled_at timestamptz,
  add column if not exists previous_start_time timestamptz;
