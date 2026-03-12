import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface AdvancePaymentDialogProps {
  loanId: string;
  originalAmount: number;
  totalPaid: number;
  interestRate: number;
  installments: {
    id: string;
    installment_number: number;
    amount: number;
    amount_paid: number;
    status: string;
    paid: boolean;
  }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AdvancePaymentDialog({
  loanId,
  originalAmount,
  totalPaid,
  interestRate,
  installments,
  open,
  onOpenChange,
  onSuccess,
}: AdvancePaymentDialogProps) {
  const [advanceValue, setAdvanceValue] = useState("");
  const [saving, setSaving] = useState(false);

  const remainingBalance = Math.max(originalAmount - totalPaid, 0);
  const interestOnRemaining = remainingBalance * (interestRate / 100);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const handleSubmit = async () => {
    const value = parseFloat(advanceValue);
    if (!value || value <= 0) {
      toast({ title: "Erro", description: "Informe um valor válido", variant: "destructive" });
      return;
    }
    if (value > remainingBalance + 0.01) {
      toast({ title: "Erro", description: "O valor excede o saldo devedor", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      // Distribute the advance payment across pending installments in order
      let remaining = value;
      const pendingInstallments = installments
        .filter((i) => !i.paid && i.status !== "liquidado")
        .sort((a, b) => a.installment_number - b.installment_number);

      for (const inst of pendingInstallments) {
        if (remaining <= 0) break;

        const instRemaining = Math.max(inst.amount - inst.amount_paid, 0);
        if (instRemaining <= 0) continue;

        const payAmount = Math.min(remaining, instRemaining);
        const newAmountPaid = inst.amount_paid + payAmount;
        const isFullyPaid = newAmountPaid >= inst.amount - 0.01;

        const { error } = await supabase
          .from("installments")
          .update({
            amount_paid: parseFloat(newAmountPaid.toFixed(2)),
            paid: isFullyPaid,
            paid_at: isFullyPaid ? new Date().toISOString() : null,
            status: isFullyPaid ? "liquidado" : "parcial",
          } as any)
          .eq("id", inst.id);

        if (error) throw error;
        remaining -= payAmount;
      }

      const newTotalPaid = totalPaid + value;
      const newRemainingBalance = Math.max(originalAmount - newTotalPaid, 0);
      const newInterest = newRemainingBalance * (interestRate / 100);

      toast({
        title: "Adiantamento registrado!",
        description: `${formatCurrency(value)} abatido do saldo. Novo saldo: ${formatCurrency(newRemainingBalance)}. Juros sobre novo saldo: ${formatCurrency(newInterest)}`,
      });

      setAdvanceValue("");
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast({
        title: "Erro ao registrar",
        description: error?.message || "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adiantamento / Amortização Extra</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Valor emprestado:</span>
              <span className="font-semibold">{formatCurrency(originalAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total já pago:</span>
              <span className="font-semibold text-emerald-600">{formatCurrency(totalPaid)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Saldo devedor:</span>
              <span className="font-bold text-destructive">{formatCurrency(remainingBalance)}</span>
            </div>
            {interestRate > 0 && (
              <>
                <div className="border-t border-border pt-2 mt-2" />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Juros mensal ({interestRate}%) sobre saldo:</span>
                  <span className="font-semibold text-amber-600">{formatCurrency(interestOnRemaining)}</span>
                </div>
              </>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Valor do Adiantamento (R$)</label>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={advanceValue}
              onChange={(e) => setAdvanceValue(e.target.value)}
            />
            <div className="flex gap-2 flex-wrap">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => setAdvanceValue(remainingBalance.toFixed(2))}
              >
                Quitar tudo ({formatCurrency(remainingBalance)})
              </Button>
            </div>
            {advanceValue && parseFloat(advanceValue) > 0 && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm space-y-1">
                <p className="text-muted-foreground">
                  Após adiantamento de <strong>{formatCurrency(parseFloat(advanceValue))}</strong>:
                </p>
                <p className="font-semibold">
                  Novo saldo: {formatCurrency(Math.max(remainingBalance - parseFloat(advanceValue), 0))}
                </p>
                {interestRate > 0 && (
                  <p className="text-amber-600 font-medium">
                    Novos juros mensais: {formatCurrency(Math.max(remainingBalance - parseFloat(advanceValue), 0) * (interestRate / 100))}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Registrar Adiantamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
