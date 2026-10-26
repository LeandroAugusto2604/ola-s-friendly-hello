import { describe, expect, it } from "vitest";
import { clientPhotoUrl, clientPhotoVerified, validateOptionalRegistrationPhoto } from "@/lib/client-photo";

describe("verificação da foto do cliente", () => {
  it("foto de cadastro verifica o cliente mesmo sem verificação antiga", () => {
    expect(clientPhotoVerified("foto.jpg", null)).toBe(true);
  });
  it("sem foto o cliente fica não verificado", () => {
    expect(clientPhotoVerified(null, null)).toBe(false);
    expect(clientPhotoVerified(null, { status: "expired", photo_url: null })).toBe(false);
  });
  it("preserva foto antiga válida até ser excluída ou substituída", () => {
    expect(clientPhotoVerified(null, { status: "completed", photo_url: "foto-antiga.jpg" })).toBe(true);
    expect(clientPhotoVerified(null, { status: "completed", photo_url: null })).toBe(false);
  });
  it("permite cadastro sem foto mas valida foto enviada", () => {
    expect(validateOptionalRegistrationPhoto(null)).toBeNull();
    expect(validateOptionalRegistrationPhoto({ size: 100, type: "application/pdf" })).not.toBeNull();
  });
  it("link para nova foto usa apenas foto e domínio da VPS", () => {
    expect(clientPhotoUrl("a".repeat(64))).toBe(`https://emprestimo.dev-prod.cloud/#/foto-cliente/${"a".repeat(64)}`);
    expect(() => clientPhotoUrl("inválido")).toThrow();
  });
});