-- Zaptly — track a Google Calendar event ID for each manual block
--
-- Needed so a manual block can be synced to (and removed from) the admin's
-- real Google Calendar, not just Zaptly's own availability computation.

alter table blocked_slots add column if not exists google_event_id text;
