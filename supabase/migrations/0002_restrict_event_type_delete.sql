-- Zaptly — prevent deleting an event type from silently wiping its bookings
--
-- The original schema had bookings.event_type_id ON DELETE CASCADE, which
-- would delete a booking's history the moment its event type is removed.
-- Switch to ON DELETE RESTRICT: the app only allows deleting an event type
-- that has zero bookings, and offers "deactivate" instead when it has any.

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'bookings_event_type_id_fkey') then
    alter table bookings drop constraint bookings_event_type_id_fkey;
  end if;
end $$;

alter table bookings
  add constraint bookings_event_type_id_fkey
  foreign key (event_type_id) references event_types (id) on delete restrict;
