import { useState, useCallback } from "react";
import { LoanForm } from "@/components/LoanForm";
import { LoansList } from "@/components/LoansList";
import { DashboardStats } from "@/components/DashboardStats";
import { AuthForm } from "@/components/AuthForm";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CreditCard, LayoutDashboard, LogOut, UserPlus, Wifi } from "lucide-react";

function DashboardContent() {
  const [refreshKey, setRefreshKey] = useState(0);
  const { user, signOut, loading } = useAuth();

  const handleDataChange = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  // Subscribe to real-time updates from all tables
  useRealtimeSubscription({
    tables: ["clients", "loans", "installments"],
    onDataChange: handleDataChange,
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="space-y-4 w-full max-w-md p-8">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-8 w-3/4" />
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
      <header className="border-b bg-card shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
                <CreditCard className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">
                  Sistema de Empréstimos
                </h1>
                <p className="text-sm text-muted-foreground">
                  {user.email}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="gap-1.5 hidden sm:flex">
                <Wifi className="h-3 w-3 text-green-500" />
                Tempo real
              </Badge>
              <Button variant="outline" size="sm" onClick={signOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Sair
              </Button>
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
              <LoanForm onSuccess={handleDataChange} />
            </TabsContent>

            <TabsContent value="list">
              <LoansList refreshKey={refreshKey} onDataChange={handleDataChange} />
            </TabsContent>
          </Tabs>
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
