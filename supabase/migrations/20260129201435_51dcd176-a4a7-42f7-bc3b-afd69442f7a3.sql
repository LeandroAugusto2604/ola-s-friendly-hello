-- Fix the identity_verifications SELECT policy that has USING (true)
-- This policy was incorrectly created and should be removed
DROP POLICY IF EXISTS "Public can view own verification by token" ON public.identity_verifications;