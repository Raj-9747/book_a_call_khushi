/** Unwraps an Edge Function error into the message the function actually
 * sent. `supabase.functions.invoke` reports any non-2xx response as a
 * generic `FunctionsHttpError` ("Edge Function returned a non-2xx status
 * code") — the real `{ error: "..." }` body has to be read back out of
 * `error.context`, a `Response` object, or every friendly message an Edge
 * Function returns (duplicate email, taken slug, etc.) is silently lost
 * and replaced with that generic string. */
export async function edgeFunctionError(error: unknown, fallback: string): Promise<Error> {
  const context = (error as { context?: Response })?.context;
  if (context && typeof context.json === "function") {
    try {
      const body = await context.json();
      if (body?.error) return new Error(body.error);
    } catch {
      /* Body wasn't JSON — fall through to the generic message. */
    }
  }
  return new Error(error instanceof Error && error.message ? error.message : fallback);
}
