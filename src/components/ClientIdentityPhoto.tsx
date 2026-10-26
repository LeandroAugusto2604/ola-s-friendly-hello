import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Camera, Loader2 } from "lucide-react";

export function ClientIdentityPhoto({ path, name }: { path: string; name: string }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function load(open: boolean) {
    setUrl(""); setError("");
    if (!open) return;
    setLoading(true);
    const { data, error } = await supabase.storage.from("client-registration-photos").createSignedUrl(path, 300);
    setLoading(false);
    if (error) setError("Não foi possível abrir a foto. Tente novamente.");
    else setUrl(data.signedUrl);
  }
  return <Dialog onOpenChange={load}>
    <DialogTrigger asChild><Button type="button" variant="outline" size="sm" className="gap-2"><Camera className="h-4 w-4" />Foto com RG</Button></DialogTrigger>
    <DialogContent className="max-w-xl"><DialogHeader><DialogTitle>Foto do Cadastro — {name}</DialogTitle></DialogHeader>
      {loading && <Loader2 className="h-6 w-6 animate-spin text-primary" />}
      {url && <img src={url} alt={`Foto com RG de ${name}`} className="max-h-[65vh] w-full rounded-lg object-contain" />}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </DialogContent>
  </Dialog>;
}