import { useState } from "react";
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
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, Clock, FileText, Search, Trash2, User, MessageCircle, Copy, Eye, Send, Loader2 } from "lucide-react";

interface Installment {
  id: string;
  installment_number: number;
  amount: number;
  due_date: string;
  paid: boolean;
  paid_at: string | null;
}

interface IdentityVerification {
  id: string;
  token: string;
  status: string;
  photo_url: string | null;
  created_at: string;
  verified_at: string | null;
}

interface Loan {
  id: string;
  amount: number;
  original_amount: number;
  interest_rate: number;
  installments_count: number;
  created_at: string;
  installments: Installment[];
  identity_verification?: IdentityVerification | null;
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

              return {
                ...loan,
                installments: installmentsData || [],
                identity_verification: verificationData || null,
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

    setSendingVerification(loanId);

    try {
      // Generate unique token
      const token = crypto.randomUUID();

      // Create verification record
      const { error } = await supabase
        .from("identity_verifications")
        .insert({
          loan_id: loanId,
          token: token,
          status: "pending",
        });

      if (error) throw error;

      // Generate verification link
      const verificationLink = `https://emprestimo-zl.lovable.app/verify/${token}`;

      // Format phone for WhatsApp (remove non-digits and add country code if needed)
      const cleanPhone = clientPhone.replace(/\D/g, "");
      const whatsappPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;

      // Create WhatsApp message
      const message = encodeURIComponent(
        `Olá ${clientName}! Para confirmar seu empréstimo, acesse o link abaixo e tire uma foto segurando seu RG:\n\n${verificationLink}`
      );

      // Open WhatsApp - using location.href for better mobile compatibility
      const whatsappUrl = `https://wa.me/${whatsappPhone}?text=${message}`;
      window.location.href = whatsappUrl;

      toast({
        title: "Link gerado!",
        description: "O WhatsApp foi aberto com a mensagem pronta.",
      });

      refetch();
    } catch (error) {
      console.error("Error creating verification:", error);
      toast({
        title: "Erro",
        description: "Não foi possível gerar o link de verificação.",
        variant: "destructive",
      });
    } finally {
      setSendingVerification(null);
    }
  };

  const copyVerificationLink = (token: string) => {
    const link = `https://emprestimo-zl.lovable.app/verify/${token}`;
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

    const verificationLink = `https://emprestimo-zl.lovable.app/verify/${existingToken}`;
    const cleanPhone = clientPhone.replace(/\D/g, "");
    const whatsappPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
    const message = encodeURIComponent(
      `Olá ${clientName}! Para confirmar seu empréstimo, acesse o link abaixo e tire uma foto segurando seu RG:\n\n${verificationLink}`
    );

    const whatsappUrl = `https://wa.me/${whatsappPhone}?text=${message}`;
    window.location.href = whatsappUrl;

    toast({
      title: "WhatsApp aberto!",
      description: "Reenvie a mensagem para o cliente.",
    });
  };

  const handlePayInstallment = async (installmentId: string) => {
    const { error } = await supabase
      .from("installments")
      .update({ paid: true, paid_at: new Date().toISOString() })
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

                      {client.loans.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          Nenhum empréstimo cadastrado.
                        </p>
                      ) : (
                        client.loans.map((loan) => {
                          const paidCount = loan.installments.filter((i) => i.paid).length;
                          const totalPaid = loan.installments
                            .filter((i) => i.paid)
                            .reduce((sum, i) => sum + Number(i.amount), 0);
                          const loanStatus = getLoanStatus(loan);
                          const overdueInstallments = loan.installments.filter(
                            (i) => !i.paid && new Date(i.due_date) < new Date()
                          );

                          return (
                            <div
                              key={loan.id}
                              className="border border-border/50 rounded-xl p-5 space-y-4 bg-muted/30"
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {loan.interest_rate > 0 ? (
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <p className="text-lg text-foreground">
                                          {formatCurrency(Number(loan.original_amount))}
                                        </p>
                                        <span className="text-muted-foreground">→</span>
                                        <p className="text-lg text-foreground">
                                          {formatCurrency(Number(loan.amount))}
                                        </p>
                                        <Badge variant="outline" className="text-xs">
                                          +{loan.interest_rate}% juros
                                        </Badge>
                                      </div>
                                    ) : (
                                      <p className="text-lg text-foreground">
                                        {formatCurrency(Number(loan.amount))}
                                      </p>
                                    )}
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
                                    {formatCurrency(
                                      Number(loan.amount) / loan.installments_count
                                    )}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="text-right">
                                    <Badge
                                      variant={
                                        paidCount === loan.installments_count
                                          ? "default"
                                          : "secondary"
                                      }
                                    >
                                      {paidCount}/{loan.installments_count} pagas
                                    </Badge>
                                    <p className="text-sm text-muted-foreground mt-1">
                                      Pago: {formatCurrency(totalPaid)}
                                    </p>
                                  </div>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        variant="destructive"
                                        size="icon"
                                        className="ml-2"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>
                                          Remover empréstimo?
                                        </AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Esta ação não pode ser desfeita. O empréstimo
                                          de {formatCurrency(Number(loan.amount))} e
                                          todas as suas parcelas serão removidos
                                          permanentemente.
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

                              {/* Overdue summary */}
                              {overdueInstallments.length > 0 && (
                                <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 flex items-center gap-3">
                                  <div className="rounded-lg bg-destructive/20 p-2">
                                    <Clock className="h-4 w-4 text-destructive" />
                                  </div>
                                  <p className="text-sm font-medium text-destructive">
                                    {overdueInstallments.length} parcela(s) em atraso
                                    totalizando{" "}
                                    {formatCurrency(
                                      overdueInstallments.reduce(
                                        (sum, i) => sum + Number(i.amount),
                                        0
                                      )
                                    )}
                                  </p>
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
                                <Table className="min-w-[500px]">
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead className="w-20">Parcela</TableHead>
                                      <TableHead>Valor</TableHead>
                                      <TableHead>Vencimento</TableHead>
                                      <TableHead>Status</TableHead>
                                      <TableHead className="text-right">Ação</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                <TableBody>
                                  {loan.installments.map((installment) => {
                                    const isOverdue =
                                      !installment.paid &&
                                      new Date(installment.due_date) < new Date();

                                    return (
                                      <TableRow key={installment.id}>
                                        <TableCell>
                                          {installment.installment_number}/
                                          {loan.installments_count}
                                        </TableCell>
                                        <TableCell>
                                          {formatCurrency(Number(installment.amount))}
                                        </TableCell>
                                        <TableCell>
                                          {format(
                                            new Date(installment.due_date + "T00:00:00"),
                                            "dd/MM/yyyy",
                                            { locale: ptBR }
                                          )}
                                        </TableCell>
                                        <TableCell>
                                          {installment.paid ? (
                                            <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-0">
                                              <CheckCircle2 className="mr-1 h-3 w-3" />
                                              Pago
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
                                          {!installment.paid && (
                                            <Button
                                              size="sm"
                                              onClick={() =>
                                                handlePayInstallment(installment.id)
                                              }
                                              className="gradient-primary border-0 shadow-sm hover:opacity-90"
                                            >
                                              Marcar Pago
                                            </Button>
                                          )}
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })}
                                </TableBody>
                              </Table>
                              </div>
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
    </Card>
  );
}
