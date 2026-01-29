import { useState, useCallback } from "react";
import { LoanForm } from "@/components/LoanForm";
import { LoansList } from "@/components/LoansList";
import { DashboardStats } from "@/components/DashboardStats";
import { OverdueAlert } from "@/components/OverdueAlert";
import { AuthForm } from "@/components/AuthForm";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Banknote, LogOut, Plus, Radio } from "lucide-react";

function DashboardContent() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { user, signOut, loading } = useAuth();

  const handleDataChange = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  const handleLoanSuccess = () => {
    handleDataChange();
    setIsDialogOpen(false);
  };

  // Subscribe to real-time updates from all tables
  useRealtimeSubscription({
    tables: ["clients", "loans", "installments"],
    onDataChange: handleDataChange,
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="space-y-4 w-full max-w-md p-8">
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-32 w-full rounded-lg" />
          <Skeleton className="h-8 w-3/4 rounded-lg" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthForm />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="gradient-header text-white sticky top-0 z-10 shadow-soft">
        <div className="container mx-auto px-4 py-4 lg:py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm border border-white/20">
                <Banknote className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl lg:text-2xl font-bold tracking-tight">
                  LoanManager
                </h1>
                <p className="text-sm text-white/70 hidden sm:block">
                  {user.email}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge 
                variant="outline" 
                className="gap-1.5 hidden sm:flex bg-white/10 border-white/20 text-white hover:bg-white/20"
              >
                <Radio className="h-3 w-3 text-emerald-400 animate-pulse" />
                Tempo real
              </Badge>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={signOut}
                className="text-white hover:bg-white/10 hover:text-white"
              >
                <LogOut className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Sair</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 lg:py-8">
        <div className="space-y-6 lg:space-y-8 animate-fade-in">
          {/* Overdue Alert */}
          <OverdueAlert refreshKey={refreshKey} />

          {/* Stats */}
          <DashboardStats refreshKey={refreshKey} />

          {/* Add Loan Section */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Gerenciar Empréstimos
              </h2>
              <p className="text-sm text-muted-foreground">
                Visualize e gerencie todos os clientes e empréstimos
              </p>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="lg" className="gap-2 shadow-soft gradient-primary border-0 hover:opacity-90 transition-smooth">
                  <Plus className="h-5 w-5" />
                  <span className="hidden sm:inline">Novo Empréstimo</span>
                  <span className="sm:hidden">Novo</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto shadow-hover">
                <DialogHeader>
                  <DialogTitle className="text-xl">Cadastrar Novo Empréstimo</DialogTitle>
                </DialogHeader>
                <LoanForm onSuccess={handleLoanSuccess} />
              </DialogContent>
            </Dialog>
          </div>

          {/* Loans List */}
          <LoansList refreshKey={refreshKey} onDataChange={handleDataChange} />
        </div>
      </main>
    </div>
  );
}

const Index = () => {
  return (
    <AuthProvider>
      <DashboardContent />
    </AuthProvider>
  );
};

export default Index;
