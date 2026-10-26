import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "@/integrations/supabase/client";
import { clientSchema, ClientFormData, emptyClient, isRegistrationToken } from "@/lib/client-registration";
import { ClientRegistrationFields } from "@/components/ClientRegistrationFields";
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Banknote, CheckCircle2, Loader2, Send } from "lucide-react";
import { RegistrationPhotoCapture } from "@/components/RegistrationPhotoCapture";
import { validateOptionalRegistrationPhoto } from "@/lib/client-photo";

export default function ClientRegistration({ invitationToken }: { invitationToken?: string }) {
  const params = useParams();
  const token = invitationToken ?? params.token ?? "";
  const [status, setStatus] = useState("loading");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const form = useForm<ClientFormData>({ resolver: zodResolver(clientSchema), defaultValues: emptyClient });
  useEffect(() => {
    let active = true;
    if (!isRegistrationToken(token)) { setStatus("invalid"); return; }
    supabase.rpc("client_registration_invite_status", { p_token: token }).then(({ data, error }) => {
      if (active) setStatus(error ? "error" : data || "invalid");
    });
    return () => { active = false; };
  }, [token]);
  async function submit(data: ClientFormData) {
    const photoError = validateOptionalRegistrationPhoto(photo);
    if (photoError) { setError(photoError); return; }
    setSending(true); setError("");
    try {
      const body = new FormData();
      body.append("token", token);
      Object.entries(data).forEach(([key, value]) => body.append(key, value));
      if (photo) body.append("photo", photo);
      const { data: result, error: submitError } = await supabase.functions.invoke("register-client", { body });
      if (submitError) {
        let message = "Não foi possível enviar o cadastro. Tente novamente.";
        if (submitError.context instanceof Response) {
          const details = await submitError.context.json().catch(() => null);
          if (typeof details?.error === "string") message = details.error;
        }
        throw new Error(message);
      }
      if (!result?.success) throw new Error("Não foi possível enviar o cadastro.");
      form.reset(); setPhoto(null); setStatus("completed");
    } catch (submitError) { setError(submitError instanceof Error ? submitError.message : "Tente novamente."); }
    finally { setSending(false); }
  }
  return <div className="min-h-screen bg-background px-4 py-8">
    <header className="mx-auto mb-8 flex max-w-xl items-center gap-3 text-primary"><Banknote className="h-8 w-8 shrink-0" /><h1 className="text-xl font-bold">Gerenciamento de Empréstimos</h1></header>
    <main className="mx-auto max-w-xl space-y-6">
      <h2 className="text-2xl font-semibold text-foreground">Cadastro do Cliente</h2>
      {status === "loading" ? <Loader2 aria-label="Carregando cadastro" className="h-6 w-6 animate-spin text-primary" /> : status === "pending" ?
        <Form {...form}><form onSubmit={form.handleSubmit(submit)} className="space-y-6">
          <ClientRegistrationFields form={form} />
          <RegistrationPhotoCapture photo={photo} onChange={file => { setPhoto(file); setError(""); }} disabled={sending} />
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full gap-2" disabled={sending}>{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Enviar Cadastro</Button>
        </form></Form> : status === "completed" ? <div role="status" className="space-y-3"><CheckCircle2 className="h-10 w-10 text-primary" /><h3 className="text-xl font-semibold">Cadastro recebido!</h3><p className="text-muted-foreground">Seus dados foram enviados ao responsável. Este link já foi utilizado.</p></div> :
          <p role="alert" className="text-muted-foreground">{status === "error" ? "Não foi possível carregar o cadastro. Tente abrir o link novamente." : "Este link é inválido ou expirou. Solicite um novo link ao responsável."}</p>}
    </main>
  </div>;
}