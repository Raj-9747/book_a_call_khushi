// Supabase Edge Function: fireflies-webhook
//
// Fireflies calls this server-to-server when a call's transcript finishes
// processing — same "server-to-server so it works even if nobody's browser
// is still open" reasoning as razorpay-webhook.
//
// Flow:
//   1. Verify the signature over the RAW body (same trap as
//      razorpay-webhook: parse-then-reserialize changes the bytes and
//      breaks the digest).
//   2. Fetch the full transcript from Fireflies' GraphQL API — the webhook
//      payload itself only carries IDs, not the summary.
//   3. Match it to one of our bookings by Google Meet link (exact, not
//      title/time — those are guesswork, the Meet URL isn't).
//   4. Upsert `meeting_summaries`, keyed on Fireflies' own meeting id so a
//      retried delivery can't create a duplicate row.
//   5. Hand off to n8n to actually send the MoM (email + WhatsApp, to both
//      sides) — this function only stores the summary and confirms the
//      hand-off happened; n8n owns delivery, same division as
//      relay-booking-to-n8n.
//
// PLAN.md §11.4/§11.8: verify the webhook header name, its signature
// format, and the GraphQL field names below against Fireflies' current API
// docs before going live — this was written against their documented shape
// at the time, not tested against a live account.
//
// Deploy:
//   supabase functions deploy fireflies-webhook --no-verify-jwt
// Required secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//   FIREFLIES_API_KEY, FIREFLIES_WEBHOOK_SECRET, N8N_MOM_WEBHOOK_URL,
//   PUBLIC_BASE_URL

import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { splitE164Phone } from "../_shared/phoneSplit.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FIREFLIES_API_KEY = Deno.env.get("FIREFLIES_API_KEY")!;
const FIREFLIES_WEBHOOK_SECRET = Deno.env.get("FIREFLIES_WEBHOOK_SECRET")!;
const N8N_MOM_WEBHOOK_URL = Deno.env.get("N8N_MOM_WEBHOOK_URL")!;
const PUBLIC_BASE_URL = (Deno.env.get("PUBLIC_BASE_URL") ?? "http://localhost:3000").replace(/\/$/, "");

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifyFirefliesSignature(rawBody: string, header: string | null): Promise<boolean> {
  if (!header || !FIREFLIES_WEBHOOK_SECRET) return false;
  // Some providers prefix this header with "sha256=" (GitHub-style);
  // accept both that and a bare hex digest so this doesn't break over a
  // formatting detail.
  const provided = header.startsWith("sha256=") ? header.slice(7) : header;
  const expected = await hmacSha256Hex(FIREFLIES_WEBHOOK_SECRET, rawBody);
  return timingSafeEqual(expected, provided);
}

/** Strips query params/trailing slash/case so a Meet link stored on the
 * booking matches the one Fireflies reports, even if either side appended
 * `?authuser=0` or similar. */
