import { photoExtension, registrationSchema } from "./validation.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.test("recusa PDF disfarçado de foto", () => {
  assertEquals(photoExtension(new TextEncoder().encode("%PDF-foto.jpg")), null);
});
Deno.test("aceita assinaturas de fotos JPG e PNG", () => {
  assertEquals(photoExtension(new Uint8Array([255, 216, 255, 224])), "jpg");
  assertEquals(photoExtension(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])), "png");
});
Deno.test("o cadastro público não aceita responsável informado pelo cliente", () => {
  const result = registrationSchema.parse({ token: "a".repeat(64), fullName: "Cliente Teste", address: "Rua de Teste, 100", phone: "11999990000", rg: "12345678", cpf: "12345678900", user_id: "outro" });
  assertEquals(Object.hasOwn(result, "user_id"), false);
});