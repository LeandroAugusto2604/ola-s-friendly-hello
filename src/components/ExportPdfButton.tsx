import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { FileDown, Loader2 } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Installment {
  installment_number: number;
  amount: number;
  due_date: string;
  paid: boolean;
}

interface Loan {
  id: string;
  amount: number;
  original_amount: number;
  interest_rate: number;
  installments_count: number;
  created_at: string;
  installments: Installment[];
}

interface Client {
  full_name: string;
  cpf: string;
  phone: string | null;
  loans: Loan[];
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const formatCPF = (cpf: string) =>
  cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");

export function ExportPdfButton() {
  const [isLoading, setIsLoading] = useState(false);

  const handleExport = async () => {
    setIsLoading(true);
    try {
      // Fetch all clients
      const { data: clientsData, error: clientsError } = await supabase
        .from("clients")
        .select("*")
        .order("full_name", { ascending: true });

      if (clientsError) throw clientsError;

      // Fetch loans and installments for each client
      const clients: Client[] = await Promise.all(
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

              return { ...loan, installments: installmentsData || [] };
            })
          );

          return {
            full_name: client.full_name,
            cpf: client.cpf,
            phone: client.phone,
            loans: loansWithInstallments,
          };
        })
      );

      // Filter only clients with loans
      const clientsWithLoans = clients.filter((c) => c.loans.length > 0);

      if (clientsWithLoans.length === 0) {
        toast({
          title: "Nenhum dado",
          description: "Não há empréstimos cadastrados para exportar.",
          variant: "destructive",
        });
        return;
      }

      // Generate PDF
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      // Title
      doc.setFontSize(18);
      doc.text("Relatório de Empréstimos", pageWidth / 2, 20, { align: "center" });
      doc.setFontSize(10);
      doc.text(
        `Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
        pageWidth / 2,
        28,
        { align: "center" }
      );

      let yPos = 38;

      for (const client of clientsWithLoans) {
        // Check if we need a new page
        if (yPos > 250) {
          doc.addPage();
          yPos = 20;
        }

        // Client header
        doc.setFontSize(13);
        doc.setFont("helvetica", "bold");
        doc.text(client.full_name, 14, yPos);
        yPos += 6;

        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text(`CPF: ${formatCPF(client.cpf)}`, 14, yPos);
        if (client.phone) {
          const formattedPhone = client.phone.replace(
            /(\d{2})(\d{5})(\d{4})/,
            "($1) $2-$3"
          );
          doc.text(`  |  Tel: ${formattedPhone}`, 65, yPos);
        }
        yPos += 8;

        for (const loan of client.loans) {
          if (yPos > 250) {
            doc.addPage();
            yPos = 20;
          }

          const paidCount = loan.installments.filter((i) => i.paid).length;
          const totalCount = loan.installments.length;
          const paidAmount = loan.installments
            .filter((i) => i.paid)
            .reduce((sum, i) => sum + i.amount, 0);
          const remainingAmount = loan.amount - paidAmount;

          // Loan summary
          doc.setFontSize(10);
          doc.setFont("helvetica", "bold");
          const loanDate = format(new Date(loan.created_at), "dd/MM/yyyy", { locale: ptBR });
          doc.text(`Empréstimo - ${loanDate}`, 14, yPos);
          yPos += 5;

          doc.setFont("helvetica", "normal");
          doc.setFontSize(9);

          const interestText =
            loan.interest_rate > 0
              ? `Valor original: ${formatCurrency(loan.original_amount)} + ${loan.interest_rate}% juros = ${formatCurrency(loan.amount)}`
              : `Valor: ${formatCurrency(loan.amount)}`;
          doc.text(interestText, 14, yPos);
          yPos += 5;
          doc.text(
            `Parcelas: ${paidCount}/${totalCount} pagas  |  Pago: ${formatCurrency(paidAmount)}  |  Restante: ${formatCurrency(remainingAmount)}`,
            14,
            yPos
          );
          yPos += 6;

          // Installments table
          const tableData = loan.installments.map((inst) => [
            `${inst.installment_number}/${totalCount}`,
            formatCurrency(inst.amount),
            format(new Date(inst.due_date + "T00:00:00"), "dd/MM/yyyy"),
            inst.paid ? "Pago" : "Pendente",
          ]);

          autoTable(doc, {
            startY: yPos,
            head: [["Parcela", "Valor", "Vencimento", "Status"]],
            body: tableData,
            theme: "grid",
            headStyles: {
              fillColor: [59, 130, 246],
              fontSize: 8,
              fontStyle: "bold",
            },
            bodyStyles: { fontSize: 8 },
            columnStyles: {
              0: { halign: "center", cellWidth: 25 },
              1: { halign: "right", cellWidth: 35 },
              2: { halign: "center", cellWidth: 30 },
              3: { halign: "center", cellWidth: 25 },
            },
            margin: { left: 14, right: 14 },
            didParseCell: (data) => {
              if (data.section === "body" && data.column.index === 3) {
                if (data.cell.raw === "Pago") {
                  data.cell.styles.textColor = [22, 163, 74];
                  data.cell.styles.fontStyle = "bold";
                } else {
                  data.cell.styles.textColor = [220, 38, 38];
                }
              }
            },
          });

          yPos = (doc as any).lastAutoTable.finalY + 10;
        }

        // Separator line between clients
        doc.setDrawColor(200, 200, 200);
        doc.line(14, yPos - 4, pageWidth - 14, yPos - 4);
        yPos += 4;
      }

      // Save
      doc.save(`relatorio-emprestimos-${format(new Date(), "yyyy-MM-dd")}.pdf`);

      toast({
        title: "PDF exportado!",
        description: "O relatório foi baixado com sucesso.",
      });
    } catch (error: any) {
      console.error("Error exporting PDF:", error);
      toast({
        title: "Erro ao exportar",
        description: error.message || "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="lg"
      onClick={handleExport}
      disabled={isLoading}
      className="gap-2"
    >
      {isLoading ? (
        <>
          <Loader2 className="h-5 w-5 animate-spin" />
          Exportando...
        </>
      ) : (
        <>
          <FileDown className="h-5 w-5" />
          <span className="hidden sm:inline">Exportar PDF</span>
          <span className="sm:hidden">PDF</span>
        </>
      )}
    </Button>
  );
}
