import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface InterestPaymentDialogProps {
  loanId: string;
  remainingInterest: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function InterestPaymentDialog({
  loanId,
  remainingInterest,
  open,
  onOpenChange,
  onSuccess,
}: InterestPaymentDialogProps) {
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const handleSubmit = async () => {
    const value = parseFloat(amount);
    if (!value || value <= 0) {
      toast({ title: "Erro", description: "Informe um valor válido", variant: "destructive" });
      return;
    }
    if (value > remainingInterest + 0.01) {
      toast({ title: "Erro", description: "Valor excede os juros restantes", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("interest_payments").insert({
        loan_id: loanId,
        amount: value,
        notes: notes.trim() || null,
      } as any);

      if (error) throw error;

      toast({
        title: "Pagamento registrado!",
        description: `${formatCurrency(value)} de juros abatido.`,
      });
      setAmount("");
      setNotes("");
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
          <DialogTitle>Registrar Pagamento de Juros</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/50 p-3 text-sm">
            <p className="text-muted-foreground">
              Juros restantes: <strong className="text-foreground">{formatCurrency(remainingInterest)}</strong>
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Valor Pago (R$)</label>
            <Input
              type="number"
              step="0.01"
              min="0"
              max={remainingInterest}
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => setAmount(String(remainingInterest.toFixed(2)))}
            >
              Pagar tudo ({formatCurrency(remainingInterest)})
            </Button>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Observação (opcional)</label>
            <Textarea
              placeholder="Ex: Pagamento parcial via PIX"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
