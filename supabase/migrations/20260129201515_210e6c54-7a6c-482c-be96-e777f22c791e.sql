-- Remove the problematic update policy that allows anyone to update verifications
DROP POLICY IF EXISTS "Public can update verification with valid token" ON public.identity_verifications;