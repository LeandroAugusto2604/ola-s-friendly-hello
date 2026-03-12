import { useState } from "react";
import { ClientForm } from "@/components/ClientForm";
import { LoanConfigForm } from "@/components/LoanConfigForm";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Banknote } from "lucide-react";

interface LoanFormProps {
  onSuccess: () => void;
}

export function LoanForm({ onSuccess }: LoanFormProps) {
  const [step, setStep] = useState<"client" | "loan">("client");
  const [clientId, setClientId] = useState("");
  const [clientName, setClientName] = useState("");

  const handleClientReady = (id: string, name: string) => {
    setClientId(id);
    setClientName(name);
    setStep("loan");
  };

  const handleBack = () => {
    setStep("client");
    setClientId("");
    setClientName("");
  };

  const handleSuccess = () => {
    setStep("client");
    setClientId("");
    setClientName("");
    onSuccess();
  };

  return (
    <div className="space-y-4">
      {/* Step indicator */}
      <div className="flex items-center gap-3">
        <Badge
          variant={step === "client" ? "default" : "secondary"}
          className="gap-1.5"
        >
          <UserPlus className="h-3 w-3" />
          1. Cliente
        </Badge>
        <div className="h-px flex-1 bg-border" />
        <Badge
          variant={step === "loan" ? "default" : "secondary"}
          className="gap-1.5"
        >
          <Banknote className="h-3 w-3" />
          2. Empréstimo
        </Badge>
      </div>

      {step === "client" && (
        <ClientForm onClientReady={handleClientReady} />
      )}

      {step === "loan" && (
        <LoanConfigForm
          clientId={clientId}
          clientName={clientName}
          onSuccess={handleSuccess}
          onBack={handleBack}
        />
      )}
    </div>
  );
}
