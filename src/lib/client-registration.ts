import { z } from "zod";

export const clientSchema = z.object({
  fullName: z.string().trim().min(3, "Nome deve ter pelo menos 3 caracteres").max(150),
  address: z.string().trim().min(5, "Endereço deve ter pelo menos 5 caracteres").max(500),
  rg: z.string().trim().min(5, "RG inválido").max(30),
  cpf: z.string().regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$|^\d{11}$/, "CPF inválido"),
  phone: z.string().max(15, "Celular inválido").refine(value => /^\d{10,11}$/.test(value.replace(/\D/g, "")), "Celular inválido"),
});

export type ClientFormData = z.infer<typeof clientSchema>;
export const emptyClient = { fullName: "", address: "", rg: "", cpf: "", phone: "" };
export const formatCPF = (value: string) => value.replace(/\D/g, "").slice(0, 11)
  .replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})/, "$1-$2");
export const formatPhone = (value: string) => value.replace(/\D/g, "").slice(0, 11)
  .replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
export const isRegistrationToken = (token: string) => /^[a-f0-9]{64}$/.test(token);
export function registrationUrl(origin: string, token: string) {
  if (!isRegistrationToken(token)) throw new Error("Link inválido");
  // Hash routes keep invitations working on VPS hosts without a catch-all rewrite.
  return `${origin.replace(/\/$/, "")}/#/cadastro-cliente/${token}`;
}