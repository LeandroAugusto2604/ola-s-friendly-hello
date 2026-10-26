import { describe, it, expect } from "vitest";
import { loanSummary } from "@/lib/loan-schedule";

describe("loanSummary", () => {
  it("interest-only payment keeps 1000 owed and next installment 600 + 300 interest", () => {
    const s = loanSummary(1000, 30, [
      { amount: 0, amount_paid: 300, status: "liquidado" },
      { amount: 600, amount_paid: 0, status: "pendente" },
      { amount: 200, amount_paid: 0, status: "pendente" },
      { amount: 200, amount_paid: 0, status: "pendente" },
    ]);
    expect(s.outstanding).toBe(1000);
    expect(s.nextPrincipal).toBe(600);
    expect(s.nextInterest).toBe(300);
    expect(s.nextTotal).toBe(900);
  });

  it("after paying 600 + 300, owes 400 and next is 200 + 120", () => {
    const s = loanSummary(1000, 30, [
      { amount: 600, amount_paid: 900, status: "liquidado" },
      { amount: 200, amount_paid: 0, status: "pendente" },
      { amount: 200, amount_paid: 0, status: "pendente" },
    ]);
    expect(s.outstanding).toBe(400);
    expect(s.nextTotal).toBe(320);
  });
});
