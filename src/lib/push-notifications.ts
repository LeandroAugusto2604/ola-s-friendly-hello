import { supabase } from "@/integrations/supabase/client";

export function pushAvailability() {
  if (window.top !== window.self) return "open-tab";
  if (!window.isSecureContext || !("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) return "unsupported";
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (ios && !window.matchMedia("(display-mode: standalone)").matches && !(navigator as Navigator & { standalone?: boolean }).standalone) return "install-ios";
  return "supported";
}
export async function invokePush(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("push-notifications", { body });
  if (error) {
    let message = "Não foi possível configurar as notificações.";
    if (error.context instanceof Response) {
      const result = await error.context.json().catch(() => null);
      if (typeof result?.error === "string") message = result.error;
    }
    throw new Error(message);
  }
  return data;
}
export async function notificationRegistration() {
  const registration = await navigator.serviceWorker.register("/push/notifications-sw.js", { scope: "/push/" });
  if (!registration.active) await new Promise<void>((resolve, reject) => {
    const worker = registration.installing || registration.waiting;
    if (!worker) { reject(new Error("Não foi possível ativar as notificações.")); return; }
    const timeout = window.setTimeout(() => reject(new Error("Tente ativar novamente.")), 15000);
    worker.addEventListener("statechange", () => { if (worker.state === "activated") { clearTimeout(timeout); resolve(); } });
  });
  return registration;
}
export function decodePublicKey(value: string) {
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}