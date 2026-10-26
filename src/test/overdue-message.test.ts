import { describe, it, expect } from "vitest";
import { buildOverdueWhatsAppMessage } from "../lib/overdue-message";

// Intl currency formatting uses non-breaking spaces; normalize for assertions.
const norm = (s: string) => s.replace(/\u00A0/g, " ");

describe("buildOverdueWhatsAppMessage", () => {
  it("lists parcela, juros and total on separate lines for each installment", () => {
    const message = norm(buildOverdueWhatsAppMessage("João", [
      { number: 1, dueDate: "2026-10-01", principal: 600, interest: 300 },
      { number: 2, dueDate: "2026-10-15", principal: 200, interest: 100 },
    ]));

    expect(message).toContain("Olá, João! Identificamos parcela(s) em atraso:");
    expect(message).toContain("• Parcela 1 — venc. 01/10/2026");
    expect(message).toContain("Parcela: R$ 600,00");
    expect(message).toContain("Juros: R$ 300,00");
    expect(message).toContain("Total: R$ 900,00");
    expect(message).toContain("Parcela: R$ 200,00");
    expect(message).toContain("Juros: R$ 100,00");
    expect(message).toContain("Total: R$ 300,00");
    expect(message).toContain("Total em atraso: R$ 1.200,00");
    expect(message).toContain("Por favor, regularize o pagamento.");
  });

  it("shows zero interest installments with the parcela as total", () => {
    const message = norm(buildOverdueWhatsAppMessage("Maria", [
      { number: 3, dueDate: "2026-09-10", principal: 500, interest: 0 },
    ]));
    expect(message).toContain("Parcela: R$ 500,00");
    expect(message).toContain("Juros: R$ 0,00");
    expect(message).toContain("Total: R$ 500,00");
    expect(message).toContain("Total em atraso: R$ 500,00");
  });
});

