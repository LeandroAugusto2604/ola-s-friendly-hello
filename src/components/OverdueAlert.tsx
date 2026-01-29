import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

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
    <Alert variant="destructive" className="border-2">
      <AlertTriangle className="h-5 w-5" />
      <AlertTitle className="text-lg font-semibold">
        ⚠️ {overdueData.length} Parcela(s) em Atraso
      </AlertTitle>
      <AlertDescription className="mt-2">
        <p className="font-medium mb-3">
          Total em atraso: {formatCurrency(totalOverdue)}
        </p>
        <div className="space-y-2">
          {clientList.slice(0, 5).map((client, index) => (
            <div
              key={index}
              className="flex items-center justify-between bg-destructive/10 rounded px-3 py-2 text-sm"
            >
              <div>
                <span className="font-medium">{client.name}</span>
                {client.phone && (
                  <span className="text-muted-foreground ml-2">
                    ({client.phone.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3")})
                  </span>
                )}
              </div>
              <div className="text-right">
                <span className="font-medium">{client.count} parcela(s)</span>
                <span className="ml-2">{formatCurrency(client.total)}</span>
              </div>
            </div>
          ))}
          {clientList.length > 5 && (
            <p className="text-sm text-muted-foreground">
              ... e mais {clientList.length - 5} cliente(s)
            </p>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
