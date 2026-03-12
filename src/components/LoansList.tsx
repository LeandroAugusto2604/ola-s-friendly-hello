import { useState } from "react";
import { LoanConfigForm } from "@/components/LoanConfigForm";
import { v4 as uuidv4 } from "uuid";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { APP_URL } from "@/config/app";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { format, differenceInCalendarDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, Clock, FileDown, FileText, Pencil, Plus, Search, Trash2, User, MessageCircle, Copy, Eye, Send, Loader2 } from "lucide-react";
import { EditClientDialog } from "@/components/EditClientDialog";
import { EditLoanDialog } from "@/components/EditLoanDialog";
import { InterestPaymentDialog } from "@/components/InterestPaymentDialog";
import { PartialPaymentDialog } from "@/components/PartialPaymentDialog";
import { AdvancePaymentDialog } from "@/components/AdvancePaymentDialog";

interface Installment {
  id: string;
  installment_number: number;
  amount: number;
  due_date: string;
  paid: boolean;
  paid_at: string | null;
  amount_paid: number;
  status: string;
}

interface IdentityVerification {
  id: string;
  token: string;
  status: string;
  photo_url: string | null;
  created_at: string;
  verified_at: string | null;
}

interface InterestPayment {
  id: string;
  amount: number;
  paid_at: string;
  notes: string | null;
}

interface Loan {
  id: string;
  amount: number;
  original_amount: number;
  interest_rate: number;
  daily_late_fee: number;
  installments_count: number;
  created_at: string;
  installments: Installment[];
  identity_verification?: IdentityVerification | null;
  interest_payments: InterestPayment[];
}

interface Client {
  id: string;
  full_name: string;
  cpf: string;
  rg: string;
  address: string;
  phone: string | null;
  loans: Loan[];
}

type StatusFilter = "all" | "on_time" | "overdue" | "paid_off";

interface LoansListProps {
  refreshKey: number;
  onDataChange?: () => void;
}