function normalizeMeetLink(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`.toLowerCase().replace(/\/$/, "");
  } catch {
    return url.trim().toLowerCase().replace(/\/$/, "");
  }
}

interface FirefliesTranscript {
  id: string;
  title?: string;
  duration?: number;
  transcript_url?: string;
  meeting_link?: string;
  summary?: {
    overview?: string;
    short_summary?: string;
    action_items?: string;
    keywords?: string[];
  };
}

async function fetchTranscript(meetingId: string): Promise<FirefliesTranscript | null> {
  const response = await fetch("https://api.fireflies.ai/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${FIREFLIES_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: `
        query Transcript($id: String!) {
          transcript(id: $id) {
            id
            title
            duration
            transcript_url
            meeting_link
            summary {
              overview
              short_summary
              action_items
              keywords
            }
          }
        }
      `,
      variables: { id: meetingId },
    }),
  });

  if (!response.ok) {
    console.error("fireflies-webhook: transcript fetch failed", response.status, await response.text());
    return null;
  }
  const body = await response.json();
  return body?.data?.transcript ?? null;
}

/** Action items come back from Fireflies as one block of text (bullet
 * points separated by newlines), not a structured array — split it here so
 * both the DB column and the client-facing MoM get a real list. */
function parseActionItems(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split("\n")
    .map((line) => line.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature");

  if (!(await verifyFirefliesSignature(rawBody, signature))) {
    console.warn("fireflies-webhook: signature verification failed");
    return jsonResponse({ error: "Invalid signature" }, 401);
  }

  let event: { meetingId?: string; eventType?: string };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ error: "Invalid payload" }, 400);
  }

  // Only skip the two subscribed events that fire BEFORE a summary exists
  // ("Meeting Bot Joined" at call start, "Meeting Transcribed" once the
  // transcript is ready but before it's summarised). Deliberately not an
  // allowlist checking for "Meeting Summarized" specifically — the exact
  // event names sent in this field haven't been confirmed against a real
  // payload (see PLAN.md §11.4/§11.8), so the real gate is the summary-data
  // check just below instead of an exact string match here.
  const EARLY_EVENTS = ["Meeting Bot Joined", "Meeting Transcribed"];
  if (event.eventType && EARLY_EVENTS.includes(event.eventType)) {
    return jsonResponse({ skipped: "not a summary-ready event", eventType: event.eventType });
  }

  const meetingId = event.meetingId;
  if (!meetingId) {
    return jsonResponse({ error: "No meetingId in payload" }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Idempotent: a retried delivery for a meeting we've already stored is a
  // no-op rather than a duplicate MoM send.
  const { data: existing } = await supabase
    .from("meeting_summaries")
    .select("id")
    .eq("fireflies_meeting_id", meetingId)
    .maybeSingle();
  if (existing) {
    return jsonResponse({ skipped: "already processed" });
  }

  const transcript = await fetchTranscript(meetingId);
  if (!transcript) {
    return jsonResponse({ error: "Failed to fetch transcript" }, 502);
  }

  // The real "is this actually ready" gate — belt-and-braces alongside the
  // EARLY_EVENTS check above, since that one only catches event names we
  // already know about. A "Meeting Transcribed" delivery (or any other
  // early event we haven't listed) would otherwise sail through with an
  // empty summary and get stored/sent as if the call were fully processed.
  if (!transcript.summary?.short_summary && !transcript.summary?.overview) {
    return jsonResponse({ skipped: "summary not ready yet", meetingId });
  }

  const meetLink = normalizeMeetLink(transcript.meeting_link);
  if (!meetLink) {
    // No Meet link on the transcript at all — nothing to match against.
    // Not our error; return 200 so Fireflies doesn't retry forever.
    return jsonResponse({ skipped: "no meeting_link on transcript" });
  }

  // Match against every confirmed booking's meet_link, normalized the same
  // way, rather than an exact-string match in the query — a stray query
  // string on either side would otherwise silently miss.
  const { data: candidates } = await supabase
    .from("bookings")
    .select("id, admin_id, client_name, client_email, client_phone, meet_link, event_type_id")
    .not("meet_link", "is", null)
    .ilike("meet_link", `${meetLink}%`);

  const booking = (candidates ?? []).find((b) => normalizeMeetLink(b.meet_link) === meetLink);
  if (!booking) {
    // Someone may have invited the Fireflies bot to a non-Zaptly meeting —
    // that's not an error, and a non-2xx here would make Fireflies retry
    // forever for a match that will never appear.
    return jsonResponse({ skipped: "no matching booking", meetLink });
  }

  const { data: admin } = await supabase
    .from("admins")
    .select("id, name, email, phone")
    .eq("id", booking.admin_id)
    .maybeSingle();

  const { data: eventType } = await supabase
    .from("event_types")
    .select("name")
    .eq("id", booking.event_type_id)
    .maybeSingle();

  const { data: bookingRow } = await supabase
    .from("bookings")
    .select("manage_token")
    .eq("id", booking.id)
    .maybeSingle();

  const actionItems = parseActionItems(transcript.summary?.action_items);

  const { error: upsertError } = await supabase.from("meeting_summaries").upsert(
    {
      booking_id: booking.id,
      admin_id: booking.admin_id,
      fireflies_meeting_id: meetingId,
      title: transcript.title ?? null,
      short_summary: transcript.summary?.short_summary ?? null,
      overview: transcript.summary?.overview ?? null,
      action_items: actionItems,
      keywords: transcript.summary?.keywords ?? [],
      transcript_url: transcript.transcript_url ?? null,
      duration_minutes: transcript.duration ? Math.round(transcript.duration) : null,
      raw: transcript,
    },
    { onConflict: "fireflies_meeting_id" }
  );

  if (upsertError) {
    console.error("fireflies-webhook: failed to store summary", upsertError.message);
    return jsonResponse({ error: "Failed to store summary" }, 500);
  }

  const manageLink = bookingRow?.manage_token ? `${PUBLIC_BASE_URL}/booking/${bookingRow.manage_token}` : null;
  const clientPhone = splitE164Phone(booking.client_phone);

  const n8nResponse = await fetch(N8N_MOM_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      booking: {
        id: booking.id,
        client_name: booking.client_name,
        client_email: booking.client_email,
        client_phone_country_code: clientPhone?.countryCode ?? null,
        client_phone_national: clientPhone?.national ?? null,
        manage_link: manageLink,
      },
      admin: admin ? { name: admin.name, email: admin.email, phone: admin.phone } : null,
      event_type: eventType ? { name: eventType.name } : null,
      summary: {
        short_summary: transcript.summary?.short_summary ?? null,
        overview: transcript.summary?.overview ?? null,
        action_items: actionItems,
      },
    }),
  });

  if (!n8nResponse.ok) {
    // The summary is already saved — an MoM-delivery failure shouldn't be
    // retried by Fireflies re-sending the whole webhook (that would re-fetch
    // the transcript for nothing, since the idempotency check above would
    // just short-circuit). Log and return 200; worst case the admin notices
    // a missing MoM and re-triggers delivery manually later.
    console.error("fireflies-webhook: n8n MoM webhook returned", n8nResponse.status);
    return jsonResponse({ stored: true, mom_dispatch_failed: true });
  }

  await supabase.from("meeting_summaries").update({ mom_sent_at: new Date().toISOString() }).eq("fireflies_meeting_id", meetingId);

  return jsonResponse({ success: true });
});
