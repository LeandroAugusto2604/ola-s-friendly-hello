import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, Phone } from "lucide-react";

interface OverdueAlertProps {
  refreshKey: number;
}

export function OverdueAlert({ refreshKey }: OverdueAlertProps) {
  const { data: overdueData } = useQuery({
    queryKey: ["overdue-installments", refreshKey],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      
      const { data: installments } = await supabase
        .from("installments")
        .select(`
          id,
          amount,
          due_date,
          installment_number,
          loan_id,
          loans!inner (
            id,
            client_id,
            clients!inner (
              id,
              full_name,
              phone
            )
          )
        `)
        .eq("paid", false)
        .lt("due_date", today);

      return installments || [];
    },
  });

  if (!overdueData || overdueData.length === 0) {
    return null;
  }

  const totalOverdue = overdueData.reduce(
    (sum, i) => sum + Number(i.amount),
    0
  );

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  // Group by client
  const clientsWithOverdue = overdueData.reduce((acc, installment) => {
    const client = (installment.loans as any)?.clients;
    if (client) {
      const clientId = client.id;
      if (!acc[clientId]) {
        acc[clientId] = {
          name: client.full_name,
          phone: client.phone,
          count: 0,
          total: 0,
        };
      }
      acc[clientId].count++;
      acc[clientId].total += Number(installment.amount);
    }
    return acc;
  }, {} as Record<string, { name: string; phone: string | null; count: number; total: number }>);

  const clientList = Object.values(clientsWithOverdue);

  return (
    <Card className="border-0 shadow-card bg-gradient-to-r from-rose-50 to-orange-50 dark:from-rose-950/30 dark:to-orange-950/30">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-destructive/10 p-3">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <div className="flex-1 space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-destructive">
                {overdueData.length} Parcela(s) em Atraso
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Total pendente: <span className="font-semibold text-foreground">{formatCurrency(totalOverdue)}</span>
              </p>
            </div>
            
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {clientList.slice(0, 6).map((client, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between gap-3 bg-card rounded-lg px-4 py-3 shadow-sm border border-border/50"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{client.name}</p>
                    {client.phone && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                        <Phone className="h-3 w-3" />
                        <span>{client.phone.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3")}</span>
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-destructive">
                      {formatCurrency(client.total)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {client.count}x
                    </p>
                  </div>
                </div>
              ))}
            </div>
            
            {clientList.length > 6 && (
              <p className="text-sm text-muted-foreground">
                ... e mais {clientList.length - 6} cliente(s) em atraso
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