export function LoansList({ refreshKey, onDataChange }: LoansListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sendingVerification, setSendingVerification] = useState<string | null>(null);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);
  const [interestPaymentLoan, setInterestPaymentLoan] = useState<{ loanId: string; remaining: number } | null>(null);
  const [partialPayment, setPartialPayment] = useState<{
    installmentId: string;
    installmentNumber: number;
    amount: number;
    amountPaid: number;
    interestRate: number;
    loanBalanceBefore: number;
  } | null>(null);
  const [addingLoanToClient, setAddingLoanToClient] = useState<{ id: string; name: string } | null>(null);
  const [advancePayment, setAdvancePayment] = useState<{
    loanId: string;
    originalAmount: number;
    totalPaid: number;
    interestRate: number;
    installments: any[];
  } | null>(null);

  const { data: clients, isLoading, refetch } = useQuery({
    queryKey: ["clients-with-loans", refreshKey],
    queryFn: async () => {
      const { data: clientsData, error: clientsError } = await supabase
        .from("clients")
        .select("*")
        .order("created_at", { ascending: false });

      if (clientsError) throw clientsError;

      const clientsWithLoans: Client[] = await Promise.all(
        clientsData.map(async (client) => {
          const { data: loansData } = await supabase
            .from("loans")
            .select("*")
            .eq("client_id", client.id)
            .order("created_at", { ascending: false });

          const loansWithInstallments: Loan[] = await Promise.all(
            (loansData || []).map(async (loan) => {
              const { data: installmentsData } = await supabase
                .from("installments")
                .select("*")
                .eq("loan_id", loan.id)
                .order("installment_number", { ascending: true });

              // Fetch identity verification for this loan
              const { data: verificationData } = await supabase
                .from("identity_verifications")
                .select("*")
                .eq("loan_id", loan.id)
                .order("created_at", { ascending: false })
                .limit(1)
                .single();

              // Fetch interest payments for this loan
              const { data: interestPaymentsData } = await supabase
                .from("interest_payments")
                .select("*")
                .eq("loan_id", loan.id)
                .order("paid_at", { ascending: true });

              return {
                ...loan,
                installments: installmentsData || [],
                identity_verification: verificationData || null,
                interest_payments: (interestPaymentsData || []) as InterestPayment[],
              };
            })
          );

          return {
            ...client,
            loans: loansWithInstallments,
          };
        })
      );

      return clientsWithLoans;
    },
  });

  const handleSendVerification = async (loanId: string, clientPhone: string | null, clientName: string) => {
    if (!clientPhone) {
      toast({
        title: "Telefone não cadastrado",
        description: "Cadastre o telefone do cliente para enviar a verificação.",
        variant: "destructive",
      });
      return;
    }

    // Generate token and build URLs BEFORE any async call
    const token = uuidv4();
    const verificationLink = `${APP_URL}/verify/${token}`;
    const cleanPhone = clientPhone.replace(/\D/g, "");
    const whatsappPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
    const message = encodeURIComponent(
      `Olá ${clientName}! Para confirmar seu empréstimo, acesse o link abaixo e tire uma foto segurando seu RG:\n\n${verificationLink}`
    );
    const whatsappUrl = `https://wa.me/${whatsappPhone}?text=${message}`;

    // Open WhatsApp IMMEDIATELY (synchronous, preserves user gesture)
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");

    setSendingVerification(loanId);

    try {
      // Save verification record in the background
      const { error } = await supabase
        .from("identity_verifications")
        .insert({
          loan_id: loanId,
          token: token,
          status: "pending",
        });

      if (error) throw error;

      toast({
        title: "Link enviado!",
        description: "O WhatsApp foi aberto com a mensagem pronta.",
      });

      refetch();
    } catch (error: any) {
      console.error("Error creating verification:", error);
      toast({
        title: "Erro ao salvar verificação",
        description: error?.message || "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setSendingVerification(null);
    }
  };

  const copyVerificationLink = (token: string) => {
    const link = `${APP_URL}/verify/${token}`;
    navigator.clipboard.writeText(link);
    toast({
      title: "Link copiado!",
      description: "O link foi copiado para a área de transferência.",
    });
  };

  const resendVerification = async (loanId: string, existingToken: string, clientPhone: string | null, clientName: string) => {
    if (!clientPhone) {
      toast({
        title: "Telefone não cadastrado",
        description: "Cadastre o telefone do cliente para reenviar.",
        variant: "destructive",
      });
      return;
    }

    const verificationLink = `${APP_URL}/verify/${existingToken}`;
    const cleanPhone = clientPhone.replace(/\D/g, "");
    const whatsappPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
    const message = encodeURIComponent(
      `Olá ${clientName}! Para confirmar seu empréstimo, acesse o link abaixo e tire uma foto segurando seu RG:\n\n${verificationLink}`
    );

    const whatsappUrl = `https://wa.me/${whatsappPhone}?text=${message}`;
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");

    toast({
      title: "WhatsApp aberto!",
      description: "Reenvie a mensagem para o cliente.",
    });
  };

  const handlePayInstallment = async (installmentId: string, installmentAmount: number) => {
    const { error } = await supabase
      .from("installments")
      .update({
        paid: true,
        paid_at: new Date().toISOString(),
        amount_paid: installmentAmount,
        status: "liquidado",
      } as any)
      .eq("id", installmentId);

    if (error) {
      toast({
        title: "Erro",
        description: "Não foi possível marcar como pago",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Parcela paga!",
        description: "Pagamento registrado com sucesso",
      });
      refetch();
      onDataChange?.();
    }
  };

  const handleDeleteLoan = async (loanId: string, clientId: string, totalLoans: number) => {
    const { error } = await supabase
      .from("loans")
      .delete()
      .eq("id", loanId);

    if (error) {
      toast({
        title: "Erro",
        description: "Não foi possível remover o empréstimo",
        variant: "destructive",
      });
    } else {
      // If this was the last loan, also delete the client
      if (totalLoans === 1) {
        await supabase.from("clients").delete().eq("id", clientId);
        toast({
          title: "Cliente removido!",
          description: "O cliente e seu empréstimo foram excluídos",
        });
      } else {
        toast({
          title: "Empréstimo removido!",
          description: "O empréstimo e suas parcelas foram excluídos. O cliente ainda possui outros empréstimos.",
        });
      }
      refetch();
      onDataChange?.();
    }
  };

  const handleDeleteClient = async (clientId: string) => {
    const { error } = await supabase
      .from("clients")
      .delete()
      .eq("id", clientId);

    if (error) {
      toast({
        title: "Erro",
        description: "Não foi possível remover o cliente",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Cliente removido!",
        description: "O cliente e todos os seus empréstimos foram excluídos",
      });
      refetch();
      onDataChange?.();
    }
  };

  const handleExportClientPdf = (client: Client) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFontSize(18);
    doc.text(client.full_name, pageWidth / 2, 20, { align: "center" });

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`CPF: ${formatCPF(client.cpf)}`, pageWidth / 2, 28, { align: "center" });
    if (client.phone) {
      const formattedPhone = client.phone.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
      doc.text(`Tel: ${formattedPhone}`, pageWidth / 2, 34, { align: "center" });
    }

    let yPos = client.phone ? 44 : 38;

    for (const loan of client.loans) {
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }

      const totalCount = loan.installments.length;
      const totalAmountPaid = loan.installments.reduce((sum, i) => sum + Number(i.amount_paid || 0), 0);
      const saldoDevedor = Math.max(Number(loan.original_amount) - totalAmountPaid, 0);

      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      const loanDate = format(new Date(loan.created_at), "dd/MM/yyyy", { locale: ptBR });
      doc.text(`Empréstimo - ${loanDate}`, 14, yPos);
      yPos += 6;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`Valor Emprestado: ${formatCurrency(Number(loan.original_amount))}  |  Juros: ${loan.interest_rate || 0}%  |  Parcelas: ${totalCount}x`, 14, yPos);
      yPos += 5;
      doc.text(`Total Pago: ${formatCurrency(totalAmountPaid)}  |  Saldo Devedor: ${formatCurrency(saldoDevedor)}`, 14, yPos);
      yPos += 5;

      if (Number(loan.daily_late_fee) > 0) {
        doc.text(`Multa diária por atraso: ${formatCurrency(Number(loan.daily_late_fee))}/dia`, 14, yPos);
        yPos += 5;
      }

      yPos += 2;

      const todayPdf = new Date();
      todayPdf.setHours(0, 0, 0, 0);
      const interestRateDecimal = Number(loan.interest_rate || 0) / 100;
      let pdfRunningBalance = Number(loan.original_amount);
      let pdfCredit = 0;
      const tableData = loan.installments.map((inst) => {
        const balanceBefore = pdfRunningBalance;
        const instAmt = Number(inst.amount);
        const instPaid = Number(inst.amount_paid || 0);
        const effectivePrincipal = Math.max(instAmt - pdfCredit, 0);
        pdfCredit = Math.max(pdfCredit - instAmt, 0);
        const jurosOnBalance = balanceBefore * interestRateDecimal;
        const totalDue = effectivePrincipal + jurosOnBalance;
        const overpayment = Math.max(instPaid - totalDue, 0);
        pdfCredit += overpayment;
        const principalPaid = effectivePrincipal + overpayment;
        pdfRunningBalance = Math.max(pdfRunningBalance - principalPaid, 0);
        const dueDate = new Date(inst.due_date + "T00:00:00");
        const isOverdue = !inst.paid && dueDate < todayPdf;
        const daysLate = isOverdue ? differenceInCalendarDays(todayPdf, dueDate) : 0;
        const lateFee = daysLate * Number(loan.daily_late_fee || 0);
        const displayAmt = effectivePrincipal + lateFee;
        const valorText = lateFee > 0
          ? `${formatCurrency(displayAmt)} (+${daysLate}d)`
          : effectivePrincipal < instAmt
            ? `${formatCurrency(effectivePrincipal)} (cred.)`
            : formatCurrency(instAmt);
        const amtPaid = Number(inst.amount_paid || 0);
        const juros = balanceBefore * interestRateDecimal;
        const totalComJuros = effectivePrincipal + juros;
        const statusLabel = inst.status === "liquidado" ? "Liquidado" : inst.status === "parcial" ? "Parcial" : isOverdue ? "Vencida" : "Pendente";
        return [
          `${inst.installment_number}/${totalCount}`,
          valorText,
          formatCurrency(amtPaid),
          formatCurrency(pdfRunningBalance),
          formatCurrency(totalComJuros),
          format(dueDate, "dd/MM/yyyy"),
          statusLabel,
        ];
      });

      autoTable(doc, {
        startY: yPos,
        head: [["Parcela", "Valor", "Pago", "Restante", "Rest. + Juros", "Vencimento", "Status"]],
        body: tableData,
        theme: "grid",
        headStyles: { fillColor: [59, 130, 246], fontSize: 7, fontStyle: "bold" },
        bodyStyles: { fontSize: 7 },
        columnStyles: {
          0: { halign: "center", cellWidth: 18 },
          1: { halign: "right", cellWidth: 26 },
          2: { halign: "right", cellWidth: 26 },
          3: { halign: "right", cellWidth: 26 },
          4: { halign: "right", cellWidth: 26 },
          5: { halign: "center", cellWidth: 24 },
          6: { halign: "center", cellWidth: 20 },
        },
        margin: { left: 10, right: 10 },
        didParseCell: (data) => {
          if (data.section === "body" && data.column.index === 6) {
            if (data.cell.raw === "Liquidado") {
              data.cell.styles.textColor = [22, 163, 74];
              data.cell.styles.fontStyle = "bold";
            } else if (data.cell.raw === "Parcial") {
              data.cell.styles.textColor = [234, 179, 8];
              data.cell.styles.fontStyle = "bold";
            } else {
              data.cell.styles.textColor = [220, 38, 38];
            }
          }
        },
      });

      yPos = (doc as any).lastAutoTable.finalY + 10;
    }

    const safeName = client.full_name.replace(/\s+/g, "-").toLowerCase();
    doc.save(`emprestimo-${safeName}.pdf`);

    toast({ title: "PDF exportado!", description: `Relatório de ${client.full_name} baixado.` });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatCPF = (cpf: string) => {
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  };

  const getLoanStatus = (loan: Loan): "on_time" | "overdue" | "paid_off" => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to start of day
    const allPaid = loan.installments.every((i) => i.paid);
    if (allPaid) return "paid_off";

    const hasOverdue = loan.installments.some((i) => {
      if (i.paid) return false;
      const dueDate = new Date(i.due_date + "T00:00:00");
      // Only overdue if due_date is BEFORE today (not including today)
      return dueDate < today;
    });
    return hasOverdue ? "overdue" : "on_time";
  };

  const getClientStatus = (client: Client): "on_time" | "overdue" | "paid_off" | "no_loans" => {
    if (client.loans.length === 0) return "no_loans";
    
    const statuses = client.loans.map(getLoanStatus);
    if (statuses.some((s) => s === "overdue")) return "overdue";
    if (statuses.every((s) => s === "paid_off")) return "paid_off";
    return "on_time";
  };

  // Filter clients based on search and status
  const filteredClients = clients?.filter((client) => {
    // Search filter
    const searchLower = searchQuery.toLowerCase().trim();
    const matchesSearch =
      searchLower === "" ||
      client.full_name.toLowerCase().includes(searchLower) ||
      client.cpf.includes(searchQuery.replace(/\D/g, ""));

    // Status filter
    if (!matchesSearch) return false;
    if (statusFilter === "all") return true;

    const clientStatus = getClientStatus(client);
    return clientStatus === statusFilter;
  });

  if (isLoading) {
    return (
      <Card className="border-0 shadow-card">
        <CardHeader>
          <CardTitle>Clientes e Empréstimos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-card">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-xl">
          <div className="rounded-lg bg-primary/10 p-2">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          Clientes e Empréstimos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search and Filters */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou CPF..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11"
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(value: StatusFilter) => setStatusFilter(value)}
          >
            <SelectTrigger className="w-full sm:w-48 h-11">
              <SelectValue placeholder="Filtrar por status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="on_time">Em dia</SelectItem>
              <SelectItem value="overdue">Com atraso</SelectItem>
              <SelectItem value="paid_off">Quitado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Results count */}
        <p className="text-sm text-muted-foreground">
          {filteredClients?.length || 0} cliente(s) encontrado(s)
        </p>

        {!filteredClients || filteredClients.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            {searchQuery || statusFilter !== "all"
              ? "Nenhum cliente encontrado com os filtros aplicados."
              : "Nenhum cliente cadastrado ainda."}
          </p>
        ) : (
          <Accordion type="multiple" className="space-y-3">
            {filteredClients.map((client) => {
              const clientStatus = getClientStatus(client);
              
              return (
                <AccordionItem
                  key={client.id}
                  value={client.id}
                  className="border border-border/50 rounded-xl px-4 bg-card shadow-sm hover:shadow-card transition-smooth"
                >
                  <AccordionTrigger className="hover:no-underline py-4">
                    <div className="flex items-center gap-4 text-left flex-1">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 shrink-0">
                        <User className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-foreground">{client.full_name}</p>
                          {clientStatus === "paid_off" && (
                            <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-0">Quitado</Badge>
                          )}
                          {clientStatus === "overdue" && (
                            <Badge variant="destructive" className="border-0">Com atraso</Badge>
                          )}
                          {clientStatus === "on_time" && (
                            <Badge className="bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 border-0">Em dia</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          CPF: {formatCPF(client.cpf)} • {client.loans.length}{" "}
                          empréstimo(s)
                        </p>
                        {client.phone && (
                          <p className="text-sm text-muted-foreground">
                            Tel: {client.phone.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3")}
                          </p>
                        )}
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 pt-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="grid gap-2 text-sm">
                          <p>
                            <strong>RG:</strong> {client.rg}
                          </p>
                          <p>
                            <strong>Endereço:</strong> {client.address}
                          </p>
                          {client.phone && (
                            <p>
                              <strong>Celular:</strong>{" "}
                              {client.phone.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3")}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Button
                            size="sm"
                            className="gap-1 gradient-primary border-0 hover:opacity-90"
                            onClick={() => setAddingLoanToClient({ id: client.id, name: client.full_name })}
                          >
                            <Plus className="h-4 w-4" />
                            Novo Empréstimo
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingClient(client)}
                          >
                            <Pencil className="h-4 w-4 mr-1" />
                            Editar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleExportClientPdf(client)}
                          >
                            <FileDown className="h-4 w-4 mr-1" />
                            PDF
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                                <Trash2 className="h-4 w-4 mr-1" />
                                Excluir Cliente
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Excluir cliente?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta ação não pode ser desfeita. O cliente{" "}
                                  <strong>{client.full_name}</strong> e todos os seus{" "}
                                  <strong>{client.loans.length} empréstimo(s)</strong> serão
                                  removidos permanentemente.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteClient(client.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Excluir Cliente
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>

                      {client.loans.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          Nenhum empréstimo cadastrado.
                        </p>
                      ) : (
                        client.loans.map((loan) => {
                          const paidCount = loan.installments.filter((i) => i.paid).length;
                          const totalPaid = loan.installments
                            .reduce((sum, i) => sum + Number(i.amount_paid || 0), 0);
                          const loanStatus = getLoanStatus(loan);
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          const overdueInstallments = loan.installments.filter(
                            (i) => {
                              if (i.paid) return false;
                              const dueDate = new Date(i.due_date + "T00:00:00");
                              return dueDate < today;
                            }
                          );

                          // Interest calculations
                          const totalInterest = Number(loan.original_amount) * (Number(loan.interest_rate) / 100);
                          const interestPaid = loan.interest_payments.reduce((sum, p) => sum + Number(p.amount), 0);
                          const interestRemaining = Math.max(totalInterest - interestPaid, 0);

                          return (
                            <div
                              key={loan.id}
                              className="border border-border/50 rounded-xl p-5 space-y-4 bg-muted/30"
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-lg font-semibold text-foreground">
                                      {formatCurrency(Number(loan.original_amount))}
                                    </p>
                                    {loanStatus === "paid_off" && (
                                      <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-0">Quitado</Badge>
                                    )}
                                    {loanStatus === "overdue" && (
                                      <Badge variant="destructive" className="border-0">
                                        {overdueInstallments.length} parcela(s) em atraso
                                      </Badge>
                                    )}
                                    {loanStatus === "on_time" && (
                                      <Badge className="bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 border-0">Em dia</Badge>
                                    )}
                                  </div>
                                  <p className="text-sm text-muted-foreground mt-1">
                                    {loan.installments_count}x de{" "}
                                    {formatCurrency(Number(loan.original_amount) / loan.installments_count)}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="text-right">
                                    <Badge
                                      variant={paidCount === loan.installments_count ? "default" : "secondary"}
                                    >
                                      {paidCount}/{loan.installments_count} pagas
                                    </Badge>
                                    <p className="text-sm text-muted-foreground mt-1">
                                      Pago: {formatCurrency(totalPaid)}
                                    </p>
                                  </div>
                                  <Button variant="outline" size="icon" className="ml-2" onClick={() => setEditingLoan(loan)}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button variant="destructive" size="icon" className="ml-2">
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Remover empréstimo?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Esta ação não pode ser desfeita. O empréstimo
                                          de {formatCurrency(Number(loan.original_amount))} e
                                          todas as suas parcelas serão removidos permanentemente.
                                          {client.loans.length === 1 && (
                                            <span className="block mt-2 font-medium">
                                              ⚠️ Como este é o único empréstimo do cliente, o cliente também será removido.
                                            </span>
                                          )}
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => handleDeleteLoan(loan.id, client.id, client.loans.length)}
                                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        >
                                          Remover
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </div>
                              </div>

                              {/* Financial Summary Panel */}
                              <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 p-3 sm:p-5 space-y-2 sm:space-y-3">
                                <div className="flex items-center justify-between">
                                  <h4 className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-1 sm:gap-2">
                                    📊 Resumo Financeiro
                                  </h4>
                                  {Math.max(Number(loan.original_amount) - totalPaid, 0) > 0 && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="gap-1 text-xs h-7 sm:h-8"
                                      onClick={() => setAdvancePayment({
                                        loanId: loan.id,
                                        originalAmount: Number(loan.original_amount),
                                        totalPaid,
                                        interestRate: Number(loan.interest_rate || 0),
                                        installments: loan.installments.map(i => ({
                                          id: i.id,
                                          installment_number: i.installment_number,
                                          amount: Number(i.amount),
                                          amount_paid: Number(i.amount_paid || 0),
                                          status: i.status,
                                          paid: i.paid,
                                        })),
                                      })}
                                    >
                                      💰 Adiantar Valor
                                    </Button>
                                  )}
                                </div>
                                {(() => {
                                  const saldoDevedor = Math.max(Number(loan.original_amount) - totalPaid, 0);
                                  const rate = Number(loan.interest_rate || 0);
                                  const jurosSobreSaldo = saldoDevedor * (rate / 100);
                                  const parcelaMensal = Number(loan.original_amount) / loan.installments_count;
                                  const parcelaMaisJuros = parcelaMensal + jurosSobreSaldo;
                                  return (
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                                      <div className="rounded-lg bg-background p-3 shadow-sm">
                                        <p className="text-muted-foreground text-xs">Total Emprestado</p>
                                        <p className="font-bold text-foreground text-lg">{formatCurrency(Number(loan.original_amount))}</p>
                                      </div>
                                      <div className="rounded-lg bg-background p-3 shadow-sm">
                                        <p className="text-muted-foreground text-xs">Total Pago</p>
                                        <p className="font-bold text-emerald-600 text-lg">{formatCurrency(totalPaid)}</p>
                                      </div>
                                      <div className="rounded-lg bg-background p-3 shadow-sm">
                                        <p className="text-muted-foreground text-xs">Saldo Devedor</p>
                                        <p className="font-bold text-destructive text-lg">{formatCurrency(saldoDevedor)}</p>
                                      </div>
                                      <div className="rounded-lg bg-background p-3 shadow-sm">
                                        <p className="text-muted-foreground text-xs">
                                          {rate > 0 ? `Parcela + Juros (${rate}%)` : "Valor da Parcela"}
                                        </p>
                                        <p className="font-bold text-foreground text-lg">{formatCurrency(rate > 0 ? parcelaMaisJuros : parcelaMensal)}</p>
                                        {rate > 0 && (
                                          <p className="text-xs text-amber-600 mt-1">
                                            Parcela {formatCurrency(parcelaMensal)} + Juros {formatCurrency(jurosSobreSaldo)}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })()}
                              </div>


                              {/* Overdue summary */}
                              {overdueInstallments.length > 0 && (
                                <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 flex items-center gap-3">
                                  <div className="rounded-lg bg-destructive/20 p-2">
                                    <Clock className="h-4 w-4 text-destructive" />
                                  </div>
                                  <div className="text-sm font-medium text-destructive">
                                    <p>
                                      {overdueInstallments.length} parcela(s) em atraso
                                      totalizando{" "}
                                      {formatCurrency(
                                        overdueInstallments.reduce(
                                          (sum, i) => {
                                            const daysLate = differenceInCalendarDays(today, new Date(i.due_date + "T00:00:00"));
                                            const lateFee = daysLate > 0 ? daysLate * Number(loan.daily_late_fee || 0) : 0;
                                            return sum + Number(i.amount) + lateFee;
                                          },
                                          0
                                        )
                                      )}
                                    </p>
                                    {Number(loan.daily_late_fee) > 0 && (
                                      <p className="text-xs mt-1 opacity-80">
                                        Multa diária: {formatCurrency(Number(loan.daily_late_fee))}/dia
                                      </p>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Identity Verification Section */}
                              <div className="border border-border/50 rounded-lg p-4 bg-background">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-medium">Verificação:</span>
                                    {!loan.identity_verification ? (
                                      <Badge variant="outline" className="border-muted-foreground/30">
                                        Não solicitada
                                      </Badge>
                                    ) : loan.identity_verification.status === "completed" ? (
                                      <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-0">
                                        <CheckCircle2 className="mr-1 h-3 w-3" />
                                        Verificado
                                      </Badge>
                                    ) : (
                                      <Badge className="bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border-0">
                                        <Clock className="mr-1 h-3 w-3" />
                                        Aguardando
                                      </Badge>
                                    )}
                                  </div>
                                  
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {!loan.identity_verification ? (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="text-emerald-600 border-emerald-600/30 hover:bg-emerald-500/10 w-full sm:w-auto"
                                        onClick={() => handleSendVerification(loan.id, client.phone, client.full_name)}
                                        disabled={sendingVerification === loan.id}
                                      >
                                        {sendingVerification === loan.id ? (
                                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                        ) : (
                                          <MessageCircle className="h-4 w-4 mr-1" />
                                        )}
                                        Enviar WhatsApp
                                      </Button>
                                    ) : loan.identity_verification.status === "pending" ? (
                                      <>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="flex-1 sm:flex-none"
                                          onClick={() => copyVerificationLink(loan.identity_verification!.token)}
                                        >
                                          <Copy className="h-4 w-4 mr-1" />
                                          Copiar
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="flex-1 sm:flex-none"
                                          onClick={() => resendVerification(
                                            loan.id,
                                            loan.identity_verification!.token,
                                            client.phone,
                                            client.full_name
                                          )}
                                        >
                                          <Send className="h-4 w-4 mr-1" />
                                          Reenviar
                                        </Button>
                                      </>
                                    ) : loan.identity_verification.photo_url ? (
                                      <Dialog>
                                        <DialogTrigger asChild>
                                          <Button size="sm" variant="outline" className="w-full sm:w-auto">
                                            <Eye className="h-4 w-4 mr-1" />
                                            Ver foto
                                          </Button>
                                        </DialogTrigger>
                                        <DialogContent className="max-w-2xl">
                                          <DialogHeader>
                                            <DialogTitle>Foto de Verificação - {client.full_name}</DialogTitle>
                                          </DialogHeader>
                                          <div className="mt-4">
                                            <img
                                              src={loan.identity_verification.photo_url}
                                              alt="Foto de verificação"
                                              className="w-full rounded-lg"
                                            />
                                            <p className="text-sm text-muted-foreground mt-3 text-center">
                                              Verificado em{" "}
                                              {loan.identity_verification.verified_at
                                                ? format(
                                                    new Date(loan.identity_verification.verified_at),
                                                    "dd/MM/yyyy 'às' HH:mm",
                                                    { locale: ptBR }
                                                  )
                                                : "Data não disponível"}
                                            </p>
                                          </div>
                                        </DialogContent>
                                      </Dialog>
                                    ) : null}
                                  </div>
                                </div>
                              </div>

                              {/* Mobile-friendly table wrapper */}
                              <div className="overflow-x-auto -mx-2 sm:mx-0">
                                <Table className="min-w-[700px]">
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead className="w-20">Parcela</TableHead>
                                      <TableHead>Valor</TableHead>
                                      <TableHead>Pago</TableHead>
                                      <TableHead>Restante</TableHead>
                                      <TableHead>Rest. + Juros</TableHead>
                                      <TableHead>Vencimento</TableHead>
                                      <TableHead>Status</TableHead>
                                      <TableHead className="text-right">Ação</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                <TableBody>
                                  {(() => {
                                    // Pre-calculate running balance for each installment
                                    // Overpayments carry forward as credit to reduce future installments
                                    let runningBalance = Number(loan.original_amount);
                                    let credit = 0;
                                    const rate = Number(loan.interest_rate || 0);
                                    const balanceData = loan.installments.map((inst) => {
                                      const balanceBefore = runningBalance;
                                      const instAmount = Number(inst.amount);
                                      const instPaid = Number(inst.amount_paid || 0);
                                      // Apply credit from previous overpayments to reduce this installment's effective principal
                                      const effectivePrincipal = Math.max(instAmount - credit, 0);
                                      credit = Math.max(credit - instAmount, 0);
                                      // Interest on balance BEFORE this payment
                                      const jurosOnBalance = balanceBefore * (rate / 100);
                                      // Total due = effective principal + interest. Credit only if paid MORE than that
                                      const totalDue = effectivePrincipal + jurosOnBalance;
                                      const overpayment = Math.max(instPaid - totalDue, 0);
                                      credit += overpayment;
                                      // Deduct principal from balance (effective principal or more if overpaid beyond interest)
                                      const principalPaid = effectivePrincipal + overpayment;
                                      runningBalance = Math.max(runningBalance - principalPaid, 0);
                                      return { balanceBefore, balanceAfter: runningBalance, instAmount, instPaid, effectivePrincipal };
                                    });

                                    return loan.installments.map((installment, idx) => {
                                    const todayCheck = new Date();
                                    todayCheck.setHours(0, 0, 0, 0);
                                    const dueDateCheck = new Date(installment.due_date + "T00:00:00");
                                    const isOverdue = !installment.paid && dueDateCheck < todayCheck;
                                    const daysLate = isOverdue ? differenceInCalendarDays(todayCheck, dueDateCheck) : 0;
                                    const lateFee = daysLate * Number(loan.daily_late_fee || 0);
                                    const instAmount = balanceData[idx].instAmount;
                                    const instPaid = balanceData[idx].instPaid;
                                    const effectivePrincipal = balanceData[idx].effectivePrincipal;
                                    const instRemaining = Math.max(effectivePrincipal - instPaid, 0);
                                    const displayAmount = effectivePrincipal + lateFee;
                                    const instStatus = installment.status || (installment.paid ? "liquidado" : "pendente");
                                    const { balanceBefore, balanceAfter } = balanceData[idx];
                                    const juros = balanceBefore * (rate / 100);

                                    return (
                                      <TableRow key={installment.id}>
                                        <TableCell>
                                          {installment.installment_number}/
                                          {loan.installments_count}
                                        </TableCell>
                                        <TableCell>
                                          {isOverdue && lateFee > 0 ? (
                                            <div>
                                              <span className="line-through text-muted-foreground text-xs">
                                                {formatCurrency(effectivePrincipal)}
                                              </span>
                                              <span className="block font-semibold text-destructive">
                                                {formatCurrency(displayAmount)}
                                              </span>
                                              <span className="text-xs text-muted-foreground">
                                                +{daysLate}d × {formatCurrency(Number(loan.daily_late_fee))}
                                              </span>
                                            </div>
                                          ) : effectivePrincipal < instAmount ? (
                                            <div>
                                              <span className="line-through text-muted-foreground text-xs">
                                                {formatCurrency(instAmount)}
                                              </span>
                                              <span className="block font-semibold text-emerald-600">
                                                {formatCurrency(effectivePrincipal)}
                                              </span>
                                              <span className="text-xs text-muted-foreground">
                                                crédito anterior aplicado
                                              </span>
                                            </div>
                                          ) : (
                                            formatCurrency(effectivePrincipal)
                                          )}
                                        </TableCell>
                                        <TableCell>
                                          <span className={instPaid > 0 ? "font-semibold text-emerald-600" : "text-muted-foreground"}>
                                            {formatCurrency(instPaid)}
                                          </span>
                                        </TableCell>
                                        <TableCell>
                                          <span className={balanceAfter > 0 ? "font-semibold text-destructive" : "text-emerald-600 font-semibold"}>
                                            {formatCurrency(balanceAfter)}
                                          </span>
                                        </TableCell>
                                        <TableCell>
                                          {instStatus !== "liquidado" ? (
                                            <div>
                                              <span className="font-bold text-foreground">{formatCurrency(effectivePrincipal + juros)}</span>
                                              {rate > 0 && <span className="block text-xs text-amber-600">+{formatCurrency(juros)} juros</span>}
                                            </div>
                                          ) : (
                                            <span className="text-muted-foreground">-</span>
                                          )}
                                        </TableCell>
                                        <TableCell>
                                          {format(
                                            new Date(installment.due_date + "T00:00:00"),
                                            "dd/MM/yyyy",
                                            { locale: ptBR }
                                          )}
                                        </TableCell>
                                        <TableCell>
                                          {instStatus === "liquidado" ? (
                                            <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-0">
                                              <CheckCircle2 className="mr-1 h-3 w-3" />
                                              Liquidado
                                            </Badge>
                                          ) : instStatus === "parcial" ? (
                                            <Badge className="bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border-0">
                                              <Clock className="mr-1 h-3 w-3" />
                                              Parcial
                                            </Badge>
                                          ) : isOverdue ? (
                                            <Badge variant="destructive" className="border-0">
                                              <Clock className="mr-1 h-3 w-3" />
                                              Vencida
                                            </Badge>
                                          ) : (
                                            <Badge variant="outline" className="border-border">
                                              <Clock className="mr-1 h-3 w-3" />
                                              Pendente
                                            </Badge>
                                          )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                          {instStatus !== "liquidado" && (
                                            <Button
                                              size="sm"
                                              onClick={() =>
                                                setPartialPayment({
                                                  installmentId: installment.id,
                                                  installmentNumber: installment.installment_number,
                                                  amount: instAmount,
                                                  amountPaid: instPaid,
                                                  interestRate: Number(loan.interest_rate || 0),
                                                  loanBalanceBefore: balanceBefore,
                                                })
                                              }
                                              className="gradient-primary border-0 shadow-sm hover:opacity-90"
                                            >
                                              Pagar
                                            </Button>
                                          )}
                                        </TableCell>
                                      </TableRow>
                                    );
                                  });
                                  })()}
                                </TableBody>
                              </Table>
                              </div>

                              {/* Extrato de Pagamentos */}
                              {loan.installments.some(i => Number(i.amount_paid || 0) > 0) && (
                                <div className="rounded-xl border border-border/50 bg-muted/30 p-4 space-y-3">
                                  <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                                    📋 Extrato de Pagamentos
                                  </h4>
                                  <div className="space-y-2">
                                    {loan.installments
                                      .filter(i => Number(i.amount_paid || 0) > 0)
                                      .map((inst) => {
                                        const remaining = Math.max(Number(inst.amount) - Number(inst.amount_paid || 0), 0);
                                        const instStatus = inst.status || (inst.paid ? "liquidado" : "pendente");
                                        return (
                                          <div key={inst.id} className="flex items-center justify-between text-sm border-b border-border/30 pb-2 last:border-0">
                                            <div>
                                              <span className="font-medium">Parcela {inst.installment_number}/{loan.installments_count}</span>
                                              <span className="text-muted-foreground ml-2">
                                                Venc: {format(new Date(inst.due_date + "T00:00:00"), "dd/MM/yyyy")}
                                              </span>
                                              {inst.paid_at && (
                                                <span className="text-muted-foreground ml-2">
                                                  • Pago em: {format(new Date(inst.paid_at), "dd/MM/yyyy")}
                                                </span>
                                              )}
                                            </div>
                                            <div className="text-right">
                                              <span className="font-semibold text-emerald-600">
                                                {formatCurrency(Number(inst.amount_paid || 0))}
                                              </span>
                                              {remaining > 0 && (
                                                <span className="text-xs text-destructive ml-2">
                                                  (resta {formatCurrency(remaining)})
                                                </span>
                                              )}
                                              <Badge className="ml-2 text-xs" variant={instStatus === "liquidado" ? "default" : "secondary"}>
                                                {instStatus === "liquidado" ? "Liquidado" : "Parcial"}
                                              </Badge>
                                            </div>
                                          </div>
                                        );
                                      })}
                                  </div>
                                  <div className="border-t border-border pt-3 grid grid-cols-3 gap-3 text-sm">
                                    <div>
                                      <p className="text-muted-foreground">Total Empréstimo</p>
                                      <p className="font-bold">{formatCurrency(Number(loan.original_amount))}</p>
                                    </div>
                                    <div>
                                      <p className="text-muted-foreground">Total Pago</p>
                                      <p className="font-bold text-emerald-600">
                                        {formatCurrency(loan.installments.reduce((s, i) => s + Number(i.amount_paid || 0), 0))}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-muted-foreground">Saldo Devedor</p>
                                      <p className="font-bold text-destructive">
                                        {formatCurrency(
                                          Math.max(
                                            Number(loan.original_amount) -
                                            loan.installments.reduce((s, i) => s + Number(i.amount_paid || 0), 0),
                                            0
                                          )
                                        )}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </CardContent>
      {editingClient && (
        <EditClientDialog
          client={editingClient}
          open={!!editingClient}
          onOpenChange={(open) => { if (!open) setEditingClient(null); }}
          onSuccess={() => { refetch(); onDataChange?.(); }}
        />
      )}
      {editingLoan && (
        <EditLoanDialog
          loan={editingLoan}
          open={!!editingLoan}
          onOpenChange={(open) => { if (!open) setEditingLoan(null); }}
          onSuccess={() => { refetch(); onDataChange?.(); }}
        />
      )}
      {interestPaymentLoan && (
        <InterestPaymentDialog
          loanId={interestPaymentLoan.loanId}
          remainingInterest={interestPaymentLoan.remaining}
          open={!!interestPaymentLoan}
          onOpenChange={(open) => { if (!open) setInterestPaymentLoan(null); }}
          onSuccess={() => { refetch(); onDataChange?.(); }}
        />
      )}
      {partialPayment && (
        <PartialPaymentDialog
          installmentId={partialPayment.installmentId}
          installmentNumber={partialPayment.installmentNumber}
          installmentAmount={partialPayment.amount}
          amountPaid={partialPayment.amountPaid}
          interestRate={partialPayment.interestRate}
          loanBalanceBefore={partialPayment.loanBalanceBefore}
          open={!!partialPayment}
          onOpenChange={(open) => { if (!open) setPartialPayment(null); }}
          onSuccess={() => { refetch(); onDataChange?.(); }}
        />
      )}
      {addingLoanToClient && (
        <Dialog open={!!addingLoanToClient} onOpenChange={(open) => { if (!open) setAddingLoanToClient(null); }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto shadow-hover" onPointerDownOutside={(e) => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle className="text-xl">Novo Empréstimo — {addingLoanToClient.name}</DialogTitle>
            </DialogHeader>
            <LoanConfigForm
              clientId={addingLoanToClient.id}
              clientName={addingLoanToClient.name}
              onSuccess={() => { setAddingLoanToClient(null); refetch(); onDataChange?.(); }}
              onBack={() => setAddingLoanToClient(null)}
            />
          </DialogContent>
        </Dialog>
      )}
      {advancePayment && (
        <AdvancePaymentDialog
          loanId={advancePayment.loanId}
          originalAmount={advancePayment.originalAmount}
          totalPaid={advancePayment.totalPaid}
          interestRate={advancePayment.interestRate}
          installments={advancePayment.installments}
          open={!!advancePayment}
          onOpenChange={(open) => { if (!open) setAdvancePayment(null); }}
          onSuccess={() => { refetch(); onDataChange?.(); }}
        />
      )}
    </Card>
  );
}
