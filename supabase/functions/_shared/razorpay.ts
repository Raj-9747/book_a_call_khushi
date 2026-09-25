// Shared Razorpay helpers.
//
// The key secret and webhook secret live only here, as Edge Function
// secrets. Only the key ID is ever exposed to the browser (that's what it's
// for — it identifies the account when opening Checkout).

export const RAZORPAY_KEY_ID = Deno.env.get("RAZORPAY_KEY_ID") ?? "";
const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET") ?? "";
const RAZORPAY_WEBHOOK_SECRET = Deno.env.get("RAZORPAY_WEBHOOK_SECRET") ?? "";

/** Razorpay works entirely in the currency's smallest unit. For INR that's
 * paise, so every rupee amount crossing the API boundary is converted here
 * rather than at each call site. */
export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

export function paiseToRupees(paise: number): number {
  return paise / 100;
}

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

/** Constant-time comparison, so a caller can't learn the correct signature
 * one byte at a time from response-timing differences. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  status: string;
}

/** Creates an order server-side. `amountInPaise` comes from the database,
 * never from the request body. `receipt` is our own booking id, which is
 * what lets the webhook find the booking again later. */
export async function createRazorpayOrder(params: {
  amountInPaise: number;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<RazorpayOrder> {
  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: params.amountInPaise,
      currency: "INR",
      receipt: params.receipt,
      notes: params.notes ?? {},
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Razorpay order creation failed (${response.status}): ${body}`);
  }
  return (await response.json()) as RazorpayOrder;
}

/** Verifies the signature Razorpay Checkout hands back to the browser.
 * Proves the payment really was captured for THIS order — the browser is
 * relaying it, so nothing it says can be believed without this check. */
export async function verifyCheckoutSignature(
  orderId: string,
  paymentId: string,
  signature: string
): Promise<boolean> {
  if (!orderId || !paymentId || !signature) return false;
  const expected = await hmacSha256Hex(RAZORPAY_KEY_SECRET, `${orderId}|${paymentId}`);
  return timingSafeEqual(expected, signature);
}

/** Verifies a webhook delivery. Must be given the RAW request body — the
 * signature covers the exact bytes Razorpay sent, so re-serializing parsed
 * JSON would produce a different (failing) digest. */
export async function verifyWebhookSignature(rawBody: string, signature: string | null): Promise<boolean> {
  if (!signature || !RAZORPAY_WEBHOOK_SECRET) return false;
  const expected = await hmacSha256Hex(RAZORPAY_WEBHOOK_SECRET, rawBody);
  return timingSafeEqual(expected, signature);
}

export interface RazorpayPayment {
  id: string;
  order_id: string;
  amount: number;
  status: string;
}

/** Re-reads a payment from Razorpay rather than trusting the amount a
 * client reported. Used to confirm what was actually captured. */
export async function fetchRazorpayPayment(paymentId: string): Promise<RazorpayPayment> {
  const response = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Basic ${btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`)}` },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Razorpay payment lookup failed (${response.status}): ${body}`);
  }
  return (await response.json()) as RazorpayPayment;
}

export interface RazorpayRefund {
  id: string;
  payment_id: string;
  amount: number;
  status: string; // "pending" | "processed" | "failed"
}

/** Thrown with Razorpay's own description so the admin sees WHY it refused
 * ("payment not captured", "refund amount exceeds…") instead of a generic
 * failure. */
export class RazorpayError extends Error {}

export async function refundRazorpayPayment(
  paymentId: string,
  amountInPaise: number,
  notes: Record<string, string> = {}
): Promise<RazorpayRefund> {
  const response = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}/refund`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ amount: amountInPaise, speed: "normal", notes }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new RazorpayError(body?.error?.description ?? `Razorpay refund failed (${response.status})`);
  }
  return body as RazorpayRefund;
}
