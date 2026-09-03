-- Zaptly — add a phone number to admins
--
-- Needed for WhatsApp notifications (e.g. the "new booking" WhatsApp alert
-- to the admin via Zaple, wired up in n8n's create-booking-event workflow).
-- Backfills all existing admins with a placeholder number so nothing breaks
-- immediately — each admin should update this to their real number.

alter table admins add column if not exists phone text;

update admins set phone = '7666007332' where phone is null;
