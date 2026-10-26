import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { clientSchema, ClientFormData } from "@/lib/client-registration";
import { ClientRegistrationFields } from "@/components/ClientRegistrationFields";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { toast } from "@/hooks/use-toast";
import { Loader2, Search, UserPlus, ArrowRight } from "lucide-react";
import { ClientRegistrationLink } from "@/components/ClientRegistrationLink";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoanConfigForm } from "@/components/LoanConfigForm";


interface NewClientLoanFlowProps {
  onSuccess: () => void;
}

export function NewClientLoanFlow({ onSuccess }: NewClientLoanFlowProps) {
  const [mode, setMode] = useState("manual");
  const [step, setStep] = useState<"client" | "loan">("client");
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [registeredClient, setRegisteredClient] = useState<{ id: string; name: string } | null>(null);
  const { user } = useAuth();

  const form = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      fullName: "",
      address: "",
      rg: "",
      cpf: "",
      phone: "",
    },
  });

  const formatCPF = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    return numbers
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})/, "$1-$2")
      .replace(/(-\d{2})\d+?$/, "$1");
  };

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    return numbers
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{5})(\d)/, "$1-$2")
      .replace(/(-\d{4})\d+?$/, "$1");
  };

  const searchByCPF = async () => {
    const cpf = form.getValues("cpf");
    if (!cpf || !user) return;
    const cpfClean = cpf.replace(/\D/g, "");
    if (cpfClean.length < 11) return;

    setIsSearching(true);
    try {
      const { data: existing } = await supabase
        .from("clients")
        .select("*")
        .eq("cpf", cpfClean)
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        form.setValue("fullName", existing.full_name);
        form.setValue("address", existing.address);
        form.setValue("rg", existing.rg);
        form.setValue("phone", existing.phone || "");
        toast({ title: "Cliente encontrado!", description: `${existing.full_name} já está cadastrado. Prossiga para o empréstimo.` });
        // Go directly to loan step
        setRegisteredClient({ id: existing.id, name: existing.full_name });
        setStep("loan");
      } else {
        toast({ title: "Cliente não encontrado", description: "Preencha os dados para cadastrar." });
      }
    } catch (error: any) {
      console.error(error);
    } finally {
      setIsSearching(false);
    }
  };

  const onSubmitClient = async (data: ClientFormData) => {
    if (!user) {
      toast({ title: "Erro", description: "Você precisa estar logado", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const cpfClean = data.cpf.replace(/\D/g, "");

      const { data: existing } = await supabase
        .from("clients")
        .select("id, full_name")
        .eq("cpf", cpfClean)
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        toast({ title: "Cliente já existe!", description: "Prosseguindo para o empréstimo." });
        setRegisteredClient({ id: existing.id, name: existing.full_name });
        setStep("loan");
        return;
      }

      const { data: newClient, error } = await supabase
        .from("clients")
        .insert({
          full_name: data.fullName,
          address: data.address,
          rg: data.rg,
          cpf: cpfClean,
          phone: data.phone.replace(/\D/g, ""),
          user_id: user.id,
        })
        .select("id, full_name")
        .single();

      if (error) throw error;

      toast({ title: "Cliente cadastrado!", description: `Agora configure o empréstimo para ${data.fullName}.` });
      setRegisteredClient({ id: newClient.id, name: newClient.full_name });
      setStep("loan");
    } catch (error: any) {
      toast({ title: "Erro", description: error.message || "Tente novamente", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  if (step === "loan" && registeredClient) {
    return (
      <div className="space-y-4">
        <h3 className="text-xl font-semibold text-foreground">
          Novo Empréstimo — {registeredClient.name}
        </h3>
        <LoanConfigForm
          clientId={registeredClient.id}
          clientName={registeredClient.name}
          onSuccess={onSuccess}
          onBack={() => {
            setStep("client");
            setRegisteredClient(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs value={mode} onValueChange={setMode}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="manual">Cadastro manual</TabsTrigger>
          <TabsTrigger value="link">Enviar link</TabsTrigger>
        </TabsList>
      </Tabs>
      {mode === "link" ? <ClientRegistrationLink onRegistered={client => { setRegisteredClient(client); setStep("loan"); }} /> : <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmitClient)} className="space-y-4">
        <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
          💡 Cadastre o cliente e em seguida configure o empréstimo.
        </div>

        <ClientRegistrationFields form={form} onSearch={searchByCPF} isSearching={isSearching} />

        <Button type="submit" className="w-full h-12 gradient-primary border-0 shadow-soft hover:opacity-90 transition-smooth text-base gap-2" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Cadastrando...
            </>
          ) : (
            <>
              <ArrowRight className="h-5 w-5" />
              Cadastrar e Configurar Empréstimo
            </>
          )}
        </Button>
      </form>
    </Form>}
    </div>
  );
}
