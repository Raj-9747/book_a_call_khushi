// Razorpay Checkout, loaded on demand.
//
// The script is fetched only when a client actually reaches a paid booking
// — no reason to pull a third-party script onto every free booking page or
// the admin dashboard.

const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

export interface CheckoutSuccess {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayInstance {
  open: () => void;
  on: (event: string, handler: (response: unknown) => void) => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

let loadPromise: Promise<void> | null = null;

function loadCheckoutScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("Not in a browser"));
  if (window.Razorpay) return Promise.resolve();
  // Cached so two rapid clicks don't inject the tag twice.
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = CHECKOUT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loadPromise = null;
      reject(new Error("Couldn't load the payment window. Check your connection and try again."));
    };
    document.body.appendChild(script);
  });

  return loadPromise;
}

export interface CheckoutOptions {
  keyId: string;
  orderId: string;
  amountInPaise: number;
  currency: string;
  name: string;
  description: string;
  prefill: { name: string; email: string; contact?: string };
}

/** Opens Checkout and resolves with the three values Razorpay returns on
 * success. Those are NOT proof of payment on their own — they're relayed to
 * `verify-razorpay-payment`, which checks the signature server-side.
 *
 * Rejects only if the client closes the modal without ever succeeding — a
 * single failed attempt is NOT terminal. Checkout keeps itself open after a
 * decline (e.g. "international cards not supported") and lets the client
 * retry with a different method in the same session; settling the promise
 * on that first failure would silently discard a *later* successful retry,
 * since `handler` would fire against an already-settled promise. Razorpay's
 * own UI already surfaces the failure reason inline, so there's nothing
 * useful for this function to do with `payment.failed` beyond logging it. */
export async function openRazorpayCheckout(options: CheckoutOptions): Promise<CheckoutSuccess> {
  await loadCheckoutScript();
  const Razorpay = window.Razorpay;
  if (!Razorpay) throw new Error("Couldn't load the payment window. Please try again.");

  return new Promise<CheckoutSuccess>((resolve, reject) => {
    let settled = false;

    const instance = new Razorpay({
      key: options.keyId,
      order_id: options.orderId,
      amount: options.amountInPaise,
      currency: options.currency,
      name: options.name,
      description: options.description,
      prefill: options.prefill,
      theme: { color: "#4f46e5" },
      // Retrying with a different method after a decline keeps the modal
      // open — the default, but explicit here so this isn't accidentally
      // turned off later by someone tuning other options nearby.
      retry: { enabled: true },
      modal: {
        ondismiss: () => {
          if (settled) return;
          settled = true;
          reject(new Error("Payment cancelled."));
        },
      },
      handler: (response: CheckoutSuccess) => {
        settled = true;
        resolve(response);
      },
    } as unknown as Record<string, unknown>);

    instance.on("payment.failed", (response: unknown) => {
      // Not terminal — do not settle the promise. The modal stays open for
      // a retry, which may still call `handler` with a success.
      console.warn("Razorpay payment attempt failed (may retry):", response);
    });

    instance.open();
  });
}
