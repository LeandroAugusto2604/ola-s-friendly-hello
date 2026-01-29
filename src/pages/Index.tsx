import { useState } from "react";
import { LoanForm } from "@/components/LoanForm";
import { LoansList } from "@/components/LoansList";
import { DashboardStats } from "@/components/DashboardStats";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreditCard, LayoutDashboard, UserPlus } from "lucide-react";

const Index = () => {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleLoanCreated = () => {
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <CreditCard className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                Sistema de Empréstimos
              </h1>
              <p className="text-sm text-muted-foreground">
                Gestão profissional de empréstimos e parcelas
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* Stats */}
          <DashboardStats refreshKey={refreshKey} />

          {/* Tabs */}
          <Tabs defaultValue="new" className="space-y-6">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="new" className="gap-2">
                <UserPlus className="h-4 w-4" />
                Novo Cadastro
              </TabsTrigger>
              <TabsTrigger value="list" className="gap-2">
                <LayoutDashboard className="h-4 w-4" />
                Ver Empréstimos
              </TabsTrigger>
            </TabsList>

            <TabsContent value="new">
              <LoanForm onSuccess={handleLoanCreated} />
            </TabsContent>

            <TabsContent value="list">
              <LoansList refreshKey={refreshKey} onDataChange={handleLoanCreated} />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default Index;
