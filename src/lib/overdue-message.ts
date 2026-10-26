export interface OverdueChargeItem {
  number: number;
  dueDate: string;
  principal: number;
  interest: number;
}

export function formatOverdueDate(d: string) {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

export function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function buildOverdueWhatsAppMessage(clientName: string, items: OverdueChargeItem[]): string {
  const lines: string[] = [`Olá, ${clientName}! Identificamos parcela(s) em atraso:`, ""];
  for (const item of items) {
    lines.push(
      `• Parcela ${item.number} — venc. ${formatOverdueDate(item.dueDate)}`,
      `Parcela: ${formatBRL(item.principal)}`,
      `Juros: ${formatBRL(item.interest)}`,
      `Total: ${formatBRL(item.principal + item.interest)}`,
      ""
    );
  }
  const total = items.reduce((s, i) => s + i.principal + i.interest, 0);
  lines.push(`Total em atraso: ${formatBRL(total)}`, "Por favor, regularize o pagamento.");
  return lines.join("\n");
}
