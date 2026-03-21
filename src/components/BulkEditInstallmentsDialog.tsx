import { useState, useMemo } from "react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { CalendarIcon, Loader2, Plus, Trash2 } from "lucide-react";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface InstallmentRow {
  id: string | null; // null = new
  installment_number: number;
  amount: number;
  due_date: string;
  amount_paid: number;
  status: string;
  isNew?: boolean;
  deleted?: boolean;
}

interface BulkEditInstallmentsDialogProps {
  loanId: string;
  originalAmount: number;
  interestRate: number;
  installments: {
    id: string;
    installment_number: number;
    amount: number;
    due_date: string;
    amount_paid: number;
    status: string;
  }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function BulkEditInstallmentsDialog({
  loanId,
  originalAmount,
  interestRate,
  installments,
  open,
  onOpenChange,
  onSuccess,
}: BulkEditInstallmentsDialogProps) {
  const [rows, setRows] = useState<InstallmentRow[]>(() =>
    installments.map((i) => ({
      id: i.id,
      installment_number: i.installment_number,
      amount: Number(i.amount),
      due_date: i.due_date,
      amount_paid: Number(i.amount_paid || 0),
      status: i.status,
      deleted: false,
    }))
  );
  const [saving, setSaving] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState<number | null>(null);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const activeRows = rows.filter((r) => !r.deleted);
  const paidRows = activeRows.filter((r) => r.status === "liquidado");
  const pendingRows = activeRows.filter((r) => r.status !== "liquidado");

  const totalPrincipalAllocated = activeRows.reduce((sum, r) => sum + r.amount, 0);
  const remaining = originalAmount - totalPrincipalAllocated;
  const rate = interestRate || 0;

  // Running balance simulation
  const simulation = useMemo(() => {
    let balance = originalAmount;
    return activeRows
      .sort((a, b) => a.installment_number - b.installment_number)
      .map((r) => {
        const interest = balance * (rate / 100);
        const balanceBefore = balance;
        if (r.status === "liquidado") {
          // Already paid: deduct principal
          balance = Math.max(balance - r.amount, 0);
        } else {
          balance = Math.max(balance - r.amount, 0);
        }
        return { ...r, interest, balanceBefore, balanceAfter: balance };
      });
  }, [activeRows, originalAmount, rate]);

  const updateRow = (index: number, field: keyof InstallmentRow, value: any) => {
    setRows((prev) => {
      const updated = [...prev];
      (updated[index] as any)[field] = value;
      return updated;
    });
  };

  const deleteRow = (index: number) => {
    setRows((prev) => {
      const updated = [...prev];
      const row = updated[index];
      if (row.status === "liquidado") {
        toast({ title: "Erro", description: "Não é possível excluir parcela já liquidada", variant: "destructive" });
        return prev;
      }
      if (row.isNew) {
        // Remove new rows entirely
        updated.splice(index, 1);
      } else {
        updated[index] = { ...row, deleted: true };
      }
      return renumber(updated);
    });
  };

  const addRow = () => {
    const lastActive = activeRows[activeRows.length - 1];
    const lastDate = lastActive ? lastActive.due_date : format(new Date(), "yyyy-MM-dd");
    const newDate = format(addDays(new Date(lastDate + "T00:00:00"), 30), "yyyy-MM-dd");
    const newNumber = activeRows.length + 1;

    setRows((prev) =>
      renumber([
        ...prev,
        {
          id: null,
          installment_number: newNumber,
          amount: Math.max(remaining, 0),
          due_date: newDate,
          amount_paid: 0,
          status: "pendente",
          isNew: true,
          deleted: false,
        },
      ])
    );
  };

  const renumber = (list: InstallmentRow[]): InstallmentRow[] => {
    let num = 1;
    return list.map((r) => {
      if (r.deleted) return r;
      return { ...r, installment_number: num++ };
    });
  };

  const handleSave = async () => {
    // Validate total
    const totalAllocated = activeRows.reduce((s, r) => s + r.amount, 0);
    if (Math.abs(totalAllocated - originalAmount) > 0.02) {
      toast({
        title: "Erro",
        description: `A soma das parcelas (${formatCurrency(totalAllocated)}) deve ser igual ao valor original (${formatCurrency(originalAmount)}). Diferença: ${formatCurrency(remaining)}.`,
        variant: "destructive",
      });
      return;
    }

    for (const r of activeRows) {
      if (r.amount <= 0) {
        toast({ title: "Erro", description: `Parcela ${r.installment_number} tem valor inválido`, variant: "destructive" });
        return;
      }
    }

    setSaving(true);
    try {
      // 1. Delete removed rows
      const toDelete = rows.filter((r) => r.deleted && r.id);
      for (const r of toDelete) {
        const { error } = await supabase.from("installments").delete().eq("id", r.id!);
        if (error) throw error;
      }

      // 2. Update existing rows
      const toUpdate = activeRows.filter((r) => r.id && !r.isNew);
      for (const r of toUpdate) {
        const { error } = await supabase
          .from("installments")
          .update({
            amount: parseFloat(r.amount.toFixed(2)),
            due_date: r.due_date,
            installment_number: r.installment_number,
          } as any)
          .eq("id", r.id!);
        if (error) throw error;
      }

      // 3. Insert new rows
      const toInsert = activeRows.filter((r) => r.isNew);
      for (const r of toInsert) {
        const { error } = await supabase.from("installments").insert({
          loan_id: loanId,
          installment_number: r.installment_number,
          amount: parseFloat(r.amount.toFixed(2)),
          due_date: r.due_date,
          amount_paid: 0,
          status: "pendente",
          paid: false,
        });
        if (error) throw error;
      }

      // 4. Update loan installments_count
      const { error: loanError } = await supabase
        .from("loans")
        .update({ installments_count: activeRows.length } as any)
        .eq("id", loanId);
      if (loanError) throw loanError;

      toast({ title: "Parcelas atualizadas!", description: `${activeRows.length} parcela(s) salvas com sucesso.` });
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: error?.message || "Erro desconhecido", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Parcelas em Massa</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div className="rounded-lg border p-2 text-center">
              <p className="text-muted-foreground text-xs">Original</p>
              <p className="font-semibold">{formatCurrency(originalAmount)}</p>
            </div>
            <div className="rounded-lg border p-2 text-center">
              <p className="text-muted-foreground text-xs">Alocado</p>
              <p className="font-semibold">{formatCurrency(totalPrincipalAllocated)}</p>
            </div>
            <div className={cn("rounded-lg border p-2 text-center", Math.abs(remaining) > 0.02 ? "border-destructive bg-destructive/5" : "border-emerald-500 bg-emerald-500/5")}>
              <p className="text-muted-foreground text-xs">Diferença</p>
              <p className={cn("font-semibold", Math.abs(remaining) > 0.02 ? "text-destructive" : "text-emerald-600")}>
                {formatCurrency(remaining)}
              </p>
            </div>
            <div className="rounded-lg border p-2 text-center">
              <p className="text-muted-foreground text-xs">Juros</p>
              <p className="font-semibold">{rate}%</p>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">#</TableHead>
                  <TableHead>Valor (R$)</TableHead>
                  <TableHead>Juros Proj.</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {simulation.map((row) => {
                  const originalIndex = rows.findIndex((r) => r === activeRows.find((a) => a.installment_number === row.installment_number && !a.deleted));
                  const realIdx = rows.indexOf(activeRows.find((a) => a.installment_number === row.installment_number)!);
                  const isPaid = row.status === "liquidado";

                  return (
                    <TableRow key={row.id || `new-${row.installment_number}`} className={isPaid ? "opacity-60" : ""}>
                      <TableCell className="font-medium">{row.installment_number}</TableCell>
                      <TableCell>
                        {isPaid ? (
                          <span className="text-sm">{formatCurrency(row.amount)}</span>
                        ) : (
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={row.amount}
                            onChange={(e) => updateRow(realIdx, "amount", parseFloat(e.target.value) || 0)}
                            className="w-28 h-8 text-sm"
                          />
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatCurrency(row.interest)}
                      </TableCell>
                      <TableCell>
                        {isPaid ? (
                          <span className="text-sm">{format(new Date(row.due_date + "T00:00:00"), "dd/MM/yyyy")}</span>
                        ) : (
                          <Popover
                            open={datePickerOpen === realIdx}
                            onOpenChange={(o) => setDatePickerOpen(o ? realIdx : null)}
                          >
                            <PopoverTrigger asChild>
                              <Button variant="outline" size="sm" className="h-8 text-sm w-32 justify-start">
                                {format(new Date(row.due_date + "T00:00:00"), "dd/MM/yyyy")}
                                <CalendarIcon className="ml-auto h-3 w-3 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={new Date(row.due_date + "T00:00:00")}
                                onSelect={(date) => {
                                  if (date) {
                                    updateRow(realIdx, "due_date", format(date, "yyyy-MM-dd"));
                                    setDatePickerOpen(null);
                                  }
                                }}
                                locale={ptBR}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className={cn(
                          "text-xs font-medium px-2 py-1 rounded-full",
                          isPaid ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                        )}>
                          {isPaid ? "Liquidado" : "Pendente"}
                        </span>
                      </TableCell>
                      <TableCell>
                        {!isPaid && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            onClick={() => deleteRow(realIdx)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Add button */}
          <Button variant="outline" size="sm" onClick={addRow} className="w-full">
            <Plus className="h-4 w-4 mr-1" />
            Adicionar Parcela
          </Button>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || Math.abs(remaining) > 0.02}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Salvar Tudo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
