import { useState, useRef, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Camera, Upload, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { SUPABASE_URL } from "@/config/app";

type VerificationStatus = "loading" | "pending" | "completed" | "expired" | "not_found";

export default function VerifyIdentity() {
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<VerificationStatus>("loading");
  const [isUploading, setIsUploading] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    checkVerificationStatus();
    return () => {
      stopCamera();
    };
  }, [token]);

  const checkVerificationStatus = async () => {
    if (!token) {
      setStatus("not_found");
      return;
    }

    try {
      // Use edge function for secure verification check
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/verify-identity?token=${encodeURIComponent(token)}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (response.status === 404) {
        setStatus("not_found");
        return;
      }

      if (response.status === 410) {
        setStatus("expired");
        return;
      }

      if (!response.ok) {
        setStatus("not_found");
        return;
      }

      const data = await response.json();
      
      if (data.status === "completed") {
        setStatus("completed");
      } else if (data.valid) {
        setStatus("pending");
      } else {
        setStatus("not_found");
      }
    } catch (error) {
      console.error("Error checking verification:", error);
      setStatus("not_found");
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      setIsCameraActive(true);
    } catch (error) {
      console.error("Camera error:", error);
      toast({
        title: "Erro ao acessar câmera",
        description: "Permita o acesso à câmera ou use o botão de upload.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (isCameraActive && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [isCameraActive]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      const imageData = canvas.toDataURL("image/jpeg", 0.8);
      setCapturedImage(imageData);
      stopCamera();
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      setCapturedImage(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    startCamera();
  };

  const uploadPhoto = async () => {
    if (!capturedImage || !token) return;

    setIsUploading(true);

    try {
      // Convert base64 to blob
      const response = await fetch(capturedImage);
      const blob = await response.blob();

      // Generate unique filename
      const filename = `${token}_${Date.now()}.jpg`;

      // Upload to Supabase Storage (public bucket allows anonymous uploads)
      const { error: uploadError } = await supabase.storage
        .from("identity-photos")
        .upload(filename, blob, { contentType: "image/jpeg" });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("identity-photos")
        .getPublicUrl(filename);

      // Use edge function to securely update verification record
      const updateResponse = await fetch(
        `${SUPABASE_URL}/functions/v1/verify-identity?token=${encodeURIComponent(token)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            photo_url: urlData.publicUrl,
          }),
        }
      );

      if (!updateResponse.ok) {
        const errorData = await updateResponse.json();
        throw new Error(errorData.error || "Failed to update verification");
      }

      setStatus("completed");
      toast({
        title: "Foto enviada com sucesso!",
        description: "Sua verificação foi concluída.",
      });
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Erro ao enviar foto",
        description: "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-6">
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
            <p className="mt-4 text-muted-foreground">Carregando...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "not_found") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-6 space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <h1 className="text-xl font-semibold">Link inválido</h1>
            <p className="text-muted-foreground">
              Este link de verificação não existe ou já expirou.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "expired") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-6 space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-amber-500" />
            </div>
            <h1 className="text-xl font-semibold">Link expirado</h1>
            <p className="text-muted-foreground">
              Este link de verificação expirou. Solicite um novo link.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "completed") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-6 space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            </div>
            <h1 className="text-xl font-semibold">Verificação concluída!</h1>
            <p className="text-muted-foreground">
              Sua foto foi enviada com sucesso. Você já pode fechar esta página.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Verificação de Identidade</CardTitle>
          <p className="text-sm text-muted-foreground mt-2">
            Para confirmar seu empréstimo, tire uma foto segurando seu RG próximo ao rosto.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <canvas ref={canvasRef} className="hidden" />
          
          {capturedImage ? (
            <div className="space-y-4">
              <div className="rounded-lg overflow-hidden border">
                <img
                  src={capturedImage}
                  alt="Foto capturada"
                  className="w-full aspect-[4/3] object-cover"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={retakePhoto}
                  disabled={isUploading}
                >
                  Tirar outra
                </Button>
                <Button
                  className="flex-1"
                  onClick={uploadPhoto}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    "Enviar foto"
                  )}
                </Button>
              </div>
            </div>
          ) : isCameraActive ? (
            <div className="space-y-4">
              <div className="rounded-lg overflow-hidden border bg-muted">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full aspect-[4/3] object-cover"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={stopCamera}
                >
                  Cancelar
                </Button>
                <Button className="flex-1" onClick={capturePhoto}>
                  <Camera className="h-4 w-4 mr-2" />
                  Capturar
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-lg border-2 border-dashed border-border p-8 text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Camera className="h-6 w-6 text-primary" />
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Posicione o RG próximo ao seu rosto e tire uma foto
                </p>
                <div className="flex flex-col gap-2">
                  <Button onClick={startCamera} className="w-full">
                    <Camera className="h-4 w-4 mr-2" />
                    Abrir câmera
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Enviar arquivo
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="user"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="text-xs text-center text-muted-foreground space-y-1">
            <p>📷 Dicas para uma boa foto:</p>
            <ul className="list-none space-y-0.5">
              <li>• Segure o RG próximo ao rosto</li>
              <li>• Certifique-se de que o RG está legível</li>
              <li>• Use boa iluminação</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
