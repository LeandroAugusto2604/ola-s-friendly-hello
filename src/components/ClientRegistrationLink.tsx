import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { registrationUrl } from "@/lib/client-registration";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { CheckCircle2, Copy, Link, Loader2, Share2 } from "lucide-react";

export function ClientRegistrationLink({ onRegistered }: { onRegistered: (client: { id: string; name: string }) => void }) {
  const [invite, setInvite] = useState<{ id: string; url: string; expires: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [registered, setRegistered] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (!invite || completed) return;
    let active = true;
    const check = async () => {
      const { data } = await supabase.from("client_registration_invites").select("client_id, completed_at").eq("id", invite.id).maybeSingle();
      if (!active || !data?.completed_at || !data.client_id) return;
      const { data: client } = await supabase.from("clients").select("id, full_name").eq("id", data.client_id).single();
      if (active && client) {
        setCompleted(true);
        setRegistered({ id: client.id, name: client.full_name });
        toast({ title: "Cliente cadastrado!", description: `${client.full_name} enviou os dados.` });
      }
    };
    void check();
    const timer = window.setInterval(check, 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, [invite, completed]);

  async function createLink() {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("create_client_registration_invite");
      if (error) throw error;
      if (!data || typeof data !== "object" || Array.isArray(data) || typeof data.token !== "string" || typeof data.invitation_id !== "string" || typeof data.expires_at !== "string") throw new Error("Não foi possível gerar o link.");
      setInvite({ id: data.invitation_id, url: registrationUrl(data.token), expires: data.expires_at });
      setCompleted(false); setRegistered(null);
    } catch (error) {
      toast({ title: "Não foi possível gerar o link", description: error instanceof Error ? error.message : "Tente novamente.", variant: "destructive" });
    } finally { setLoading(false); }
  }
  async function copy() {
    if (!invite) return;
    try { await navigator.clipboard.writeText(invite.url); toast({ title: "Link copiado!" }); }
    catch { toast({ title: "Selecione e copie o link acima.", variant: "destructive" }); }
  }
  async function share() {
    if (!invite) return;
    const message = `Olá! Preencha seus dados para o cadastro: ${invite.url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  }
  return <div className="space-y-4 py-2">
    {completed && registered ? <>
      <div className="flex items-center gap-2 text-primary"><CheckCircle2 className="h-5 w-5" /><span>{registered.name} — cadastro recebido</span></div>
      <Button className="w-full" onClick={() => onRegistered(registered)}>Configurar Empréstimo</Button>
    </> : invite ? <>
      <Label htmlFor="client-registration-link">Link de cadastro</Label>
      <Input id="client-registration-link" value={invite.url} readOnly onFocus={event => event.target.select()} />
      <p className="text-sm text-muted-foreground">Aguardando preenchimento · Válido até {new Date(invite.expires).toLocaleDateString("pt-BR")}</p>
      <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={copy}><Copy className="mr-2 h-4 w-4" />Copiar link</Button><Button onClick={share}><Share2 className="mr-2 h-4 w-4" />Compartilhar</Button></div>
    </> : <Button className="w-full gap-2" onClick={createLink} disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link className="h-4 w-4" />}Gerar link de cadastro</Button>}
  </div>;
}