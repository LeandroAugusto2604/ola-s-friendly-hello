import { useState } from "react";
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
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { CalendarIcon, Loader2, ArrowLeft, CheckCircle, Plus, Trash2 } from "lucide-react";

interface PlannedInstallment {
  id: string;
  amount: string;
  dueDate: Date | undefined;
}

interface LoanConfigFormProps {
  clientId: string;
  clientName: string;
  onSuccess: () => void;
  onBack: () => void;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

export function LoanConfigForm({ clientId, clientName, onSuccess, onBack }: LoanConfigFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [loanAmount, setLoanAmount] = useState("");
  const [interestRate, setInterestRate] = useState("0");
  const [dailyLateFee, setDailyLateFee] = useState("0");
  const [installments, setInstallments] = useState<PlannedInstallment[]>([]);

  const amount = parseFloat(loanAmount) || 0;
  const rate = parseFloat(interestRate) || 0;

  // Calculate running balance and interest for each installment
  const getSchedule = () => {
    let balance = amount;
    return installments.map((inst) => {
      const instValue = parseFloat(inst.amount) || 0;
      const interestOnBalance = balance * (rate / 100);
      const totalPayment = instValue + interestOnBalance;
      balance = Math.max(balance - instValue, 0);
      return {
        ...inst,
        instValue,
        interestOnBalance,
        totalPayment,
        balanceAfter: balance,
      };
    });
  };

  const schedule = getSchedule();
  const totalAllocated = schedule.reduce((s, r) => s + r.instValue, 0);
  const remaining = Math.max(amount - totalAllocated, 0);
  const totalInterest = schedule.reduce((s, r) => s + r.interestOnBalance, 0);

  const addInstallment = () => {
    const suggestedValue = remaining > 0 ? remaining.toFixed(2) : "";
    setInstallments((prev) => [
      ...prev,
      { id: crypto.randomUUID(), amount: suggestedValue, dueDate: undefined },
    ]);
  };

  const updateInstallment = (id: string, field: keyof PlannedInstallment, value: any) => {
    setInstallments((prev) =>
      prev.map((inst) => (inst.id === id ? { ...inst, [field]: value } : inst))
    );
  };

  const removeInstallment = (id: string) => {
    setInstallments((prev) => prev.filter((inst) => inst.id !== id));
  };

  const canSave =
    amount > 0 &&
    installments.length > 0 &&
    Math.abs(totalAllocated - amount) < 0.02 &&
    installments.every((i) => (parseFloat(i.amount) || 0) > 0 && i.dueDate);

  const onSubmit = async () => {
    if (!canSave) return;
    setIsLoading(true);
    try {
      const totalWithInterest = amount + totalInterest;

      const { data: loan, error: loanError } = await supabase
        .from("loans")
        .insert({
          client_id: clientId,
          original_amount: amount,
          amount: totalWithInterest,
          interest_rate: rate,
          installments_count: installments.length,
          daily_late_fee: parseFloat(dailyLateFee) || 0,
        } as any)
        .select()
        .single();

      if (loanError) throw loanError;

      const installmentRows = schedule.map((item, i) => ({
        loan_id: loan.id,
        installment_number: i + 1,
        amount: parseFloat(item.instValue.toFixed(2)),
        due_date: item.dueDate!.toISOString().split("T")[0],
      }));

      const { error: instError } = await supabase
        .from("installments")
        .insert(installmentRows);

      if (instError) throw instError;

      toast({
        title: "Empréstimo cadastrado!",
        description: `${installments.length} parcela(s) para ${clientName}. Total: ${formatCurrency(totalWithInterest)}`,
      });

      onSuccess();
    } catch (error: any) {
      console.error("Error creating loan:", error);
      toast({ title: "Erro ao cadastrar", description: error.message || "Tente novamente", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-5">
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

      {/* Loan basics */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <div className="space-y-2">
          <label className="text-sm font-medium">Valor Emprestado (R$)</label>
          <Input
            type="number"
            step="0.01"
            min="0"
            placeholder="10000.00"
            value={loanAmount}
            onChange={(e) => setLoanAmount(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Juros Mensal (%)</label>
          <Input
            type="number"
            step="0.1"
            min="0"
            max="100"
            placeholder="30"
            value={interestRate}
            onChange={(e) => setInterestRate(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Multa Diária Atraso (R$)</label>
          <Input
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={dailyLateFee}
            onChange={(e) => setDailyLateFee(e.target.value)}
          />
        </div>
      </div>

      {/* Payment Plan Builder */}
      {amount > 0 && (
        <div className="space-y-4">
          {/* Summary bar */}
          <div className="rounded-xl border border-border bg-muted/50 p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Emprestado</p>
              <p className="font-bold text-foreground">{formatCurrency(amount)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Alocado em Parcelas</p>
              <p className={cn("font-bold", totalAllocated > amount ? "text-destructive" : "text-foreground")}>
                {formatCurrency(totalAllocated)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Falta Alocar</p>
              <p className={cn("font-bold", remaining > 0.01 ? "text-amber-600" : "text-emerald-600")}>
                {formatCurrency(remaining)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Total Juros</p>
              <p className="font-bold text-foreground">{formatCurrency(totalInterest)}</p>
            </div>
          </div>

          {/* Installments list */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-foreground">📋 Plano de Pagamento</h4>
              <Button type="button" size="sm" variant="outline" className="gap-1" onClick={addInstallment}>
                <Plus className="h-4 w-4" />
                Adicionar Parcela
              </Button>
            </div>

            {installments.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground text-sm">
                Clique em "Adicionar Parcela" para montar o plano de pagamento.
              </div>
            ) : (
              <div className="space-y-3">
                {schedule.map((item, index) => (
                  <div
                    key={item.id}
                    className="rounded-lg border border-border bg-background p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-foreground">
                        Parcela {index + 1}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => removeInstallment(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Valor da Parcela (R$)</label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={item.amount}
                          onChange={(e) => updateInstallment(item.id, "amount", e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Data de Vencimento</label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn("w-full pl-3 text-left font-normal", !item.dueDate && "text-muted-foreground")}
                            >
                              {item.dueDate ? format(item.dueDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={item.dueDate}
                              onSelect={(date) => updateInstallment(item.id, "dueDate", date)}
                              initialFocus
                              locale={ptBR}
                              className="p-3 pointer-events-auto"
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>

                    {/* Calculated info for this installment */}
                    {item.instValue > 0 && (
                      <div className="rounded-md bg-muted/80 p-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <div>
                          <span className="text-muted-foreground">Amortização:</span>
                          <p className="font-semibold text-foreground">{formatCurrency(item.instValue)}</p>
                        </div>
                        {rate > 0 && (
                          <div>
                            <span className="text-muted-foreground">Juros ({rate}%):</span>
                            <p className="font-semibold text-amber-600">{formatCurrency(item.interestOnBalance)}</p>
                          </div>
                        )}
                        <div>
                          <span className="text-muted-foreground">{rate > 0 ? "Total a pagar:" : "Valor:"}</span>
                          <p className="font-bold text-foreground">{formatCurrency(item.totalPayment)}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Saldo após:</span>
                          <p className={cn("font-semibold", item.balanceAfter > 0 ? "text-destructive" : "text-emerald-600")}>
                            {formatCurrency(item.balanceAfter)}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Validation messages */}
          {totalAllocated > amount + 0.01 && (
            <p className="text-sm text-destructive font-medium">
              ⚠️ O total das parcelas ({formatCurrency(totalAllocated)}) excede o valor emprestado ({formatCurrency(amount)}).
            </p>
          )}
          {installments.length > 0 && remaining > 0.01 && totalAllocated <= amount && (
            <p className="text-sm text-amber-600 font-medium">
              ⚠️ Ainda falta alocar {formatCurrency(remaining)} em parcelas.
            </p>
          )}
        </div>
      )}

      {/* Submit */}
      <Button
        type="button"
        className="w-full h-12 gradient-primary border-0 shadow-soft hover:opacity-90 transition-smooth text-base gap-2"
        disabled={isLoading || !canSave}
        onClick={onSubmit}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Cadastrando...
          </>
        ) : (
          "Cadastrar Empréstimo"
        )}
      </Button>
    </div>
  );
}
