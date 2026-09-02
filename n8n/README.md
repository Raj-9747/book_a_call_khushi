# n8n Workflows — Zaptly

This folder holds the exported n8n workflow JSON files that power Zaptly's calendar, Google Meet, email, and WhatsApp (Zaple) automation. Each workflow is built and tested incrementally alongside the matching app feature — this README is updated as each one lands.

## How to use these files

1. Open your n8n instance (self-hosted or n8n Cloud).
2. Workflows → Import from File → select the relevant `.json` file from `n8n/workflows/`.
3. Reconnect the credentials (Google Calendar OAuth2, Zaple, email/SMTP) inside n8n — credentials are never stored in these exported files.
4. Activate the workflow and copy its **Production Webhook URL** where noted below.

## Planned workflows (added as we build each feature)

| File | Purpose | Status |
|---|---|---|
| `workflows/google-calendar-oauth-exchange.json` | Exchanges an admin's Google OAuth code for tokens during "Connect Google Calendar" | Not yet built |
| `workflows/create-booking-event.json` | Triggered on new booking → creates Google Calendar event w/ Meet link → writes back to Supabase → sends confirmation email + WhatsApp | Not yet built |
| `workflows/reminder-cron.json` | Runs every ~5-10 min → finds bookings starting in ~1 hour → sends reminder email + WhatsApp | Not yet built |

## Required n8n credentials (set up once, inside n8n)

- **Google Calendar OAuth2** — one credential per admin (each admin connects their own calendar; n8n workflow selects the right credential per `admin_id` at runtime — exact mechanism finalized when we build the calendar-connect feature).
- **Zaple** (WhatsApp) — HTTP Request node or community node, using your Zaple API key.
- **Email/SMTP** — your transactional email provider credentials.

Nothing here is hardcoded — every credential is entered inside n8n's own credential store, not in these JSON files.
