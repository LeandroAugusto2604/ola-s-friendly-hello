import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface InstallmentInfo {
  id: string;
  installment_number: number;
  amount: number;
  due_date: string;
  amount_paid: number;
  status: string;
}

interface EditInstallmentDialogProps {
  installment: InstallmentInfo;
  loanId: string;
  originalAmount: number;
  interestRate: number;
  allInstallments: InstallmentInfo[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditInstallmentDialog({
  installment,
  loanId,
  originalAmount,
  interestRate,
  allInstallments,
  open,
  onOpenChange,
  onSuccess,
}: EditInstallmentDialogProps) {
  const [amount, setAmount] = useState(String(installment.amount));
  const [dueDate, setDueDate] = useState<Date>(
    new Date(installment.due_date + "T00:00:00")
  );
  const [saving, setSaving] = useState(false);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  // Calculate how much principal is already committed by paid installments and other pending ones (excluding this one)
  const paidPrincipal = allInstallments
    .filter(i => (i.status === "liquidado" || i.status === "parcial") && i.id !== installment.id)
    .reduce((sum, i) => sum + Number(i.amount), 0);

  const otherPendingPrincipal = allInstallments
    .filter(i => i.status !== "liquidado" && i.id !== installment.id)
    .reduce((sum, i) => sum + Number(i.amount), 0);

  const maxAllowed = originalAmount - paidPrincipal;

  const newAmount = parseFloat(amount) || 0;
  const remainingAfterEdit = Math.max(originalAmount - paidPrincipal - newAmount, 0);
  const otherPendingInstallments = allInstallments
    .filter(i => i.status !== "liquidado" && i.id !== installment.id && i.installment_number > installment.installment_number)
    .sort((a, b) => a.installment_number - b.installment_number);

  const handleSave = async () => {
    if (!newAmount || newAmount <= 0) {
      toast({ title: "Erro", description: "Informe um valor válido", variant: "destructive" });
      return;
    }

    if (newAmount > maxAllowed) {
      toast({ title: "Erro", description: `Valor máximo permitido: ${formatCurrency(maxAllowed)}`, variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      // 1. Update the edited installment
      const { error } = await supabase
        .from("installments")
        .update({
          amount: parseFloat(newAmount.toFixed(2)),
          due_date: format(dueDate, "yyyy-MM-dd"),
        } as any)
        .eq("id", installment.id);

      if (error) throw error;

      // 2. Redistribute remaining principal among subsequent pending installments
      if (otherPendingInstallments.length > 0) {
        const eachAmount = parseFloat((remainingAfterEdit / otherPendingInstallments.length).toFixed(2));
        
        // Adjust for rounding: last installment gets the remainder
        for (let i = 0; i < otherPendingInstallments.length; i++) {
          const inst = otherPendingInstallments[i];
          let newInstAmount = eachAmount;
          if (i === otherPendingInstallments.length - 1) {
            // Last one gets the remainder to avoid rounding issues
            newInstAmount = parseFloat((remainingAfterEdit - eachAmount * (otherPendingInstallments.length - 1)).toFixed(2));
          }
          
          const { error: updateError } = await supabase
            .from("installments")
            .update({ amount: newInstAmount } as any)
            .eq("id", inst.id);

          if (updateError) throw updateError;
        }
      } else if (remainingAfterEdit > 0 && otherPendingInstallments.length === 0) {
        // No more pending installments but there's remaining principal - warn user
        toast({
          title: "Atenção",
          description: `Ainda resta ${formatCurrency(remainingAfterEdit)} de principal sem parcela. Considere adicionar uma nova parcela.`,
          variant: "destructive",
        });
      }

      toast({
        title: "Parcela atualizada!",
        description: `Parcela ${installment.installment_number} alterada para ${formatCurrency(newAmount)}. Demais parcelas recalculadas.`,
      });
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
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
          <DialogTitle>Editar Parcela {installment.installment_number}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Valor da Parcela (R$)</label>
            <Input
              type="number"
              step="0.01"
              min="0"
              max={maxAllowed}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Máximo: {formatCurrency(maxAllowed)} (valor original: {formatCurrency(originalAmount)})
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Data de Vencimento</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full pl-3 text-left font-normal",
                    !dueDate && "text-muted-foreground"
                  )}
                >
                  {dueDate
                    ? format(dueDate, "dd/MM/yyyy", { locale: ptBR })
                    : "Selecione a data"}
                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dueDate}
                  onSelect={(date) => date && setDueDate(date)}
                  locale={ptBR}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {newAmount > 0 && otherPendingInstallments.length > 0 && (
            <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3 text-sm text-blue-700 dark:text-blue-400 space-y-1">
              <p>📊 <strong>Simulação:</strong></p>
              <p>Restante do principal: {formatCurrency(remainingAfterEdit)}</p>
              <p>Dividido em {otherPendingInstallments.length} parcela(s): {formatCurrency(remainingAfterEdit / otherPendingInstallments.length)} cada</p>
            </div>
          )}

          {installment.amount_paid > 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-700 dark:text-amber-400">
              ⚠️ Esta parcela já possui {formatCurrency(installment.amount_paid)} pago.
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
