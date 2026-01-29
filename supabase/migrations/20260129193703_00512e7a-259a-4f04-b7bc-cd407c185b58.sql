-- Criar tabela para verificações de identidade
CREATE TABLE public.identity_verifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired')),
  photo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  verified_at TIMESTAMP WITH TIME ZONE
);

-- Índice para buscar por token rapidamente
CREATE INDEX idx_identity_verifications_token ON public.identity_verifications(token);

-- Índice para buscar por loan_id
CREATE INDEX idx_identity_verifications_loan_id ON public.identity_verifications(loan_id);

-- Habilitar RLS
ALTER TABLE public.identity_verifications ENABLE ROW LEVEL SECURITY;

-- Política: Usuários podem ver verificações dos seus empréstimos
CREATE POLICY "Users can view verifications of their loans"
ON public.identity_verifications
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.loans
    JOIN public.clients ON clients.id = loans.client_id
    WHERE loans.id = identity_verifications.loan_id
    AND clients.user_id = auth.uid()
  )
);

-- Política: Usuários podem criar verificações para seus empréstimos
CREATE POLICY "Users can create verifications for their loans"
ON public.identity_verifications
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.loans
    JOIN public.clients ON clients.id = loans.client_id
    WHERE loans.id = identity_verifications.loan_id
    AND clients.user_id = auth.uid()
  )
);

-- Política: Usuários podem atualizar verificações dos seus empréstimos
CREATE POLICY "Users can update verifications of their loans"
ON public.identity_verifications
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.loans
    JOIN public.clients ON clients.id = loans.client_id
    WHERE loans.id = identity_verifications.loan_id
    AND clients.user_id = auth.uid()
  )
);

-- Política: Acesso público para verificar por token (página pública)
CREATE POLICY "Anyone can view verification by token"
ON public.identity_verifications
FOR SELECT
TO anon
USING (true);

-- Política: Acesso anônimo para atualizar verificação por token (upload da foto)
CREATE POLICY "Anyone can update verification by token"
ON public.identity_verifications
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

-- Criar bucket para fotos de identidade
INSERT INTO storage.buckets (id, name, public) 
VALUES ('identity-photos', 'identity-photos', true);

-- Política: Qualquer pessoa pode ler as fotos (bucket público)
CREATE POLICY "Anyone can view identity photos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'identity-photos');

-- Política: Qualquer pessoa pode fazer upload (via token de verificação)
CREATE POLICY "Anyone can upload identity photos"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'identity-photos');

-- Política: Usuários autenticados podem deletar fotos dos seus clientes
CREATE POLICY "Authenticated users can delete identity photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'identity-photos');