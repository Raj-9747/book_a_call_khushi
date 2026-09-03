# n8n Workflows — Zaptly

This folder holds the exported n8n workflow JSON files that power Zaptly's calendar, Google Meet, and email automation. Each workflow is built and tested incrementally alongside the matching app feature.

**Heads up**: these JSON files were hand-authored to match n8n's documented node schema, but haven't been run against a live n8n instance by me — treat them as a strong starting point. Import each one, then open every node once to confirm it looks right (especially the HTTP Request and Gmail nodes) before activating.

## How to import

1. Open your n8n instance → Workflows → Import from File → select the `.json` file.
2. Reconnect credentials: the Gmail node needs your own Gmail OAuth2 credential picked from the dropdown (the imported placeholder credential ID won't exist in your instance).
3. Decide how the workflow gets your Supabase URL + service role key (see below) and update the relevant nodes.
4. Activate the workflow.

## Workflows

| File | Trigger | Purpose | Status |
|---|---|---|---|
| `workflows/create-booking-event.json` | Webhook (called by the `relay-booking-to-n8n` Supabase Edge Function on every new booking) | If the admin has Google Calendar connected: creates the event with a Meet link, attaches both client + admin as attendees, writes `meet_link`/`google_event_id` back to the booking. Either way, sends a confirmation email to the client AND a separate "you got a new booking" notification email to the admin via Gmail — the admin is the event's *organizer* on their own calendar, so Google doesn't email organizers the way it emails guests, which is why this explicit admin email exists. | Built — needs your credentials wired up |
| `workflows/reminder-cron.json` | Schedule (every 10 min) | Finds confirmed bookings starting in ~1 hour that haven't been reminded yet, sends a reminder email, marks `reminder_sent = true`. | Built — needs your credentials wired up |

## Getting the booking-created webhook URL into Supabase

1. Import and activate `create-booking-event.json`.
2. Copy its **Production Webhook URL** (click the Webhook node → shown at the top).
3. Set it as an Edge Function secret: `supabase secrets set N8N_BOOKING_WEBHOOK_URL=<that URL>`.
4. Generate a random secret: `openssl rand -hex 32` — this is what stops anyone else from triggering your relay endpoint. Set it as an Edge Function secret too: `supabase secrets set BOOKING_WEBHOOK_SECRET=<that random string>`.
5. Deploy the relay function: `supabase functions deploy relay-booking-to-n8n --no-verify-jwt`
6. In Supabase Dashboard → Database → Webhooks → Create a new webhook:
   - Table: `bookings`, Events: `INSERT` only
   - Type: **Supabase Edge Functions** → select `relay-booking-to-n8n`
   - Add an HTTP header: `x-webhook-secret` = the same random string from step 4

## Supabase URL + service role key inside n8n

Both workflows call Supabase's REST API directly (`{SUPABASE_URL}/rest/v1/bookings`) using `$env.SUPABASE_URL` / `$env.SUPABASE_SERVICE_ROLE_KEY` expressions in the HTTP Request nodes. Which path applies depends on how your n8n is hosted:

- **Self-hosted n8n**: set these as real environment variables on the n8n process (e.g. in your `docker-compose.yml`'s `environment:` block, or your `.env` file) — n8n exposes `process.env` to workflow expressions as `$env.VAR_NAME` by default.
- **n8n Cloud**: you can't set arbitrary custom environment variables. Instead, open each HTTP Request node in both workflows and replace `{{ $env.SUPABASE_URL }}` with your actual project URL (not secret, fine to hardcode) and `{{ $env.SUPABASE_SERVICE_ROLE_KEY }}` with your service role key (you already agreed n8n is a trusted place to store this — it'll live in the workflow's own definition, encrypted at rest by n8n Cloud same as everything else there).

## Required n8n credentials (set up once, inside n8n)

- **Gmail OAuth2** — connect the Google account you want confirmation/reminder emails sent from. Assign it to the Gmail node in both workflows after import.
- **Google Calendar API access** for event creation comes from the `google_access_token` the Edge Function already refreshes and passes in the webhook payload — no separate n8n Google Calendar credential needed, the workflow calls the Calendar REST API directly with that token via HTTP Request.

Nothing here is hardcoded in the app itself — every credential/secret lives inside n8n's own store or as a Supabase Edge Function secret, never in this repo.
