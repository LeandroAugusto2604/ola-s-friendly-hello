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

interface PartialPaymentDialogProps {
  installmentId: string;
  installmentNumber: number;
  installmentAmount: number;
  amountPaid: number;
  interestRate: number;
  loanBalanceBefore: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function PartialPaymentDialog({
  installmentId,
  installmentNumber,
  installmentAmount,
  amountPaid,
  interestRate,
  loanBalanceBefore,
  open,
  onOpenChange,
  onSuccess,
}: PartialPaymentDialogProps) {
  const [paymentValue, setPaymentValue] = useState("");
  const [saving, setSaving] = useState(false);

  const remainingBalance = installmentAmount - amountPaid;
  const interestOnLoanBalance = loanBalanceBefore * (interestRate / 100);
  const totalDue = remainingBalance + interestOnLoanBalance;

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const handleSubmit = async () => {
    const value = parseFloat(paymentValue);
    if (!value || value <= 0) {
      toast({ title: "Erro", description: "Informe um valor válido", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const newAmountPaid = amountPaid + value;
      const isFullyPaid = newAmountPaid >= installmentAmount - 0.01;
      const newStatus = isFullyPaid ? "liquidado" : "parcial";

      const { error } = await supabase
        .from("installments")
        .update({
          amount_paid: parseFloat(newAmountPaid.toFixed(2)),
          paid: isFullyPaid,
          paid_at: isFullyPaid ? new Date().toISOString() : null,
          status: newStatus,
        } as any)
        .eq("id", installmentId);

      if (error) throw error;

      toast({
        title: isFullyPaid ? "Parcela liquidada!" : "Pagamento parcial registrado!",
        description: `${formatCurrency(value)} pago na parcela ${installmentNumber}. ${isFullyPaid ? "" : `Restante: ${formatCurrency(installmentAmount - newAmountPaid)}`}`,
      });
      setPaymentValue("");
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
          <DialogTitle>Pagamento - Parcela {installmentNumber}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Valor da parcela:</span>
              <span className="font-semibold">{formatCurrency(installmentAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Já pago:</span>
              <span className="font-semibold text-emerald-600">{formatCurrency(amountPaid)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Saldo devedor:</span>
              <span className="font-semibold text-destructive">{formatCurrency(remainingBalance)}</span>
            </div>
            {interestRate > 0 && (
              <>
                <div className="border-t border-border pt-2 mt-2" />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Juros mensal ({interestRate}%):</span>
                  <span className="font-semibold text-amber-600">{formatCurrency(monthlyInterestOnRemaining)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total com juros:</span>
                  <span className="font-bold">{formatCurrency(totalDue)}</span>
                </div>
              </>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Valor Pago/Adiantado (R$)</label>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={paymentValue}
              onChange={(e) => setPaymentValue(e.target.value)}
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => setPaymentValue(remainingBalance.toFixed(2))}
              >
                Pagar saldo ({formatCurrency(remainingBalance)})
              </Button>
              {interestRate > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => setPaymentValue(totalDue.toFixed(2))}
                >
                  Pagar total + juros ({formatCurrency(totalDue)})
                </Button>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Registrar Pagamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
