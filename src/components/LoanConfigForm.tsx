import { useState } from "react";
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { CalendarIcon, Loader2, ArrowLeft, CheckCircle } from "lucide-react";

const loanSchema = z.object({
  amount: z.string().refine((val) => parseFloat(val) > 0, "Valor deve ser maior que 0"),
  interestRate: z.string().refine((val) => parseFloat(val) >= 0 && parseFloat(val) <= 100, "Juros deve ser entre 0% e 100%"),
  installmentsCount: z.string().refine((val) => parseInt(val) >= 1 && parseInt(val) <= 48, "Parcelas deve ser entre 1 e 48"),
  dailyLateFee: z.string().refine((val) => parseFloat(val) >= 0, "Valor deve ser >= 0"),
  firstDueDate: z.date({ required_error: "Selecione a data do primeiro vencimento" }),
});

type LoanFormData = z.infer<typeof loanSchema>;

interface LoanConfigFormProps {
  clientId: string;
  clientName: string;
  onSuccess: () => void;
  onBack: () => void;
}

export function LoanConfigForm({ clientId, clientName, onSuccess, onBack }: LoanConfigFormProps) {
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<LoanFormData>({
    resolver: zodResolver(loanSchema),
    defaultValues: {
      amount: "",
      interestRate: "0",
      installmentsCount: "12",
      dailyLateFee: "0",
      firstDueDate: undefined,
    },
  });

  // Live preview with interest on remaining balance
  const watchedAmount = parseFloat(form.watch("amount")) || 0;
  const watchedInterest = parseFloat(form.watch("interestRate")) || 0;
  const watchedInstallments = parseInt(form.watch("installmentsCount")) || 1;

  // Calculate with interest on remaining balance (declining balance)
  const calculateInstallments = (principal: number, monthlyRate: number, numInstallments: number) => {
    const basePortion = principal / numInstallments;
    const rate = monthlyRate / 100;
    let balance = principal;
    const schedule = [];

    for (let i = 0; i < numInstallments; i++) {
      const interest = balance * rate;
      const installmentTotal = basePortion + interest;
      balance = Math.max(balance - basePortion, 0);

      schedule.push({
        number: i + 1,
        installment: installmentTotal,
        interest,
        amortization: basePortion,
        balance,
      });
    }

    const totalInterest = schedule.reduce((s, r) => s + r.interest, 0);
    const totalWithInterest = principal + totalInterest;

    return {
      installmentValue: basePortion,
      totalWithInterest,
      totalInterest,
      schedule,
    };
  };

  const preview = calculateInstallments(watchedAmount, watchedInterest, watchedInstallments);

  const onSubmit = async (data: LoanFormData) => {
    setIsLoading(true);
    try {
      const amount = parseFloat(data.amount);
      const interestRate = parseFloat(data.interestRate);
      const installmentsCount = parseInt(data.installmentsCount);
      const dailyLateFee = parseFloat(data.dailyLateFee);

      const calc = calculateInstallments(amount, interestRate, installmentsCount);

      const { data: loan, error: loanError } = await supabase
        .from("loans")
        .insert({
          client_id: clientId,
          original_amount: amount,
          amount: calc.totalWithInterest,
          interest_rate: interestRate,
          installments_count: installmentsCount,
          daily_late_fee: dailyLateFee,
        } as any)
        .select()
        .single();

      if (loanError) throw loanError;

      // Generate installments with interest already included in each
      const firstDueDate = data.firstDueDate;
      const installments = calc.schedule.map((item, i) => {
        const dueDate = new Date(firstDueDate);
        dueDate.setMonth(dueDate.getMonth() + i);
        return {
          loan_id: loan.id,
          installment_number: item.number,
          amount: parseFloat(item.installment.toFixed(2)),
          due_date: dueDate.toISOString().split("T")[0],
        };
      });

      const { error: installmentsError } = await supabase
        .from("installments")
        .insert(installments);

      if (installmentsError) throw installmentsError;

      toast({
        title: "Empréstimo cadastrado!",
        description: `${installmentsCount}x de R$ ${calc.installmentValue.toFixed(2)} para ${clientName}. Total: R$ ${calc.totalWithInterest.toFixed(2)} (Juros: R$ ${calc.totalInterest.toFixed(2)})`,
      });

      form.reset();
      onSuccess();
    } catch (error: any) {
      console.error("Error creating loan:", error);
      toast({ title: "Erro ao cadastrar", description: error.message || "Tente novamente", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {/* Client info banner */}
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle className="h-4 w-4 text-primary" />
            <span className="text-muted-foreground">Cliente:</span>
            <strong className="text-foreground">{clientName}</strong>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onBack} className="gap-1 text-xs">
            <ArrowLeft className="h-3 w-3" />
            Trocar
          </Button>
        </div>

        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Valor do Empréstimo (R$)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" min="0" placeholder="1000.00" {...field} />
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
                <FormLabel>Taxa de Juros Mensal (%)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.1" min="0" max="100" placeholder="10" {...field} />
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
                  <Input type="number" min="1" max="48" placeholder="12" {...field} />
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
                  <Input type="number" step="0.01" min="0" placeholder="0.00" {...field} />
                </FormControl>
                <FormDescription>Valor cobrado por dia de atraso</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="firstDueDate"
            render={({ field }) => (
              <FormItem className="flex flex-col sm:col-span-2">
                <FormLabel>Data do Primeiro Vencimento</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                      >
                        {field.value ? format(field.value, "dd/MM/yyyy", { locale: ptBR }) : <span>Selecione a data</span>}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus locale={ptBR} className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
                <FormDescription>As demais parcelas terão vencimento mensal a partir desta data</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Live preview */}
        {watchedAmount > 0 && (
          <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-3">
            <h4 className="font-semibold text-sm text-foreground">📊 Simulação do Empréstimo</h4>
             <div className="grid grid-cols-2 gap-2 text-sm">
               <div className="text-muted-foreground">Valor principal:</div>
               <div className="text-foreground font-medium">R$ {watchedAmount.toFixed(2)}</div>
               
               <div className="text-muted-foreground">Total com juros:</div>
               <div className="text-foreground font-medium">R$ {preview.totalWithInterest.toFixed(2)}</div>
               
               <div className="text-muted-foreground">Total de juros:</div>
               <div className="text-foreground font-medium text-destructive">R$ {preview.totalInterest.toFixed(2)}</div>
               
               <div className="text-muted-foreground">Amortização por parcela:</div>
               <div className="text-foreground font-bold">R$ {preview.installmentValue.toFixed(2)}</div>
             </div>

            {/* Mini schedule */}
            {preview.schedule.length > 0 && watchedInterest > 0 && (
              <div className="mt-3 max-h-40 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="text-left py-1 px-1">#</th>
                      <th className="text-right py-1 px-1">Parcela</th>
                      <th className="text-right py-1 px-1">Juros</th>
                      <th className="text-right py-1 px-1">Amortização</th>
                      <th className="text-right py-1 px-1">Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.schedule.map((row) => (
                      <tr key={row.number} className="border-b border-border/50">
                        <td className="py-1 px-1">{row.number}</td>
                        <td className="text-right py-1 px-1">R$ {row.installment.toFixed(2)}</td>
                        <td className="text-right py-1 px-1 text-destructive">R$ {row.interest.toFixed(2)}</td>
                        <td className="text-right py-1 px-1">R$ {row.amortization.toFixed(2)}</td>
                        <td className="text-right py-1 px-1 font-medium">R$ {row.balance.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <Button type="submit" className="w-full h-12 gradient-primary border-0 shadow-soft hover:opacity-90 transition-smooth text-base gap-2" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Cadastrando...
            </>
          ) : (
            "Cadastrar Empréstimo"
          )}
        </Button>
      </form>
    </Form>
  );
}
