import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { decodePublicKey, invokePush, notificationRegistration, pushAvailability } from "@/lib/push-notifications";

export function PushNotificationSettings() {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.getRegistration("/push/").then(async registration => {
      const subscription = await registration?.pushManager.getSubscription();
      if (!subscription) return;
      const { data } = await supabase.from("push_subscriptions").select("id").eq("endpoint", subscription.endpoint).maybeSingle();
      setEnabled(Boolean(data));
    }).catch(() => {});
  }, []);
  async function enable() {
    const availability = pushAvailability();
    if (availability !== "supported") {
      setMessage(availability === "open-tab" ? "Abra seu site em uma nova aba, fora da pré-visualização, para ativar os avisos." : availability === "install-ios" ? "No iPhone, use Safari → Compartilhar → Adicionar à Tela de Início. Abra pelo ícone para ativar." : "Use um navegador atualizado. No iPhone, é necessário iOS 16.4 ou mais recente e abrir pela tela inicial.");
      return;
    }
    setBusy(true); setMessage("");
    try {
      const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Permita notificações nas configurações do site no seu celular.");
      const { publicKey } = await invokePush({ action: "key" });
      const registration = await notificationRegistration();
      const subscription = await registration.pushManager.getSubscription() || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodePublicKey(publicKey) });
      await invokePush({ action: "subscribe", subscription: subscription.toJSON() });
      setEnabled(true); setMessage("Avisos ativados neste celular, diariamente às 9h de São Paulo.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Tente novamente."); }
    finally { setBusy(false); }
  }
  async function disable() {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration("/push/");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
        if (error) throw error;
        await subscription.unsubscribe();
      }
      setEnabled(false); setMessage("Avisos desativados neste celular.");
    } catch { setMessage("Não foi possível desativar. Tente novamente."); }
    finally { setBusy(false); }
  }
  async function test() {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration("/push/");
      const subscription = await registration?.pushManager.getSubscription();
      if (!subscription) throw new Error("Ative os avisos primeiro.");
      const result = await invokePush({ action: "test", endpoint: subscription.endpoint });
      setMessage(result.overdueCount ? "Aviso das parcelas em atraso enviado para este celular." : "Aviso de teste enviado para este celular.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Tente novamente."); }
    finally { setBusy(false); }
  }
  return <Dialog><DialogTrigger asChild><Button variant="outline" size="sm" className="gap-2"><Bell className="h-4 w-4" />Avisos no celular</Button></DialogTrigger>
    <DialogContent className="max-w-md"><DialogHeader><DialogTitle>Notificações de atraso</DialogTitle><DialogDescription>Resumo diário às 9h de São Paulo, somente quando houver parcelas em atraso.</DialogDescription></DialogHeader>
      <p className="text-sm font-medium">{enabled ? "Ativadas neste celular" : "Desativadas neste celular"}</p>
      <div className="flex flex-wrap gap-2">{enabled ? <><Button variant="outline" onClick={disable} disabled={busy}><BellOff className="mr-2 h-4 w-4" />Desativar</Button><Button onClick={test} disabled={busy}><Send className="mr-2 h-4 w-4" />Enviar teste</Button></> : <Button onClick={enable} disabled={busy}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bell className="mr-2 h-4 w-4" />}Ativar notificações</Button>}</div>
      {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
    </DialogContent></Dialog>;
}