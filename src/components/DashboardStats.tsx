import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, DollarSign, CreditCard, AlertTriangle } from "lucide-react";

interface DashboardStatsProps {
  refreshKey: number;
}

export function DashboardStats({ refreshKey }: DashboardStatsProps) {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats", refreshKey],
    queryFn: async () => {
      const [clientsRes, loansRes, installmentsRes] = await Promise.all([
        supabase.from("clients").select("id", { count: "exact" }),
        supabase.from("loans").select("amount"),
        supabase.from("installments").select("amount, paid, due_date"),
      ]);

      const totalClients = clientsRes.count || 0;
      const totalLoans = (loansRes.data || []).reduce(
        (sum, loan) => sum + Number(loan.amount),
        0
      );
      
      const installments = installmentsRes.data || [];
      const totalPaid = installments
        .filter((i) => i.paid)
        .reduce((sum, i) => sum + Number(i.amount), 0);
      
      const today = new Date();
      const overdueCount = installments.filter(
        (i) => !i.paid && new Date(i.due_date) < today
      ).length;

      return {
        totalClients,
        totalLoans,
        totalPaid,
        overdueCount,
      };
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const statCards = [
    {
      title: "Total de Clientes",
      value: stats?.totalClients || 0,
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      title: "Total Emprestado",
      value: formatCurrency(stats?.totalLoans || 0),
      icon: DollarSign,
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      title: "Total Recebido",
      value: formatCurrency(stats?.totalPaid || 0),
      icon: CreditCard,
      color: "text-purple-600",
      bgColor: "bg-purple-100",
    },
    {
      title: "Parcelas Vencidas",
      value: stats?.overdueCount || 0,
      icon: AlertTriangle,
      color: "text-red-600",
      bgColor: "bg-red-100",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {statCards.map((stat) => (
        <Card key={stat.title} className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {stat.title}
            </CardTitle>
            <div className={`rounded-full p-2 ${stat.bgColor}`}>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
