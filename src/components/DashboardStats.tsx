import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, TrendingUp, Wallet, AlertCircle } from "lucide-react";

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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="overflow-hidden">
            <CardContent className="p-6">
              <Skeleton className="h-4 w-24 mb-3" />
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
      gradient: "from-blue-500 to-blue-600",
      iconBg: "bg-blue-500/10",
      iconColor: "text-blue-600",
    },
    {
      title: "Total Emprestado",
      value: formatCurrency(stats?.totalLoans || 0),
      icon: TrendingUp,
      gradient: "from-emerald-500 to-emerald-600",
      iconBg: "bg-emerald-500/10",
      iconColor: "text-emerald-600",
    },
    {
      title: "Total Recebido",
      value: formatCurrency(stats?.totalPaid || 0),
      icon: Wallet,
      gradient: "from-violet-500 to-violet-600",
      iconBg: "bg-violet-500/10",
      iconColor: "text-violet-600",
    },
    {
      title: "Parcelas Vencidas",
      value: stats?.overdueCount || 0,
      icon: AlertCircle,
      gradient: "from-rose-500 to-rose-600",
      iconBg: "bg-rose-500/10",
      iconColor: "text-rose-600",
      highlight: (stats?.overdueCount || 0) > 0,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {statCards.map((stat) => (
        <Card 
          key={stat.title} 
          className={`overflow-hidden shadow-card hover:shadow-hover transition-smooth border-0 ${
            stat.highlight ? "ring-2 ring-destructive/20" : ""
          }`}
        >
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </p>
                <p className={`text-2xl font-bold tracking-tight ${stat.highlight ? "text-destructive" : "text-foreground"}`}>
                  {stat.value}
                </p>
              </div>
              <div className={`rounded-xl p-3 ${stat.iconBg}`}>
                <stat.icon className={`h-5 w-5 ${stat.iconColor}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
