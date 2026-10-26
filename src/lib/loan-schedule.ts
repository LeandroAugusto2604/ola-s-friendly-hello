export interface ScheduleInstallment {
  amount: number | string;
  amount_paid?: number | string | null;
  status?: string | null;
  paid?: boolean | null;
}

/**
 * Principal still owed and the next installment due (principal + interest on the
 * current balance). Interest-only payments do not reduce the principal.
 */
export function loanSummary(originalAmount: number, ratePercent: number, installments: ScheduleInstallment[]) {
  const rate = ratePercent / 100;
  let balance = originalAmount;
  let credit = 0;
  for (const inst of installments) {
    const instAmount = Number(inst.amount);
    const instPaid = Number(inst.amount_paid || 0);
    const effectivePrincipal = Math.max(instAmount - credit, 0);
    credit = Math.max(credit - instAmount, 0);
    const juros = balance * rate;
    const settled = (inst.status || (inst.paid ? "liquidado" : "pendente")) === "liquidado";
    if (!settled) {
      const principalPaid = Math.max(instPaid - juros, 0);
      const outstanding = Math.max(balance - principalPaid, 0);
      const nextPrincipal = Math.max(effectivePrincipal - principalPaid, 0);
      const nextInterest = instPaid >= juros ? 0 : juros - instPaid;
      return { outstanding, nextPrincipal, nextInterest, nextTotal: nextPrincipal + nextInterest };
    }
    const overpayment = Math.max(instPaid - (effectivePrincipal + juros), 0);
    credit += overpayment;
    balance = Math.max(balance - effectivePrincipal - overpayment, 0);
  }
  return { outstanding: 0, nextPrincipal: 0, nextInterest: 0, nextTotal: 0 };
}
