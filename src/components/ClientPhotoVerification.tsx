import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { clientPhotoUrl, clientPhotoVerified } from "@/lib/client-photo";
import { ClientIdentityPhoto } from "@/components/ClientIdentityPhoto";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { CheckCircle2, Copy, Eye, Link, Loader2, MessageCircle, Trash2 } from "lucide-react";

type Props = { clientId: string; name: string; phone: string | null; path: string | null; legacy?: { status: string; photo_url: string | null } | null; onChange: () => void };
export function ClientPhotoVerification({ clientId, name, phone, path, legacy, onChange }: Props) {
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState("");
  const verified = clientPhotoVerified(path, legacy);
  async function createLink() {
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("create_client_photo_invite", { p_client_id: clientId });
      if (error) throw error;
      const token = data && typeof data === "object" && !Array.isArray(data) ? data.token : null;
      if (typeof token !== "string") throw new Error("Não foi possível gerar o link.");
      setLink(clientPhotoUrl(token));
    } catch { toast({ title: "Não foi possível gerar o link", variant: "destructive" }); }
    finally { setBusy(false); }
  }
  async function remove() {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("delete-client-photo", { body: { clientId } });
      if (error || !data?.success) throw new Error();
      setLink(""); onChange();
      toast({ title: "Foto excluída", description: data.cleanupPending ? "A verificação foi removida; a limpeza do arquivo será concluída depois." : "Cliente não verificado." });
    } catch { toast({ title: "Não foi possível excluir a foto", variant: "destructive" }); }
    finally { setBusy(false); }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(link); toast({ title: "Link copiado" }); }
    catch { toast({ title: "Não foi possível copiar", variant: "destructive" }); }
  }
  const digits = phone?.replace(/\D/g, "") || "";
  const recipient = /^\d{10,13}$/.test(digits) ? (digits.startsWith("55") && digits.length > 11 ? digits : `55${digits}`) : "";
  return <section className="space-y-3 rounded-lg border border-border bg-background p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-medium">Verificação:</span><Badge variant={verified ? "default" : "outline"}>{verified && <CheckCircle2 className="mr-1 h-3 w-3" />}{verified ? "Verificado" : "Não verificado"}</Badge></div>
      <div className="flex flex-wrap gap-2">
        {path ? <ClientIdentityPhoto path={path} name={name} /> : verified && legacy?.photo_url ? <Dialog><DialogTrigger asChild><Button variant="outline" size="sm"><Eye className="mr-2 h-4 w-4" />Ver foto</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Foto com RG — {name}</DialogTitle></DialogHeader><img src={legacy.photo_url} alt={`Foto com RG de ${name}`} className="max-h-[65vh] w-full object-contain" /></DialogContent></Dialog> : null}
        <Button variant="outline" size="sm" onClick={createLink} disabled={busy}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link className="mr-2 h-4 w-4" />}Link para nova foto</Button>
        {verified && <AlertDialog><AlertDialogTrigger asChild><Button variant="outline" size="sm" disabled={busy} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Excluir foto</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir foto com RG?</AlertDialogTitle><AlertDialogDescription>O cliente ficará não verificado em todos os empréstimos. Links anteriores para nova foto serão cancelados.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={remove}>Excluir foto</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>}
      </div>
    </div>
    {link && <div className="flex flex-wrap gap-2"><Input aria-label="Link para nova foto" value={link} readOnly className="min-w-0 flex-1" /><Button variant="outline" size="sm" onClick={copy}><Copy className="mr-2 h-4 w-4" />Copiar</Button><Button variant="outline" size="sm" onClick={() => window.open(`https://wa.me/${recipient}?text=${encodeURIComponent(`Olá ${name}! Envie uma nova foto segurando seu RG: ${link}`)}`, "_blank", "noopener,noreferrer")}><MessageCircle className="mr-2 h-4 w-4" />Enviar WhatsApp</Button></div>}
  </section>;
}