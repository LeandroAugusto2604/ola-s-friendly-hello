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
import { Loader2, Search, UserPlus } from "lucide-react";

export type { ClientFormData } from "@/lib/client-registration";

interface ClientFormProps {
  onSuccess: () => void;
}

export function ClientForm({ onSuccess }: ClientFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
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
        toast({ title: "Cliente já cadastrado!", description: `${existing.full_name} já existe. Adicione empréstimos diretamente na lista.` });
      } else {
        toast({ title: "Cliente não encontrado", description: "Preencha os dados para cadastrar." });
      }
    } catch (error: any) {
      console.error(error);
    } finally {
      setIsSearching(false);
    }
  };

  const onSubmit = async (data: ClientFormData) => {
    if (!user) {
      toast({ title: "Erro", description: "Você precisa estar logado", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const cpfClean = data.cpf.replace(/\D/g, "");

      const { data: existing } = await supabase
        .from("clients")
        .select("id")
        .eq("cpf", cpfClean)
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        toast({ title: "Cliente já existe!", description: "Adicione empréstimos diretamente na lista." });
        onSuccess();
        return;
      }

      const { error } = await supabase
        .from("clients")
        .insert({
          full_name: data.fullName,
          address: data.address,
          rg: data.rg,
          cpf: cpfClean,
          phone: data.phone.replace(/\D/g, ""),
          user_id: user.id,
        });

      if (error) throw error;

      toast({ title: "Cliente cadastrado!", description: `${data.fullName} foi cadastrado. Agora adicione um empréstimo na lista.` });
      form.reset();
      onSuccess();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message || "Tente novamente", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
          💡 Cadastre o cliente primeiro. Depois, adicione empréstimos diretamente no perfil dele.
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
              <UserPlus className="h-5 w-5" />
              Cadastrar Cliente
            </>
          )}
        </Button>
      </form>
    </Form>
  );
}
