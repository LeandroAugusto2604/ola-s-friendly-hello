import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export async function cleanupPhotos(admin: SupabaseClient, previous: unknown): Promise<boolean> {
  if (!previous || typeof previous !== "object") return true;
  const { old_path, old_urls } = previous as { old_path?: unknown; old_urls?: unknown };
  let success = true;
  if (typeof old_path === "string" && /^[a-f0-9]{64}\/[a-f0-9-]{36}\.(jpg|png|webp)$/.test(old_path)) {
    const { error } = await admin.storage.from("client-registration-photos").remove([old_path]);
    if (error) success = false;
  }
  const base = `${Deno.env.get("SUPABASE_URL")}/storage/v1/object/public/identity-photos/`;
  const paths = Array.isArray(old_urls) ? old_urls.filter((url): url is string => typeof url === "string" && url.startsWith(base)).map(url => decodeURIComponent(url.slice(base.length).split("?")[0])).filter(path => !path.includes("..")) : [];
  if (paths.length) {
    const { error } = await admin.storage.from("identity-photos").remove(paths);
    if (error) success = false;
  }
  return success;
}