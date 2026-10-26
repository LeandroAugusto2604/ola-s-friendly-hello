import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
import { cleanupPhotos } from "../_shared/photo-cleanup.ts";

const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método inválido." }, 405);
  const url = Deno.env.get("SUPABASE_URL"), anon = Deno.env.get("SUPABASE_ANON_KEY"), key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !key) return json({ error: "Serviço indisponível." }, 500);
  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return json({ error: "Entre na sua conta." }, 401);
  const owner = createClient(url, anon, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  const { data: claims, error: authError } = await owner.auth.getClaims(authorization.slice(7));
  if (authError || !claims?.claims?.sub) return json({ error: "Entre na sua conta." }, 401);
  try {
    const parsed = z.object({ clientId: z.string().uuid() }).safeParse(await req.json());
    if (!parsed.success) return json({ error: "Cliente inválido." }, 400);
    const { data, error } = await owner.rpc("clear_client_identity_photo", { p_client_id: parsed.data.clientId });
    if (error) return json({ error: "Não foi possível excluir a foto deste cliente." }, 403);
    const admin = createClient(url, key, { auth: { persistSession: false } });
    const cleaned = await cleanupPhotos(admin, data).catch(() => false);
    return json({ success: true, cleanupPending: !cleaned });
  } catch { return json({ error: "Não foi possível excluir a foto." }, 400); }
});