import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { allowedPushEndpoint, overduePushPayload, pushServer } from "../_shared/web-push.ts";

const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método inválido." }, 405);
  const url = Deno.env.get("SUPABASE_URL"), key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), anon = Deno.env.get("SUPABASE_ANON_KEY"), seed = Deno.env.get("WEB_PUSH_SIGNING_SEED");
  if (!url || !key || !anon || !seed) return json({ error: "Serviço indisponível." }, 503);
  if (req.headers.get("apikey") !== anon) return json({ error: "Não autorizado." }, 401);
  try {
    const body = await req.json();
    if (!body || body.kind !== "daily" || Object.keys(body).length !== 1) return json({ error: "Solicitação inválida." }, 400);
    // The publishable key is public: the database, not the caller, controls the
    // 9am delivery window, recipients, overdue data and once-per-device/day claims.
    const { server } = await pushServer(seed);
    const admin = createClient(url, key, { auth: { persistSession: false } });
    const { data: deliveries, error } = await admin.rpc("claim_daily_overdue_push");
    if (error) return json({ error: "Não foi possível preparar os avisos." }, 500);
    for (const item of deliveries || []) {
      let status = "failed";
      try {
        if (!allowedPushEndpoint(item.endpoint)) throw new Error("Endpoint inválido");
        await server.subscribe({ endpoint: item.endpoint, keys: { p256dh: item.p256dh, auth: item.auth } }).pushTextMessage(JSON.stringify(overduePushPayload(Number(item.overdue_count))), {});
        status = "sent";
      } catch (error) {
        const code = typeof error === "object" && error !== null && "response" in error && error.response instanceof Response ? error.response.status : null;
        if (code === 404 || code === 410) { await admin.from("push_subscriptions").delete().eq("id", item.subscription_id); continue; }
      }
      await admin.from("push_daily_deliveries").update({ status }).eq("subscription_id", item.subscription_id).eq("status", "claimed");
    }
    return json({ success: true });
  } catch { return json({ error: "Não foi possível enviar os avisos." }, 500); }
});