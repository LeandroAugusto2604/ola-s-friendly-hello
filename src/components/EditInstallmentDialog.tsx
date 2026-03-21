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
  const increase = Math.max(newAmount - installment.amount, 0);
  const remainingAfterEdit = Math.max(originalAmount - paidPrincipal - newAmount, 0);
  const otherPendingInstallments = allInstallments
    .filter(i => i.status !== "liquidado" && i.id !== installment.id && i.installment_number > installment.installment_number)
    .sort((a, b) => a.installment_number - b.installment_number);

  // Determine what happens to the next installment
  const nextInstallment = otherPendingInstallments[0] || null;
  const willDeleteNext = nextInstallment && increase > 0 && Math.abs(increase - nextInstallment.amount) < 0.01;
  const willSubtractNext = nextInstallment && increase > 0 && !willDeleteNext && increase < nextInstallment.amount;
  const nextNewAmount = willSubtractNext ? nextInstallment.amount - increase : 0;

  const handleSave = async () => {
    if (!newAmount || newAmount <= 0) {
      toast({ title: "Erro", description: "Informe um valor válido", variant: "destructive" });
      return;
    }

    if (newAmount > maxAllowed) {
      toast({ title: "Erro", description: `Valor máximo permitido: ${formatCurrency(maxAllowed)}`, variant: "destructive" });
      return;
    }

    if (increase > 0 && nextInstallment && increase > nextInstallment.amount) {
      toast({ title: "Erro", description: `O acréscimo (${formatCurrency(increase)}) não pode ser maior que a próxima parcela (${formatCurrency(nextInstallment.amount)})`, variant: "destructive" });
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

      // 2. Handle next installment based on the increase
      if (increase > 0 && nextInstallment) {
        if (willDeleteNext) {
          // Increase equals next installment amount → delete it
          const { error: deleteError } = await supabase
            .from("installments")
            .delete()
            .eq("id", nextInstallment.id);
          if (deleteError) throw deleteError;

          // Update installments_count on the loan
          const totalRemaining = allInstallments.length - 1;
          await supabase
            .from("loans")
            .update({ installments_count: totalRemaining } as any)
            .eq("id", loanId);

          // Renumber subsequent installments
          const toRenumber = otherPendingInstallments.slice(1);
          for (const inst of toRenumber) {
            await supabase
              .from("installments")
              .update({ installment_number: inst.installment_number - 1 } as any)
              .eq("id", inst.id);
          }
        } else if (willSubtractNext) {
          // Subtract the increase from next installment
          const { error: updateError } = await supabase
            .from("installments")
            .update({ amount: parseFloat(nextNewAmount.toFixed(2)) } as any)
            .eq("id", nextInstallment.id);
          if (updateError) throw updateError;
        }
      }

      toast({
        title: "Parcela atualizada!",
        description: willDeleteNext
          ? `Parcela ${installment.installment_number} alterada para ${formatCurrency(newAmount)}. Parcela ${nextInstallment!.installment_number} removida.`
          : willSubtractNext
          ? `Parcela ${installment.installment_number} alterada para ${formatCurrency(newAmount)}. Próxima parcela ajustada para ${formatCurrency(nextNewAmount)}.`
          : `Parcela ${installment.installment_number} alterada para ${formatCurrency(newAmount)}.`,
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
