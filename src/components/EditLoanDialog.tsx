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

interface LoanData {
  id: string;
  original_amount: number;
  amount: number;
  interest_rate: number;
  daily_late_fee: number;
  installments_count: number;
  installments: {
    id: string;
    due_date: string;
    installment_number: number;
  }[];
}

interface EditLoanDialogProps {
  loan: LoanData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditLoanDialog({ loan, open, onOpenChange, onSuccess }: EditLoanDialogProps) {
  const [saving, setSaving] = useState(false);

  // Get first installment due date
  const firstInstallment = loan.installments.find((i) => i.installment_number === 1);
  const firstDueDate = firstInstallment
    ? new Date(firstInstallment.due_date + "T00:00:00")
    : new Date();

  const form = useForm<EditLoanFormData>({
    resolver: zodResolver(editLoanSchema),
    defaultValues: {
      amount: String(loan.original_amount),
      interestRate: String(loan.interest_rate || 0),
      installmentsCount: String(loan.installments_count),
      dailyLateFee: String(loan.daily_late_fee || 0),
      firstDueDate,
    },
  });

  useEffect(() => {
    if (open) {
      const fdi = loan.installments.find((i) => i.installment_number === 1);
      form.reset({
        amount: String(loan.original_amount),
        interestRate: String(loan.interest_rate || 0),
        installmentsCount: String(loan.installments_count),
        dailyLateFee: String(loan.daily_late_fee || 0),
        firstDueDate: fdi ? new Date(fdi.due_date + "T00:00:00") : new Date(),
      });
    }
  }, [open, loan]);

  // Live preview of recalculated values
  const watchedAmount = form.watch("amount");
  const watchedInterest = form.watch("interestRate");
  const watchedInstallments = form.watch("installmentsCount");

  const previewTotal = (() => {
    const amt = parseFloat(watchedAmount) || 0;
    const rate = parseFloat(watchedInterest) || 0;
    return amt * (1 + rate / 100);
  })();

  const previewInstallmentValue = (() => {
    const count = parseInt(watchedInstallments) || 1;
    return previewTotal / count;
  })();

  const onSubmit = async (data: EditLoanFormData) => {
    setSaving(true);
    try {
      const originalAmount = parseFloat(data.amount);
      const interestRate = parseFloat(data.interestRate);
      const installmentsCount = parseInt(data.installmentsCount);
      const dailyLateFee = parseFloat(data.dailyLateFee);
      const totalWithInterest = originalAmount * (1 + interestRate / 100);

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

      // 2. Delete old installments
      const { error: deleteError } = await supabase
        .from("installments")
        .delete()
        .eq("loan_id", loan.id);

      if (deleteError) throw deleteError;

      // 3. Generate new installments
      const installmentAmount = totalWithInterest / installmentsCount;
      const newFirstDueDate = data.firstDueDate;

      const installments = Array.from({ length: installmentsCount }, (_, i) => {
        const dueDate = new Date(newFirstDueDate);
        dueDate.setMonth(dueDate.getMonth() + i);
        return {
          loan_id: loan.id,
          installment_number: i + 1,
          amount: parseFloat(installmentAmount.toFixed(2)),
          due_date: dueDate.toISOString().split("T")[0],
        };
      });

      const { error: installmentsError } = await supabase
        .from("installments")
        .insert(installments);

      if (installmentsError) throw installmentsError;

      toast({
        title: "Empréstimo atualizado!",
        description: `${installmentsCount}x de R$ ${installmentAmount.toFixed(2)} = R$ ${totalWithInterest.toFixed(2)}`,
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
                  <FormLabel>Quantidade de Parcelas</FormLabel>
                  <FormControl>
                    <Input type="number" min="1" max="48" {...field} />
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
                  <FormLabel>Data do Primeiro Vencimento</FormLabel>
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
                <strong>Valor total:</strong>{" "}
                <span className="text-foreground">
                  R$ {previewTotal.toFixed(2)}
                </span>
              </p>
              <p className="text-muted-foreground">
                <strong>Parcela:</strong>{" "}
                <span className="text-foreground">
                  {watchedInstallments}x de R$ {previewInstallmentValue.toFixed(2)}
                </span>
              </p>
            </div>

            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              ⚠️ Ao salvar, todas as parcelas serão recriadas e o histórico de pagamentos será perdido.
            </div>

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
