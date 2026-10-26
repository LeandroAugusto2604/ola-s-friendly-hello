import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { MAX_PHOTO_BYTES, photoExtension, registrationSchema } from "./validation.ts";
import { z } from "npm:zod@3";
import { cleanupPhotos } from "../_shared/photo-cleanup.ts";

const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método inválido." }, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return json({ error: "Serviço indisponível." }, 500);
  const admin = createClient(url, key, { auth: { persistSession: false } });
  let photoPath: string | null = null;
  try {
    const length = Number(req.headers.get("content-length"));
    if (length > MAX_PHOTO_BYTES + 65536) return json({ error: "A foto deve ter até 5 MB." }, 413);
    const body = await req.formData();
    const mode = body.get("mode");
    if (mode !== null && mode !== "photo") return json({ error: "Solicitação inválida." }, 400);
    const photoOnly = mode === "photo";
    const parsed = (photoOnly ? z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) }) : registrationSchema).safeParse(Object.fromEntries(["token", "fullName", "address", "phone", "rg", "cpf"].map(k => [k, body.get(k)])));
    if (!parsed.success) return json({ error: "Confira os dados do cadastro." }, 400);
    const photo = body.get("photo");
    if ((photoOnly && !photo) || (photo !== null && (!(photo instanceof File) || photo.size === 0))) return json({ error: "Envie uma foto segurando seu RG." }, 400);
    if (photo instanceof File && photo.size > MAX_PHOTO_BYTES) return json({ error: "A foto deve ter até 5 MB." }, 413);
    const data = parsed.data;
    const { data: status, error: statusError } = await admin.rpc(photoOnly ? "client_photo_invite_status" : "client_registration_invite_status", { p_token: data.token });
    if (statusError) return json({ error: "Não foi possível conferir o link." }, 500);
    if (status !== "pending") return json({ error: "Link inválido, expirado ou já utilizado." }, 410);
    if (photo instanceof File) {
      const bytes = new Uint8Array(await photo.arrayBuffer());
      const ext = photoExtension(bytes);
      if (!ext) return json({ error: "Envie uma foto JPG, PNG ou WebP." }, 400);
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(data.token));
      const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
      photoPath = `${hash}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await admin.storage.from("client-registration-photos").upload(photoPath, bytes, { contentType: ext === "jpg" ? "image/jpeg" : `image/${ext}`, upsert: false });
      if (uploadError) { photoPath = null; return json({ error: "Não foi possível salvar a foto. Tente novamente." }, 500); }
    }
    const registration = photoOnly ? null : registrationSchema.parse(data);
    const { data: previous, error } = photoOnly ? await admin.rpc("complete_client_photo", { p_token: data.token, p_photo_path: photoPath }) : await admin.rpc("complete_client_registration_with_photo", {
      p_token: data.token, p_full_name: registration?.fullName, p_address: registration?.address, p_phone: registration?.phone,
      p_rg: registration?.rg, p_cpf: registration?.cpf, p_photo_path: photoPath,
    });
    if (error) {
      if (photoPath) await admin.storage.from("client-registration-photos").remove([photoPath]);
      photoPath = null;
      return json({ error: error.message }, 400);
    }
    photoPath = null; // The committed photo must never be removed by error cleanup.
    if (photoOnly) await cleanupPhotos(admin, previous).catch(() => false);
    return json({ success: true });
  } catch {
    if (photoPath) await admin.storage.from("client-registration-photos").remove([photoPath]);
    return json({ error: "Não foi possível enviar o cadastro. Tente novamente." }, 500);
  }
});