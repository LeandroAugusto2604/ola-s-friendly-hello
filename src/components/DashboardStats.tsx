import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { format } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Users, TrendingUp, Wallet, AlertCircle, ChevronRight, MessageCircle, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { buildOverdueWhatsAppMessage } from "@/lib/overdue-message";

interface DashboardStatsProps {
  refreshKey: number;
}

export function DashboardStats({ refreshKey }: DashboardStatsProps) {
  const [overdueOpen, setOverdueOpen] = useState(() => new URLSearchParams(window.location.search).get("overdue") === "1");
  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats", refreshKey],
    queryFn: async () => {
      const [clientsRes, loansRes, installmentsRes] = await Promise.all([
        supabase.from("clients").select("id", { count: "exact" }),
        supabase.from("loans").select("amount"),
        supabase.from("installments").select("id, loan_id, amount, status, amount_paid, paid, due_date, installment_number, loans!inner(client_id, original_amount, interest_rate, clients!inner(id, full_name, phone))"),
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
      today.setHours(0, 0, 0, 0);

      // Walk each loan's schedule (same logic as the loan screen) to get the
      // remaining principal and interest due for every installment.
      const chargeByInstallment = new Map<string, { principal: number; interest: number }>();
      const byLoan = new Map<string, any[]>();
      for (const i of installments) {
        const list = byLoan.get(i.loan_id) || [];
        list.push(i);
        byLoan.set(i.loan_id, list);
      }
      for (const list of byLoan.values()) {
        list.sort((a: any, b: any) => a.installment_number - b.installment_number);
        const rate = Number(list[0].loans?.interest_rate || 0) / 100;
        let balance = Number(list[0].loans?.original_amount || 0);
        let credit = 0;
        for (const inst of list) {
          const instAmount = Number(inst.amount);
          const instPaid = Number(inst.amount_paid || 0);
          const effectivePrincipal = Math.max(instAmount - credit, 0);
          credit = Math.max(credit - instAmount, 0);
          const interest = balance * rate;
          chargeByInstallment.set(inst.id, { principal: effectivePrincipal, interest });
          const overpayment = Math.max(instPaid - (effectivePrincipal + interest), 0);
          credit += overpayment;
          balance = Math.max(balance - effectivePrincipal - overpayment, 0);
        }
      }

      const overdueList = installments
        .filter((i) => !i.paid && new Date(i.due_date + "T00:00:00") < today)
        .map((i: any) => {
          const charge = chargeByInstallment.get(i.id) || { principal: Number(i.amount), interest: 0 };
          return {
            id: i.id as string,
            number: i.installment_number as number,
            amount: Number(i.amount),
            principal: charge.principal,
            interest: charge.interest,
            dueDate: i.due_date as string,
            clientId: i.loans?.clients?.id as string,
            clientName: i.loans?.clients?.full_name as string,
            phone: (i.loans?.clients?.phone || "") as string,
          };
        })
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      const overdueCount = overdueList.length;

      return {
        totalClients,
        totalLoans,
        totalPaid,
        overdueCount,
        overdueList,
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
      onClick: (stats?.overdueCount || 0) > 0 ? () => setOverdueOpen(true) : undefined,
    },
  ];

  type Overdue = NonNullable<typeof stats>["overdueList"][number];
  const fmtDate = (d: string) => format(new Date(d + "T00:00:00"), "dd/MM/yyyy");

  const downloadPdf = (items: Overdue[]) => {
    const doc = new jsPDF();
    const clientName = items[0].clientName;
    doc.setFontSize(14);
    doc.text("Parcelas em atraso", 14, 18);
    doc.setFontSize(10);
    doc.text(`Cliente: ${clientName}`, 14, 26);
    doc.text(`Emitido em: ${format(new Date(), "dd/MM/yyyy")}`, 14, 32);
    autoTable(doc, {
      startY: 38,
      head: [["Parcela", "Vencimento", "Parcela", "Juros", "Total"]],
      body: items.map((i) => [
        String(i.number),
        fmtDate(i.dueDate),
        formatCurrency(i.principal),
        formatCurrency(i.interest),
        formatCurrency(i.principal + i.interest),
      ]),
      foot: [["", "Total", "", "", formatCurrency(items.reduce((s, i) => s + i.principal + i.interest, 0))]],
      theme: "grid",
    });
    doc.save(`atraso-${clientName.replace(/\s+/g, "-").toLowerCase()}.pdf`);
  };

  const sendWhatsApp = (items: Overdue[]) => {
    const digits = items[0].phone.replace(/\D/g, "");
    const phone = digits.startsWith("55") ? digits : `55${digits}`;
    const text = buildOverdueWhatsAppMessage(
      items[0].clientName,
      items.map((i) => ({ number: i.number, dueDate: i.dueDate, principal: i.principal, interest: i.interest }))
    );
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, "_blank");
  };

  const overdueByClient = Object.values(
    (stats?.overdueList || []).reduce((acc, i) => {
      (acc[i.clientId] ||= []).push(i);
      return acc;
    }, {} as Record<string, Overdue[]>)
  );

  const goTo = (clientId: string, installmentId: string) => {
    setOverdueOpen(false);
    window.dispatchEvent(new CustomEvent("focus-installment", { detail: { clientId, installmentId } }));
  };

  return (
    <>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {statCards.map((stat: any) => (
        <Card 
          key={stat.title} 
          onClick={stat.onClick}
          role={stat.onClick ? "button" : undefined}
          tabIndex={stat.onClick ? 0 : undefined}
          onKeyDown={stat.onClick ? (e) => (e.key === "Enter" || e.key === " ") && stat.onClick() : undefined}
          className={`overflow-hidden shadow-card hover:shadow-hover transition-smooth border-0 ${
            stat.highlight ? "ring-2 ring-destructive/20" : ""
          } ${stat.onClick ? "cursor-pointer hover:ring-destructive/50" : ""}`}
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
    <Dialog open={overdueOpen} onOpenChange={setOverdueOpen}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Parcelas em atraso</DialogTitle>
          <DialogDescription>Clique em "Cobrar" para enviar no WhatsApp do cliente, ou em uma parcela para ir até ela.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {overdueByClient.map((items) => (
            <div key={items[0].clientId} className="rounded-lg border border-border bg-card p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-sm truncate">{items[0].clientName}</p>
                <div className="flex gap-1 shrink-0">
                  <Button size="sm" variant="outline" className="gap-1 h-8" onClick={() => downloadPdf(items)}>
                    <FileDown className="h-4 w-4" /> PDF
                  </Button>
                  <Button size="sm" className="gap-1 h-8" disabled={!items[0].phone} onClick={() => sendWhatsApp(items)}>
                    <MessageCircle className="h-4 w-4" /> Cobrar
                  </Button>
                </div>
              </div>
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => goTo(item.clientId, item.id)}
                  className="w-full flex items-center justify-between gap-3 rounded-md bg-muted/50 px-3 py-2 text-left hover:bg-muted transition-smooth"
                >
                  <p className="text-xs text-muted-foreground">
                    Parcela {item.number} • venceu em {fmtDate(item.dueDate)}
                  </p>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <span className="text-sm font-semibold text-destructive">{formatCurrency(item.principal + item.interest)}</span>
                      {item.interest > 0 && (
                        <span className="block text-[10px] text-muted-foreground">
                          {formatCurrency(item.principal)} + {formatCurrency(item.interest)} juros
                        </span>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </button>
              ))}
              {!items[0].phone && <p className="text-xs text-muted-foreground">Cliente sem celular cadastrado.</p>}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
