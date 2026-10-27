import { p256 } from "npm:@noble/curves@1.8.1/p256";
import { ApplicationServer } from "jsr:@negrel/webpush@0.5.0";

export const encode64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export async function pushServer(seed: string) {
  let scalar: Uint8Array;
  for (let counter = 0; ; counter++) {
    scalar = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`loan-web-push-v1:${seed}:${counter}`)));
    if (p256.utils.isValidPrivateKey(scalar)) break;
  }
  const raw = p256.getPublicKey(scalar, false);
  const jwk = { kty: "EC", crv: "P-256", x: encode64(raw.slice(1, 33)), y: encode64(raw.slice(33)), ext: true };
  const publicKey = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, true, ["verify"]);
  const privateKey = await crypto.subtle.importKey("jwk", { ...jwk, d: encode64(scalar) }, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const server = await ApplicationServer.new({ contactInformation: "https://emprestimo.dev-prod.cloud", vapidKeys: { publicKey, privateKey } });
  return { server, publicKey: encode64(raw) };
}

// Only browser push services can be targeted; never fetch a caller-supplied arbitrary URL.
export function allowedPushEndpoint(endpoint: string) {
  try {
    const url = new URL(endpoint);
    return url.protocol === "https:" && !url.username && !url.password && !url.port &&
      ["fcm.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com"].includes(url.hostname);
  } catch { return false; }
}
export function overduePushPayload(count: number) {
  return { title: "Parcelas em atraso", body: `${count} parcela${count === 1 ? "" : "s"} em atraso. Abra para conferir.`, path: "/?overdue=1", tag: "daily-overdue" };
}