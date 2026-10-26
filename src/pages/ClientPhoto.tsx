import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { isRegistrationToken } from "@/lib/client-registration";
import { validateRegistrationPhoto } from "@/lib/registration-photo";
import { RegistrationPhotoCapture } from "@/components/RegistrationPhotoCapture";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, Send } from "lucide-react";

export default function ClientPhoto({ invitationToken }: { invitationToken?: string }) {
  const params = useParams();
  const token = invitationToken ?? params.token ?? "";
  const [status, setStatus] = useState("loading");
  const [photo, setPhoto] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    if (!isRegistrationToken(token)) { setStatus("invalid"); return; }
    supabase.rpc("client_photo_invite_status", { p_token: token }).then(({ data, error }) => {
      if (active) setStatus(error ? "error" : data || "invalid");
    });
    return () => { active = false; };
  }, [token]);
  async function submit() {
    const validation = validateRegistrationPhoto(photo);
    if (validation || !photo) { setError(validation || "Envie a foto."); return; }
    setSending(true); setError("");
    try {
      const body = new FormData();
      body.append("token", token); body.append("mode", "photo"); body.append("photo", photo);
      const { data, error } = await supabase.functions.invoke("register-client", { body });
      if (error || !data?.success) {
        let message = "Não foi possível enviar a foto. Tente novamente.";
        if (error?.context instanceof Response) {
          const details = await error.context.json().catch(() => null);
          if (typeof details?.error === "string") message = details.error;
        }
        throw new Error(message);
      }
      setPhoto(null); setStatus("completed");
    } catch (error) { setError(error instanceof Error ? error.message : "Tente novamente."); }
    finally { setSending(false); }
  }
  return <div className="min-h-screen bg-background px-4 py-8"><main className="mx-auto max-w-xl space-y-6">
    <h1 className="text-xl font-bold text-primary">Gerenciamento de Empréstimos</h1>
    <h2 className="text-2xl font-semibold">Nova foto com RG</h2>
    {status === "loading" ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : status === "pending" ? <>
      <RegistrationPhotoCapture photo={photo} onChange={file => { setPhoto(file); setError(""); }} disabled={sending} />
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button onClick={submit} disabled={sending} className="w-full gap-2">{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Enviar foto</Button>
    </> : status === "completed" ? <div role="status" className="space-y-3"><CheckCircle2 className="h-10 w-10 text-primary" /><h3 className="text-xl font-semibold">Foto recebida!</h3><p className="text-muted-foreground">Este link já foi utilizado.</p></div> : <p role="alert" className="text-muted-foreground">{status === "error" ? "Não foi possível conferir o link. Tente novamente." : "Link inválido ou expirado. Solicite um novo link ao responsável."}</p>}
  </main></div>;
}