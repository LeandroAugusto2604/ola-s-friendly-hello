import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { toast } from "@/hooks/use-toast";
import { CalendarIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const editLoanSchema = z.object({
  amount: z.string().refine((val) => parseFloat(val) > 0, "Valor deve ser maior que 0"),
  interestRate: z.string().refine((val) => parseFloat(val) >= 0 && parseFloat(val) <= 100, "Juros deve ser entre 0% e 100%"),
  installmentsCount: z.string().refine((val) => parseInt(val) >= 1 && parseInt(val) <= 48, "Parcelas deve ser entre 1 e 48"),
  dailyLateFee: z.string().refine((val) => parseFloat(val) >= 0, "Valor deve ser >= 0"),
  firstDueDate: z.date({ required_error: "Selecione a data do primeiro vencimento" }),
});

type EditLoanFormData = z.infer<typeof editLoanSchema>;

interface InstallmentData {
  id: string;
  due_date: string;
  installment_number: number;
  amount: number;
  paid: boolean;
  paid_at: string | null;
}

interface LoanData {
  id: string;
  original_amount: number;
  amount: number;
  interest_rate: number;
  daily_late_fee: number;
  installments_count: number;
  installments: InstallmentData[];
}

interface EditLoanDialogProps {
  loan: LoanData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditLoanDialog({ loan, open, onOpenChange, onSuccess }: EditLoanDialogProps) {
  const [saving, setSaving] = useState(false);

  const paidInstallments = loan.installments.filter((i) => i.paid);
  const paidTotal = paidInstallments.reduce((sum, i) => sum + Number(i.amount), 0);
  const paidCount = paidInstallments.length;

  const firstUnpaid = loan.installments
    .filter((i) => !i.paid)
    .sort((a, b) => a.installment_number - b.installment_number)[0];
  const firstUnpaidDate = firstUnpaid
    ? new Date(firstUnpaid.due_date + "T00:00:00")
    : new Date();

  const form = useForm<EditLoanFormData>({
    resolver: zodResolver(editLoanSchema),
    defaultValues: {
      amount: String(loan.original_amount),
      interestRate: String(loan.interest_rate || 0),
      installmentsCount: String(loan.installments_count),
      dailyLateFee: String(loan.daily_late_fee || 0),
      firstDueDate: firstUnpaidDate,
    },
  });

  useEffect(() => {
    if (open) {
      const fu = loan.installments
        .filter((i) => !i.paid)
        .sort((a, b) => a.installment_number - b.installment_number)[0];
      form.reset({
        amount: String(loan.original_amount),
        interestRate: String(loan.interest_rate || 0),
        installmentsCount: String(loan.installments_count),
        dailyLateFee: String(loan.daily_late_fee || 0),
        firstDueDate: fu ? new Date(fu.due_date + "T00:00:00") : new Date(),
      });
    }
  }, [open, loan]);

  // Live preview
  const watchedAmount = form.watch("amount");
  const watchedInterest = form.watch("interestRate");
  const watchedInstallments = form.watch("installmentsCount");

  const previewTotal = (() => {
    const amt = parseFloat(watchedAmount) || 0;
    const rate = parseFloat(watchedInterest) || 0;
    return amt * (1 + rate / 100);
  })();

  const newTotalCount = parseInt(watchedInstallments) || 1;
  const remainingCount = Math.max(newTotalCount - paidCount, 1);
  const remainingAmount = Math.max(previewTotal - paidTotal, 0);
  const previewNewInstallmentValue = remainingAmount / remainingCount;

  const onSubmit = async (data: EditLoanFormData) => {
    setSaving(true);
    try {
      const originalAmount = parseFloat(data.amount);
      const interestRate = parseFloat(data.interestRate);
      const installmentsCount = parseInt(data.installmentsCount);
      const dailyLateFee = parseFloat(data.dailyLateFee);
      const totalWithInterest = originalAmount * (1 + interestRate / 100);

      if (installmentsCount < paidCount) {
        toast({
          title: "Erro",
          description: `Já existem ${paidCount} parcela(s) paga(s). O total de parcelas deve ser pelo menos ${paidCount}.`,
          variant: "destructive",
        });
        setSaving(false);
        return;
      }

      const unpaidCount = installmentsCount - paidCount;
      const unpaidTotal = Math.max(totalWithInterest - paidTotal, 0);
      const newInstallmentAmount = unpaidCount > 0 ? unpaidTotal / unpaidCount : 0;

      // 1. Update the loan
      const { error: loanError } = await supabase
        .from("loans")
        .update({
          original_amount: originalAmount,
          amount: totalWithInterest,
          interest_rate: interestRate,
          installments_count: installmentsCount,
          daily_late_fee: dailyLateFee,
        })
        .eq("id", loan.id);

      if (loanError) throw loanError;

      // 2. Delete only UNPAID installments
      const unpaidIds = loan.installments.filter((i) => !i.paid).map((i) => i.id);
      if (unpaidIds.length > 0) {
        const { error: deleteError } = await supabase
          .from("installments")
          .delete()
          .in("id", unpaidIds);

        if (deleteError) throw deleteError;
      }

      // 3. Generate new unpaid installments
      if (unpaidCount > 0) {
        const newFirstDueDate = data.firstDueDate;
        const installments = Array.from({ length: unpaidCount }, (_, i) => {
          const dueDate = new Date(newFirstDueDate);
          dueDate.setMonth(dueDate.getMonth() + i);
          return {
            loan_id: loan.id,
            installment_number: paidCount + i + 1,
            amount: parseFloat(newInstallmentAmount.toFixed(2)),
            due_date: dueDate.toISOString().split("T")[0],
          };
        });

        const { error: installmentsError } = await supabase
          .from("installments")
          .insert(installments);

        if (installmentsError) throw installmentsError;
      }

      toast({
        title: "Empréstimo atualizado!",
        description: `${paidCount} parcela(s) paga(s) mantidas. ${unpaidCount} nova(s) parcela(s) de R$ ${newInstallmentAmount.toFixed(2)}`,
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
          <DialogTitle>Editar Empréstimo</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor do Empréstimo (R$)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" min="0" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="interestRate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Taxa de Juros (%)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.1" min="0" max="100" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="installmentsCount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantidade Total de Parcelas</FormLabel>
                  <FormControl>
                    <Input type="number" min={paidCount || 1} max="48" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="dailyLateFee"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Multa Diária por Atraso (R$)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" min="0" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="firstDueDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vencimento da Próxima Parcela</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value
                            ? format(field.value, "dd/MM/yyyy", { locale: ptBR })
                            : "Selecione a data"}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        locale={ptBR}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Live preview */}
            <div className="rounded-lg border border-border bg-muted/50 p-3 text-sm space-y-1">
              <p className="text-muted-foreground">
                <strong>Valor total com juros:</strong>{" "}
                <span className="text-foreground">R$ {previewTotal.toFixed(2)}</span>
              </p>
              {paidCount > 0 && (
                <>
                  <p className="text-muted-foreground">
                    <strong>Já pago:</strong>{" "}
                    <span className="text-foreground">
                      {paidCount} parcela(s) = R$ {paidTotal.toFixed(2)}
                    </span>
                  </p>
                  <p className="text-muted-foreground">
                    <strong>Restante:</strong>{" "}
                    <span className="text-foreground">R$ {remainingAmount.toFixed(2)}</span>
                  </p>
                </>
              )}
              <p className="text-muted-foreground">
                <strong>Novas parcelas:</strong>{" "}
                <span className="text-foreground">
                  {remainingCount}x de R$ {previewNewInstallmentValue.toFixed(2)}
                </span>
              </p>
            </div>

            {paidCount > 0 && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm text-primary">
                ✅ {paidCount} parcela(s) já paga(s) serão mantidas. Apenas as parcelas pendentes serão recalculadas.
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
