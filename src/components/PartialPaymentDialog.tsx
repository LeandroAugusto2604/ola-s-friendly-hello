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
import { Loader2, ArrowRight } from "lucide-react";
import { addDays, format } from "date-fns";

interface PartialPaymentDialogProps {
  installmentId: string;
  installmentNumber: number;
  installmentAmount: number;
  amountPaid: number;
  interestRate: number;
  loanBalanceBefore: number;
  loanId: string;
  lastInstallmentNumber: number;
  lastDueDate: string;
  currentInstallmentDueDate: string;
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
  loanId,
  lastInstallmentNumber,
  lastDueDate,
  currentInstallmentDueDate,
  open,
  onOpenChange,
  onSuccess,
}: PartialPaymentDialogProps) {
  const [paymentValue, setPaymentValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingInterestOnly, setSavingInterestOnly] = useState(false);

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

  const handlePayInterestOnly = async () => {
    if (interestRate <= 0 || interestOnLoanBalance <= 0) return;

    setSavingInterestOnly(true);
    try {
      // 1. Mark current installment as paid (interest-only) and zero out the amount
      // since the principal is being moved to a new installment at the end
      const { error: updateError } = await supabase
        .from("installments")
        .update({
          amount: 0,
          amount_paid: parseFloat(interestOnLoanBalance.toFixed(2)),
          paid: true,
          paid_at: new Date().toISOString(),
          status: "liquidado",
        } as any)
        .eq("id", installmentId);

      if (updateError) throw updateError;

      // 2. Create a new installment for the NEXT MONTH after the current one
      const currentDueDate = new Date(currentInstallmentDueDate + "T00:00:00");
      const newDueDate = addDays(currentDueDate, 30);
      const newInstallmentNumber = installmentNumber + 1;

      // 2a. Shift all installments after current one up by 1
      const { error: shiftError } = await supabase.rpc("increment_installment_numbers" as any, {
        _loan_id: loanId,
        _after_number: installmentNumber,
      });

      // If RPC doesn't exist, do it manually
      if (shiftError) {
        // Fetch all installments after current, shift them
        const { data: laterInstallments } = await supabase
          .from("installments")
          .select("id, installment_number")
          .eq("loan_id", loanId)
          .gt("installment_number", installmentNumber)
          .order("installment_number", { ascending: false });

        if (laterInstallments) {
          for (const inst of laterInstallments) {
            await supabase
              .from("installments")
              .update({ installment_number: inst.installment_number + 1 } as any)
              .eq("id", inst.id);
          }
        }
      }

      const { error: insertError } = await supabase
        .from("installments")
        .insert({
          loan_id: loanId,
          installment_number: newInstallmentNumber,
          amount: installmentAmount,
          due_date: format(newDueDate, "yyyy-MM-dd"),
          paid: false,
          amount_paid: 0,
          status: "pendente",
        } as any);

      if (insertError) throw insertError;

      // 3. Update loan installments_count
      const { error: loanError } = await supabase
        .from("loans")
        .update({ installments_count: lastInstallmentNumber + 1 } as any)
        .eq("id", loanId);

      if (loanError) throw loanError;

      toast({
        title: "Juros pagos!",
        description: `${formatCurrency(interestOnLoanBalance)} de juros pago. Nova parcela de ${formatCurrency(installmentAmount)} criada para o próximo mês.`,
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
      setSavingInterestOnly(false);
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
                  <span className="text-muted-foreground">Saldo devedor do empréstimo:</span>
                  <span className="font-semibold">{formatCurrency(loanBalanceBefore)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Juros mensal ({interestRate}%) sobre saldo:</span>
                  <span className="font-semibold text-amber-600">{formatCurrency(interestOnLoanBalance)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total com juros:</span>
                  <span className="font-bold">{formatCurrency(totalDue)}</span>
                </div>
              </>
            )}
          </div>

          {/* Pay interest only button */}
          {interestRate > 0 && interestOnLoanBalance > 0 && amountPaid === 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
              <div className="text-sm">
                <p className="font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-2">
                  <ArrowRight className="h-4 w-4" />
                  Pagar apenas os juros
                </p>
                <p className="text-muted-foreground mt-1">
                  Pague somente {formatCurrency(interestOnLoanBalance)} de juros. 
                  Uma nova parcela de {formatCurrency(installmentAmount)} será criada para o próximo mês.
                </p>
              </div>
              <Button
                variant="outline"
                className="w-full border-amber-500/50 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
                onClick={handlePayInterestOnly}
                disabled={savingInterestOnly}
              >
                {savingInterestOnly && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Pagar só juros ({formatCurrency(interestOnLoanBalance)})
              </Button>
            </div>
          )}

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
