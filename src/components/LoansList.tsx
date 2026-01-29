import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, Clock, FileText, User } from "lucide-react";

interface Installment {
  id: string;
  installment_number: number;
  amount: number;
  due_date: string;
  paid: boolean;
  paid_at: string | null;
}

interface Loan {
  id: string;
  amount: number;
  installments_count: number;
  created_at: string;
  installments: Installment[];
}

interface Client {
  id: string;
  full_name: string;
  cpf: string;
  rg: string;
  address: string;
  loans: Loan[];
}

interface LoansListProps {
  refreshKey: number;
}

export function LoansList({ refreshKey }: LoansListProps) {
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

              return {
                ...loan,
                installments: installmentsData || [],
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

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Clientes e Empréstimos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!clients || clients.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Clientes e Empréstimos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">
            Nenhum cliente cadastrado ainda.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Clientes e Empréstimos
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Accordion type="multiple" className="space-y-4">
          {clients.map((client) => (
            <AccordionItem
              key={client.id}
              value={client.id}
              className="border rounded-lg px-4"
            >
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-4 text-left">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">{client.full_name}</p>
                    <p className="text-sm text-muted-foreground">
                      CPF: {formatCPF(client.cpf)} • {client.loans.length}{" "}
                      empréstimo(s)
                    </p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pt-4">
                  <div className="grid gap-2 text-sm">
                    <p>
                      <strong>RG:</strong> {client.rg}
                    </p>
                    <p>
                      <strong>Endereço:</strong> {client.address}
                    </p>
                  </div>

                  {client.loans.map((loan) => {
                    const paidCount = loan.installments.filter((i) => i.paid).length;
                    const totalPaid = loan.installments
                      .filter((i) => i.paid)
                      .reduce((sum, i) => sum + Number(i.amount), 0);

                    return (
                      <div
                        key={loan.id}
                        className="border rounded-lg p-4 space-y-4"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold">
                              {formatCurrency(Number(loan.amount))}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {loan.installments_count}x de{" "}
                              {formatCurrency(
                                Number(loan.amount) / loan.installments_count
                              )}
                            </p>
                          </div>
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
                        </div>

                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Parcela</TableHead>
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
                                      <Badge variant="default">
                                        <CheckCircle2 className="mr-1 h-3 w-3" />
                                        Pago
                                      </Badge>
                                    ) : isOverdue ? (
                                      <Badge variant="destructive">
                                        <Clock className="mr-1 h-3 w-3" />
                                        Vencida
                                      </Badge>
                                    ) : (
                                      <Badge variant="outline">
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
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}
