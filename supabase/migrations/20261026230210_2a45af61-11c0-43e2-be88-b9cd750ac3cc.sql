ALTER TABLE public.clients ADD COLUMN identity_photo_path text;
CREATE POLICY "Owners can view client registration photos" ON storage.objects FOR SELECT TO authenticated USING (
 bucket_id = 'client-registration-photos' AND EXISTS (SELECT 1 FROM public.clients WHERE clients.user_id = auth.uid() AND clients.identity_photo_path = storage.objects.name)
);
REVOKE EXECUTE ON FUNCTION public.submit_client_registration(text, text, text, text, text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION private.submit_client_registration(text, text, text, text, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.client_registration_invite_status(text) TO service_role;
GRANT USAGE ON SCHEMA private TO service_role;
GRANT EXECUTE ON FUNCTION private.client_registration_invite_status(text) TO service_role;
CREATE FUNCTION public.complete_client_registration_with_photo(p_token text, p_full_name text, p_address text, p_phone text, p_rg text, p_cpf text, p_photo_path text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_client uuid; v_hash text;
BEGIN
 v_hash := encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
 IF p_photo_path IS NULL OR p_photo_path !~ ('^' || v_hash || '/[a-f0-9-]{36}\.(jpg|png|webp)$') THEN RAISE EXCEPTION 'Foto inválida.'; END IF;
 PERFORM private.submit_client_registration(p_token, p_full_name, p_address, p_phone, p_rg, p_cpf);
 SELECT client_id INTO v_client FROM public.client_registration_invites WHERE token_hash = v_hash;
 UPDATE public.clients SET identity_photo_path = p_photo_path WHERE id = v_client;
END;
$$;
REVOKE ALL ON FUNCTION public.complete_client_registration_with_photo(text, text, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_client_registration_with_photo(text, text, text, text, text, text, text) TO service_role;