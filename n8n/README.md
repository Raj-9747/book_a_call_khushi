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
| `workflows/expire-holds-cron.json` | Schedule (every 5 min) | Calls the `expire-pending-bookings` Edge Function, which releases abandoned Razorpay checkouts and hands back any discount-code use they consumed. No credentials needed beyond `BOOKING_WEBHOOK_SECRET`. | Built |
| `workflows/mom-ready.json` | Webhook (called by the `fireflies-webhook` Supabase Edge Function once a call's transcript is summarised) | Sends the meeting notes to both sides: email + WhatsApp to the client (short summary + action items only), email + WhatsApp to the admin (full overview + action items). The client WhatsApp send is skipped if their number couldn't be split into a dial code — see PLAN.md §11.1 — but their email always goes. | Built — needs your credentials wired up |
| `workflows/abandoned-payment-cron.json` | Schedule (every 10 min) | Calls `get_abandoned_bookings` (15-minute cutoff) for expired, unreminded payment holds and sends one recovery nudge per booking — email always, WhatsApp when the phone splits. Marks `abandoned_reminder_sent` via `mark_abandoned_reminder_sent` either way, so it's a one-time message. | Built — needs your credentials wired up |

Both new workflows call `get_abandoned_bookings`/`mark_abandoned_reminder_sent` directly via PostgREST's RPC endpoint (`POST {SUPABASE_URL}/rest/v1/rpc/<function>`) using the same embedded service-role JWT already used elsewhere in this file — not through an Edge Function. That's deliberate parity with how `reminder-cron.json` already reads `bookings` directly: both RPCs are `revoke all ... from public, anon, authenticated` in their migration, so only the service-role key can call them, same protection as a table under RLS.

## Getting the booking-created webhook URL into Supabase

1. Import and activate `create-booking-event.json`.
2. Copy its **Production Webhook URL** (click the Webhook node → shown at the top).
3. Set it as an Edge Function secret: `supabase secrets set N8N_BOOKING_WEBHOOK_URL=<that URL>`.
4. Generate a random secret: `openssl rand -hex 32` — this is what stops anyone else from triggering your relay endpoint. Set it as an Edge Function secret too: `supabase secrets set BOOKING_WEBHOOK_SECRET=<that random string>`.
5. Deploy the relay function: `supabase functions deploy relay-booking-to-n8n --no-verify-jwt`
6. In Supabase Dashboard → Database → Webhooks → Create a new webhook:
   - Table: `bookings`, Events: **`INSERT` and `UPDATE`**
     (UPDATE is required now that paid bookings are inserted as `pending_payment` and only become `confirmed` once payment clears — INSERT alone would email the client before they'd paid, and never afterwards. The relay function ignores everything that isn't a newly-confirmed booking, and marks `confirmation_sent` before dispatching so an update storm can't send twice.)
   - Type: **Supabase Edge Functions** → select `relay-booking-to-n8n`
   - Add an HTTP header: `x-webhook-secret` = the same random string from step 4

**Also update before activating:** `abandoned-payment-cron.json`'s email and WhatsApp nodes hardcode `https://zaptly.vercel.app` when building the "pick a new time" rebook link — swap that for your actual domain if it differs (the RPC only returns the admin/event-type slugs, not a full URL, since n8n has no equivalent of the app's `PUBLIC_BASE_URL`).

## Getting the MoM-ready webhook URL into Supabase

Same pattern as the booking-created webhook above, for the Fireflies summary hand-off:

1. Import and activate `mom-ready.json`.
2. Copy its **Production Webhook URL**.
3. Set it as an Edge Function secret: `supabase secrets set N8N_MOM_WEBHOOK_URL=<that URL>`.
4. Deploy: `supabase functions deploy fireflies-webhook --no-verify-jwt`

## Fireflies setup

1. Get a Fireflies plan with API access, and generate an API key.
2. Set the two related Edge Function secrets: `supabase secrets set FIREFLIES_API_KEY=<your-api-key>` and `supabase secrets set FIREFLIES_WEBHOOK_SECRET=<a-random-string-you-generate>`.
3. In Fireflies' webhook settings, add a webhook pointed at your deployed `fireflies-webhook` function URL with the same secret as step 2, and subscribe it to **"Meeting Summarized"** (their actual event list, confirmed from the dashboard, is "Meeting Bot Joined" / "Meeting Transcribed" / "Meeting Summarized" — not the "Transcription completed" name Fireflies' docs use elsewhere). Subscribing to the other two is harmless — the function recognizes and skips them — but only "Meeting Summarized" is actually needed.
4. **Verify the rest against a real payload before going live** — `fireflies-webhook`'s signature header name/format and its GraphQL query field names (`summary.short_summary`, `meeting_link`, etc.) were written against Fireflies' documented API shape, not a live account, so those are still unconfirmed. The function doesn't rely solely on the event name above either way — it only stores/sends once the fetched transcript actually has a summary, so an unexpected event name fails safe (skipped) rather than sending an empty MoM. Also unconfirmed: the notetaker bot's email address (`fred@fireflies.ai` at time of writing) hardcoded in `create-booking-event.json`'s Calendar-event node.
5. Only event types with **"Record & summarise this meeting"** turned on (in that event type's settings in the dashboard) invite the bot — it's added to the Calendar event's attendee list only when `record_meeting` is true, so nothing changes for event types that don't opt in.

## Supabase URL + service role key inside n8n

Both workflows call Supabase's REST API directly (`{SUPABASE_URL}/rest/v1/bookings`) using `$env.SUPABASE_URL` / `$env.SUPABASE_SERVICE_ROLE_KEY` expressions in the HTTP Request nodes. Which path applies depends on how your n8n is hosted:

- **Self-hosted n8n**: set these as real environment variables on the n8n process (e.g. in your `docker-compose.yml`'s `environment:` block, or your `.env` file) — n8n exposes `process.env` to workflow expressions as `$env.VAR_NAME` by default.
- **n8n Cloud**: you can't set arbitrary custom environment variables. Instead, open each HTTP Request node in both workflows and replace `{{ $env.SUPABASE_URL }}` with your actual project URL (not secret, fine to hardcode) and `{{ $env.SUPABASE_SERVICE_ROLE_KEY }}` with your service role key (you already agreed n8n is a trusted place to store this — it'll live in the workflow's own definition, encrypted at rest by n8n Cloud same as everything else there).

## Required n8n credentials (set up once, inside n8n)

- **Gmail OAuth2** — connect the Google account you want confirmation/reminder emails sent from. Assign it to the Gmail node in both workflows after import.
- **Google Calendar API access** for event creation comes from the `google_access_token` the Edge Function already refreshes and passes in the webhook payload — no separate n8n Google Calendar credential needed, the workflow calls the Calendar REST API directly with that token via HTTP Request.

Nothing here is hardcoded in the app itself — every credential/secret lives inside n8n's own store or as a Supabase Edge Function secret, never in this repo.
