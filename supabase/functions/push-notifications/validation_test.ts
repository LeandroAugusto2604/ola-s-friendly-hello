import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { allowedPushEndpoint, overduePushPayload, pushServer } from "../_shared/web-push.ts";
Deno.test("push só aceita serviços de navegador, nunca URLs internas", () => {
  assertEquals(allowedPushEndpoint("https://fcm.googleapis.com/fcm/send/test"), true);
  assertEquals(allowedPushEndpoint("https://web.push.apple.com/test"), true);
  assertEquals(allowedPushEndpoint("https://updates.push.services.mozilla.com/test"), true);
  assertEquals(allowedPushEndpoint("http://127.0.0.1/test"), false);
  assertEquals(allowedPushEndpoint("https://fcm.googleapis.com.evil.test/test"), false);
});
Deno.test("aviso resume atrasos sem expor dados pessoais na tela bloqueada", () => {
  assertEquals(overduePushPayload(1).body, "1 parcela em atraso. Abra para conferir.");
  assertEquals(overduePushPayload(3).body, "3 parcelas em atraso. Abra para conferir.");
  assertEquals(overduePushPayload(1).path, "/?overdue=1");
});
Deno.test("a chave pública é estável e válida para assinatura P256", async () => {
  const first = await pushServer("test-fixture-only-not-a-production-secret");
  const second = await pushServer("test-fixture-only-not-a-production-secret");
  assertEquals(first.publicKey, second.publicKey);
  assertEquals(first.publicKey.length, 87);
  const payload = new TextEncoder().encode("test-message");
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, first.server.vapidKeys.privateKey, payload);
  assertEquals(await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, first.server.vapidKeys.publicKey, signature, payload), true);
});