import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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
import { CalendarIcon, Loader2, Search } from "lucide-react";

const formSchema = z.object({
  // Client fields
  fullName: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  address: z.string().min(5, "Endereço deve ter pelo menos 5 caracteres"),
  rg: z.string().min(5, "RG inválido"),
  cpf: z.string().regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$|^\d{11}$/, "CPF inválido"),
  phone: z.string().min(10, "Celular inválido").max(15, "Celular inválido"),
  // Loan fields
  amount: z.string().refine((val) => parseFloat(val) > 0, "Valor deve ser maior que 0"),
  interestRate: z.string().refine((val) => parseFloat(val) >= 0 && parseFloat(val) <= 100, "Juros deve ser entre 0% e 100%"),
  installmentsCount: z.string().refine((val) => parseInt(val) >= 1 && parseInt(val) <= 48, "Parcelas deve ser entre 1 e 48"),
  dailyLateFee: z.string().refine((val) => parseFloat(val) >= 0, "Valor deve ser >= 0"),
  firstDueDate: z.date({ required_error: "Selecione a data do primeiro vencimento" }),
});

type FormData = z.infer<typeof formSchema>;

interface LoanFormProps {
  onSuccess: () => void;
}

export function LoanForm({ onSuccess }: LoanFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [existingClientId, setExistingClientId] = useState<string | null>(null);
  const { user } = useAuth();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: "",
      address: "",
      rg: "",
      cpf: "",
      phone: "",
      amount: "",
      interestRate: "0",
      installmentsCount: "3",
      dailyLateFee: "0",
      firstDueDate: undefined,
    },
  });

  const formatCPF = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    return numbers
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})/, "$1-$2")
      .replace(/(-\d{2})\d+?$/, "$1");
  };

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    return numbers
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{5})(\d)/, "$1-$2")
      .replace(/(-\d{4})\d+?$/, "$1");
  };

  const searchByCPF = async () => {
    const cpf = form.getValues("cpf");
    if (!cpf || !user) return;
    const cpfClean = cpf.replace(/\D/g, "");
    if (cpfClean.length < 11) return;

    setIsSearching(true);
    try {
      const { data: existing } = await supabase
        .from("clients")
        .select("*")
        .eq("cpf", cpfClean)
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        setExistingClientId(existing.id);
        form.setValue("fullName", existing.full_name);
        form.setValue("address", existing.address);
        form.setValue("rg", existing.rg);
        form.setValue("phone", existing.phone || "");
        toast({ title: "Cliente encontrado!", description: `${existing.full_name} já está cadastrado. Dados preenchidos automaticamente.` });
      } else {
        setExistingClientId(null);
        toast({ title: "Cliente não encontrado", description: "Preencha os dados para cadastrar um novo cliente." });
      }
    } catch (error: any) {
      console.error(error);
    } finally {
      setIsSearching(false);
    }
  };

  // Interest on remaining balance calculation
  const watchedAmount = parseFloat(form.watch("amount")) || 0;
  const watchedInterest = parseFloat(form.watch("interestRate")) || 0;
  const watchedInstallments = parseInt(form.watch("installmentsCount")) || 1;

  const calculateSchedule = (principal: number, monthlyRatePercent: number, numInstallments: number) => {
    const basePortion = principal / numInstallments;
    const rate = monthlyRatePercent / 100;
    let balance = principal;
    const schedule = [];

    for (let i = 0; i < numInstallments; i++) {
      const interest = balance * rate;
      const installmentTotal = basePortion + interest;
      balance = Math.max(balance - basePortion, 0);

      schedule.push({
        number: i + 1,
        principal: basePortion,
        interest,
        total: installmentTotal,
        remainingBalance: balance,
      });
    }

    const totalInterest = schedule.reduce((s, r) => s + r.interest, 0);
    const totalAmount = principal + totalInterest;

    return { schedule, totalInterest, totalAmount };
  };

  const preview = calculateSchedule(watchedAmount, watchedInterest, watchedInstallments);

  const onSubmit = async (data: FormData) => {
    if (!user) {
      toast({ title: "Erro", description: "Você precisa estar logado", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      // 1. Get or create client
      let clientId = existingClientId;
      const cpfClean = data.cpf.replace(/\D/g, "");

      if (!clientId) {
        const { data: existing } = await supabase
          .from("clients")
          .select("id")
          .eq("cpf", cpfClean)
          .eq("user_id", user.id)
          .maybeSingle();

        if (existing) {
          clientId = existing.id;
        } else {
          const { data: newClient, error } = await supabase
            .from("clients")
            .insert({
              full_name: data.fullName,
              address: data.address,
              rg: data.rg,
              cpf: cpfClean,
              phone: data.phone.replace(/\D/g, ""),
              user_id: user.id,
            })
            .select()
            .single();
          if (error) throw error;
          clientId = newClient.id;
        }
      }

      // 2. Calculate schedule
      const amount = parseFloat(data.amount);
      const interestRate = parseFloat(data.interestRate);
      const installmentsCount = parseInt(data.installmentsCount);
      const dailyLateFee = parseFloat(data.dailyLateFee);
      const calc = calculateSchedule(amount, interestRate, installmentsCount);

      // 3. Create loan
      const { data: loan, error: loanError } = await supabase
        .from("loans")
        .insert({
          client_id: clientId,
          original_amount: amount,
          amount: calc.totalAmount,
          interest_rate: interestRate,
          installments_count: installmentsCount,
          daily_late_fee: dailyLateFee,
        } as any)
        .select()
        .single();

      if (loanError) throw loanError;

      // 4. Generate installments
      const firstDueDate = data.firstDueDate;
      const installments = calc.schedule.map((item, i) => {
        const dueDate = new Date(firstDueDate);
        dueDate.setMonth(dueDate.getMonth() + i);
        return {
          loan_id: loan.id,
          installment_number: item.number,
          amount: parseFloat(item.total.toFixed(2)),
          due_date: dueDate.toISOString().split("T")[0],
        };
      });

      const { error: installmentsError } = await supabase
        .from("installments")
        .insert(installments);

      if (installmentsError) throw installmentsError;

      toast({
        title: "Empréstimo cadastrado!",
        description: `${installmentsCount}x para ${data.fullName}. Total: R$ ${calc.totalAmount.toFixed(2)} (Juros: R$ ${calc.totalInterest.toFixed(2)})`,
      });

      form.reset();
      setExistingClientId(null);
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
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        {/* === CLIENT SECTION === */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">👤 Dados do Cliente</h3>
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
            💡 Digite o CPF e clique em buscar para verificar se o cliente já existe.
          </div>

          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="cpf"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CPF</FormLabel>
                  <div className="flex gap-2">
                    <FormControl>
                      <Input
                        placeholder="000.000.000-00"
                        {...field}
                        onChange={(e) => field.onChange(formatCPF(e.target.value))}
                        maxLength={14}
                      />
                    </FormControl>
                    <Button type="button" variant="outline" size="icon" onClick={searchByCPF} disabled={isSearching}>
                      {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField control={form.control} name="fullName" render={({ field }) => (
              <FormItem>
                <FormLabel>Nome Completo</FormLabel>
                <FormControl><Input placeholder="João da Silva" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="address" render={({ field }) => (
              <FormItem>
                <FormLabel>Endereço</FormLabel>
                <FormControl><Input placeholder="Rua, número, bairro, cidade" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="rg" render={({ field }) => (
              <FormItem>
                <FormLabel>RG</FormLabel>
                <FormControl><Input placeholder="00.000.000-0" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="phone" render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Celular</FormLabel>
                <FormControl>
                  <Input placeholder="(00) 00000-0000" {...field} onChange={(e) => field.onChange(formatPhone(e.target.value))} maxLength={15} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>
        </div>

        {/* === LOAN SECTION === */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">💰 Dados do Empréstimo</h3>

          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
            <FormField control={form.control} name="amount" render={({ field }) => (
              <FormItem>
                <FormLabel>Valor do Empréstimo (R$)</FormLabel>
                <FormControl><Input type="number" step="0.01" min="0" placeholder="10000.00" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="interestRate" render={({ field }) => (
              <FormItem>
                <FormLabel>Taxa de Juros Mensal (%)</FormLabel>
                <FormControl><Input type="number" step="0.1" min="0" max="100" placeholder="30" {...field} /></FormControl>
                <FormDescription>Juros calculado sobre o saldo restante</FormDescription>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="installmentsCount" render={({ field }) => (
              <FormItem>
                <FormLabel>Quantidade de Parcelas</FormLabel>
                <FormControl><Input type="number" min="1" max="48" placeholder="3" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="dailyLateFee" render={({ field }) => (
              <FormItem>
                <FormLabel>Multa Diária por Atraso (R$)</FormLabel>
                <FormControl><Input type="number" step="0.01" min="0" placeholder="0.00" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField
              control={form.control}
              name="firstDueDate"
              render={({ field }) => (
                <FormItem className="flex flex-col sm:col-span-2">
                  <FormLabel>Data do Primeiro Vencimento</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button variant="outline" className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                          {field.value ? format(field.value, "dd/MM/yyyy", { locale: ptBR }) : <span>Selecione a data</span>}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus locale={ptBR} className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                  <FormDescription>Parcelas mensais a partir desta data</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* === PREVIEW === */}
        {watchedAmount > 0 && (
          <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-3">
            <h4 className="font-semibold text-sm text-foreground">📊 Simulação — Juros sobre saldo restante</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-muted-foreground">Valor emprestado:</div>
              <div className="text-foreground font-medium">R$ {watchedAmount.toFixed(2)}</div>
              <div className="text-muted-foreground">Total de juros:</div>
              <div className="text-foreground font-medium text-destructive">R$ {preview.totalInterest.toFixed(2)}</div>
              <div className="text-muted-foreground">Total a receber:</div>
              <div className="text-foreground font-bold">R$ {preview.totalAmount.toFixed(2)}</div>
            </div>

            <div className="mt-3 max-h-48 overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left py-1 px-1">#</th>
                    <th className="text-right py-1 px-1">Principal</th>
                    <th className="text-right py-1 px-1">Juros</th>
                    <th className="text-right py-1 px-1">Total Parcela</th>
                    <th className="text-right py-1 px-1">Saldo Restante</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.schedule.map((row) => (
                    <tr key={row.number} className="border-b border-border/50">
                      <td className="py-1 px-1">{row.number}</td>
                      <td className="text-right py-1 px-1">R$ {row.principal.toFixed(2)}</td>
                      <td className="text-right py-1 px-1 text-destructive">R$ {row.interest.toFixed(2)}</td>
                      <td className="text-right py-1 px-1 font-medium">R$ {row.total.toFixed(2)}</td>
                      <td className="text-right py-1 px-1">R$ {row.remainingBalance.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <Button type="submit" className="w-full h-12 gradient-primary border-0 shadow-soft hover:opacity-90 transition-smooth text-base gap-2" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Cadastrando...
            </>
          ) : (
            "Cadastrar Cliente e Empréstimo"
          )}
        </Button>
      </form>
    </Form>
  );
}
