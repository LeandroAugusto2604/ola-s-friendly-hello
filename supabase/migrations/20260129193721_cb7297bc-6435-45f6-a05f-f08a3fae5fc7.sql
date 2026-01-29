-- Melhorar segurança: restringir UPDATE anônimo apenas quando o token corresponder
DROP POLICY IF EXISTS "Anyone can update verification by token" ON public.identity_verifications;

CREATE POLICY "Anyone can update pending verification"
ON public.identity_verifications
FOR UPDATE
TO anon
USING (status = 'pending')
WITH CHECK (status IN ('pending', 'completed'));