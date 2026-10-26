import { describe, expect, it } from "vitest";
import { clientSchema, formatCPF, formatPhone, isRegistrationToken, registrationUrl } from "@/lib/client-registration";

const client = { fullName: "Cliente Teste", address: "Rua de Teste, 100", phone: "(11) 99999-0000", rg: "12345678", cpf: "123.456.789-00" };

describe("cadastro manual e por link", () => {
  it("coleta os mesmos cinco dados pessoais do cadastro manual", () => {
    expect(clientSchema.parse(client)).toEqual(client);
    for (const name of Object.keys(client)) {
      expect(clientSchema.safeParse({ ...client, [name]: "" }).success).toBe(false);
    }
  });
  it("não aceita definir o responsável nem o empréstimo pelo formulário público", () => {
    expect(clientSchema.parse({ ...client, user_id: "outro-responsavel", amount: 6000 })).toEqual(client);
  });
  it("mantém os formatos de CPF e celular", () => {
    expect(formatCPF("12345678900")).toBe("123.456.789-00");
    expect(formatPhone("11999990000")).toBe("(11) 99999-0000");
    expect(clientSchema.safeParse({ ...client, phone: "123" }).success).toBe(false);
  });
  it("cria o link no mesmo site e mantém o convite no fragmento para funcionar na VPS", () => {
    const token = "a".repeat(64);
    expect(registrationUrl("https://emprestimo.dev-prod.cloud", token)).toBe(`https://emprestimo.dev-prod.cloud/#/cadastro-cliente/${token}`);
    expect(new URL(registrationUrl("https://emprestimo.dev-prod.cloud", token)).pathname).toBe("/");
  });
  it("recusa tokens inválidos", () => {
    expect(isRegistrationToken("invalido")).toBe(false);
    expect(() => registrationUrl("https://emprestimo.dev-prod.cloud", "invalido")).toThrow();
  });
});