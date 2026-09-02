// Shared CORS headers for Edge Functions called directly from the browser
// (supabase.functions.invoke). Without these, the browser's preflight
// OPTIONS request gets no Access-Control-Allow-* headers back and the real
// request never fires — surfaces in the app as "Failed to send a request
// to the Edge Function".
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
