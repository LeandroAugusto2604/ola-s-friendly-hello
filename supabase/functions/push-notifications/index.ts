import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
import { allowedPushEndpoint, overduePushPayload, pushServer } from "../_shared/web-push.ts";

const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("key") }),
  z.object({ action: z.literal("subscribe"), subscription: z.object({ endpoint: z.string().max(4096).refine(allowedPushEndpoint), keys: z.object({ p256dh: z.string().regex(/^[A-Za-z0-9_-]{87}$/), auth: z.string().regex(/^[A-Za-z0-9_-]{22}$/) }) }) }),
  z.object({ action: z.literal("test"), endpoint: z.string().max(4096).refine(allowedPushEndpoint) }),
]);
Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método inválido." }, 405);
  const url = Deno.env.get("SUPABASE_URL"), key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), anon = Deno.env.get("SUPABASE_ANON_KEY"), seed = Deno.env.get("WEB_PUSH_SIGNING_SEED");
  if (!url || !key || !anon || !seed) return json({ error: "Notificações ainda não configuradas." }, 503);
  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return json({ error: "Entre na sua conta." }, 401);
  const owner = createClient(url, anon, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  const { data: claims, error: authError } = await owner.auth.getClaims(authorization.slice(7));
  const userId = claims?.claims?.sub;
  if (authError || !userId) return json({ error: "Entre na sua conta." }, 401);
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return json({ error: "Confira a autorização deste celular." }, 400);
    const { server, publicKey } = await pushServer(seed);
    const data = parsed.data;
    if (data.action === "key") return json({ publicKey });
    const admin = createClient(url, key, { auth: { persistSession: false } });
    if (data.action === "subscribe") {
      const { endpoint, keys } = data.subscription;
      const { error } = await admin.from("push_subscriptions").upsert({ user_id: userId, endpoint, p256dh: keys.p256dh, auth: keys.auth }, { onConflict: "endpoint" });
      if (error) return json({ error: "Não foi possível cadastrar este celular." }, 500);
      return json({ success: true });
    }
    const { data: subscription, error } = await admin.from("push_subscriptions").select("endpoint,p256dh,auth").eq("user_id", userId).eq("endpoint", data.endpoint).maybeSingle();
    if (error || !subscription) return json({ error: "Ative os avisos neste celular primeiro." }, 400);
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    const { count, error: countError } = await owner.from("installments").select("id", { count: "exact", head: true }).eq("paid", false).neq("status", "liquidado").lt("due_date", today);
    if (countError) return json({ error: "Não foi possível conferir as parcelas." }, 500);
    await server.subscribe({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }).pushTextMessage(JSON.stringify(count ? overduePushPayload(count) : { title: "Notificações ativadas", body: "Seu celular está pronto para os avisos diários às 9h.", path: "/", tag: "push-test" }), {});
    return json({ success: true, overdueCount: count || 0 });
  } catch (error) {
    const status = typeof error === "object" && error !== null && "response" in error && error.response instanceof Response ? error.response.status : null;
    if (status === 404 || status === 410) return json({ error: "A autorização deste celular expirou. Desative e ative novamente." }, 410);
    return json({ error: "Não foi possível enviar o aviso. Tente novamente." }, 502);
  }
});