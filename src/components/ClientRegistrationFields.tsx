import { UseFormReturn } from "react-hook-form";
import { ClientFormData, formatCPF, formatPhone } from "@/lib/client-registration";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Search } from "lucide-react";

export function ClientRegistrationFields({ form, onSearch, isSearching = false }: {
  form: UseFormReturn<ClientFormData>; onSearch?: () => void; isSearching?: boolean;
}) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
    <FormField control={form.control} name="fullName" render={({ field }) => <FormItem className="sm:col-span-2">
      <FormLabel>Nome Completo</FormLabel><FormControl><Input autoComplete="name" maxLength={150} placeholder="João da Silva" {...field} /></FormControl><FormMessage />
    </FormItem>} />
    <FormField control={form.control} name="address" render={({ field }) => <FormItem className="sm:col-span-2">
      <FormLabel>Endereço</FormLabel><FormControl><Input autoComplete="street-address" maxLength={500} placeholder="Rua, número, bairro, cidade" {...field} /></FormControl><FormMessage />
    </FormItem>} />
    <FormField control={form.control} name="phone" render={({ field }) => <FormItem>
      <FormLabel>Celular</FormLabel><FormControl><Input type="tel" autoComplete="tel" placeholder="(00) 00000-0000" {...field} onChange={e => field.onChange(formatPhone(e.target.value))} maxLength={15} /></FormControl><FormMessage />
    </FormItem>} />
    <FormField control={form.control} name="rg" render={({ field }) => <FormItem>
      <FormLabel>RG</FormLabel><FormControl><Input placeholder="00.000.000-0" maxLength={30} {...field} /></FormControl><FormMessage />
    </FormItem>} />
    <FormField control={form.control} name="cpf" render={({ field }) => <FormItem className="sm:col-span-2">
      <FormLabel>CPF</FormLabel><div className="flex gap-2"><FormControl><Input inputMode="numeric" placeholder="000.000.000-00" {...field} onChange={e => field.onChange(formatCPF(e.target.value))} maxLength={14} /></FormControl>
        {onSearch && <Button type="button" variant="outline" size="icon" aria-label="Buscar cliente por CPF" onClick={onSearch} disabled={isSearching}>{isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}</Button>}
      </div><FormMessage />
    </FormItem>} />
  </div>;
}