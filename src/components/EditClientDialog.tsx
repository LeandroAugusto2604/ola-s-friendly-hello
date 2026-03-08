import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const editClientSchema = z.object({
  fullName: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  address: z.string().min(5, "Endereço deve ter pelo menos 5 caracteres"),
  rg: z.string().min(5, "RG inválido"),
  cpf: z.string().regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$|^\d{11}$/, "CPF inválido"),
  phone: z.string().min(10, "Celular inválido").max(15, "Celular inválido").or(z.literal("")),
});

type EditClientFormData = z.infer<typeof editClientSchema>;

interface ClientData {
  id: string;
  full_name: string;
  cpf: string;
  rg: string;
  address: string;
  phone: string | null;
}

interface EditClientDialogProps {
  client: ClientData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const formatCPFInput = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
};

const formatPhoneInput = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

export function EditClientDialog({ client, open, onOpenChange, onSuccess }: EditClientDialogProps) {
  const [saving, setSaving] = useState(false);

  const form = useForm<EditClientFormData>({
    resolver: zodResolver(editClientSchema),
    defaultValues: {
      fullName: client.full_name,
      address: client.address,
      rg: client.rg,
      cpf: formatCPFInput(client.cpf),
      phone: client.phone ? formatPhoneInput(client.phone) : "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        fullName: client.full_name,
        address: client.address,
        rg: client.rg,
        cpf: formatCPFInput(client.cpf),
        phone: client.phone ? formatPhoneInput(client.phone) : "",
      });
    }
  }, [open, client]);

  const onSubmit = async (data: EditClientFormData) => {
    setSaving(true);
    try {
      const cleanCpf = data.cpf.replace(/\D/g, "");
      const cleanPhone = data.phone ? data.phone.replace(/\D/g, "") : null;

      const { error } = await supabase
        .from("clients")
        .update({
          full_name: data.fullName.trim(),
          address: data.address.trim(),
          rg: data.rg.trim(),
          cpf: cleanCpf,
          phone: cleanPhone || null,
        })
        .eq("id", client.id);

      if (error) throw error;

      toast({
        title: "Cliente atualizado!",
        description: "Os dados foram salvos com sucesso.",
      });
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error?.message || "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Cliente</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome Completo</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Endereço</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="rg"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>RG</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="cpf"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CPF</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      onChange={(e) => field.onChange(formatCPFInput(e.target.value))}
                      maxLength={14}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Celular</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      onChange={(e) => field.onChange(formatPhoneInput(e.target.value))}
                      maxLength={15}
                      placeholder="(00) 00000-0000"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
