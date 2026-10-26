import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import VerifyIdentity from "./pages/VerifyIdentity";
import ResetPassword from "./pages/ResetPassword";
import ClientRegistration from "./pages/ClientRegistration";

const queryClient = new QueryClient();

const App = () => {
  const hashMatch = window.location.hash.match(/^#\/cadastro-cliente\/([^/?#]+)$/);
  return (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={hashMatch ? <ClientRegistration invitationToken={hashMatch[1]} /> : <Index />} />
          <Route path="/cadastro-cliente/:token" element={<ClientRegistration />} />
          <Route path="/verify/:token" element={<VerifyIdentity />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;
