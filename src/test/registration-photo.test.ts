import { describe, expect, it } from "vitest";
import { validateRegistrationPhoto } from "@/lib/registration-photo";

describe("foto obrigatória no cadastro por link", () => {
  it("exige a foto junto aos dados", () => {
    expect(validateRegistrationPhoto(null)).toBe("Tire ou selecione uma foto segurando seu RG.");
    expect(validateRegistrationPhoto({ size: 0, type: "image/jpeg" })).not.toBeNull();
    expect(validateRegistrationPhoto({ size: 2000, type: "image/jpeg" })).toBeNull();
  });
  it("recusa arquivos que não são fotos", () => {
    expect(validateRegistrationPhoto({ size: 2000, type: "application/pdf" })).toBe("Selecione uma foto JPG, PNG ou WebP.");
  });
  it("limita a foto a cinco MB", () => {
    expect(validateRegistrationPhoto({ size: 5 * 1024 * 1024, type: "image/png" })).toBeNull();
    expect(validateRegistrationPhoto({ size: 5 * 1024 * 1024 + 1, type: "image/png" })).toBe("A foto deve ter até 5 MB.");
  });
});