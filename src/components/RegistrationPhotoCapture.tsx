import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, Upload, X } from "lucide-react";
import { validateRegistrationPhoto } from "@/lib/registration-photo";

export function RegistrationPhotoCapture({ photo, onChange, disabled }: { photo: File | null; onChange: (photo: File) => void; disabled: boolean }) {
  const [active, setActive] = useState(false);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const stream = useRef<MediaStream | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const captureInput = useRef<HTMLInputElement>(null);
  const stop = () => { stream.current?.getTracks().forEach(track => track.stop()); stream.current = null; setActive(false); };
  useEffect(() => () => { stream.current?.getTracks().forEach(track => track.stop()); }, []);
  useEffect(() => { if (active && video.current) video.current.srcObject = stream.current; }, [active]);
  useEffect(() => {
    if (!photo) { setPreview(""); return; }
    const url = URL.createObjectURL(photo); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);
  function select(file?: File) {
    if (!file) return;
    const validation = validateRegistrationPhoto(file);
    setError(validation || "");
    if (!validation) { stop(); onChange(file); }
  }
  async function start() {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia) { captureInput.current?.click(); return; }
    try {
      stop();
      stream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false });
      setActive(true);
    } catch { setError("Permita o acesso à câmera ou selecione uma foto."); }
  }
  function capture() {
    if (!video.current || !video.current.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.current.videoWidth; canvas.height = video.current.videoHeight;
    canvas.getContext("2d")?.drawImage(video.current, 0, 0);
    canvas.toBlob(blob => { if (blob) select(new File([blob], "foto-com-rg.jpg", { type: "image/jpeg" })); }, "image/jpeg", 0.85);
  }
  return <section className="space-y-3 border-t border-border pt-5">
    <h3 className="font-semibold text-foreground">Foto com RG</h3>
    <p className="text-sm text-muted-foreground">Segure seu RG próximo ao rosto, com o documento legível.</p>
    {active ? <>
      <video ref={video} autoPlay playsInline muted aria-label="Câmera para foto com RG" className="aspect-[4/3] w-full rounded-lg bg-muted object-contain" />
      <div className="flex gap-2"><Button type="button" onClick={capture} disabled={disabled}><Camera className="mr-2 h-4 w-4" />Capturar foto</Button><Button type="button" variant="outline" onClick={stop}><X className="mr-2 h-4 w-4" />Cancelar</Button></div>
    </> : <>
      {preview && <img src={preview} alt="Foto com RG selecionada" className="aspect-[4/3] w-full rounded-lg border border-border object-contain" />}
      <div className="flex flex-wrap gap-2"><Button type="button" onClick={start} disabled={disabled}><Camera className="mr-2 h-4 w-4" />{photo ? "Tirar outra foto" : "Abrir câmera"}</Button><Button type="button" variant="outline" onClick={() => fileInput.current?.click()} disabled={disabled}><Upload className="mr-2 h-4 w-4" />Selecionar foto</Button></div>
    </>}
    <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => { select(e.target.files?.[0]); e.target.value = ""; }} />
    <input ref={captureInput} type="file" accept="image/*" capture="user" className="hidden" onChange={e => { select(e.target.files?.[0]); e.target.value = ""; }} />
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </section>;
}