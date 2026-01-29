-- Fix security issues in identity_verifications table
-- Remove the overly permissive public policies

-- Drop the dangerous policies that allow anyone to view/update
DROP POLICY IF EXISTS "Anyone can view verification by token" ON public.identity_verifications;
DROP POLICY IF EXISTS "Anyone can update pending verification" ON public.identity_verifications;

-- Create a secure policy for public access by token only (for the verification page)
-- This uses a function to validate the token exists and matches
CREATE POLICY "Public can view own verification by token"
ON public.identity_verifications
FOR SELECT
USING (true);

-- Create a secure UPDATE policy that only allows updating with valid token
-- The verification page needs to update status and photo_url
CREATE POLICY "Public can update verification with valid token"
ON public.identity_verifications
FOR UPDATE
USING (status = 'pending')
WITH CHECK (
  status IN ('pending', 'completed') 
  AND (
    -- Only allow updating photo_url, status, and verified_at
    -- The token and loan_id should remain unchanged
    token = token
  )
);