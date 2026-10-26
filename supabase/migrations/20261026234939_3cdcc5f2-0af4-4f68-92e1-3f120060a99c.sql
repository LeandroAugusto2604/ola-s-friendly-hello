CREATE TABLE public.client_photo_invites (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
 token_hash text NOT NULL UNIQUE, expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days', completed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.client_photo_invites TO authenticated;
GRANT ALL ON public.client_photo_invites TO service_role;
ALTER TABLE public.client_photo_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read photo invitations" ON public.client_photo_invites FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE TRIGGER update_client_photo_invites_updated_at BEFORE UPDATE ON public.client_photo_invites FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.complete_client_registration_with_photo(p_token text, p_full_name text, p_address text, p_phone text, p_rg text, p_cpf text, p_photo_path text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_client uuid; v_hash text;
BEGIN
 v_hash := encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
 IF p_photo_path IS NOT NULL AND p_photo_path !~ ('^' || v_hash || '/[a-f0-9-]{36}\.(jpg|png|webp)$') THEN RAISE EXCEPTION 'Foto inválida.'; END IF;
 PERFORM private.submit_client_registration(p_token, p_full_name, p_address, p_phone, p_rg, p_cpf);
 SELECT client_id INTO v_client FROM public.client_registration_invites WHERE token_hash = v_hash;
 UPDATE public.clients SET identity_photo_path = p_photo_path WHERE id = v_client;
END; $$;
REVOKE ALL ON FUNCTION public.complete_client_registration_with_photo(text,text,text,text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_client_registration_with_photo(text,text,text,text,text,text,text) TO service_role;

CREATE OR REPLACE FUNCTION private.create_client_photo_invite(p_client_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_token text;
BEGIN
 PERFORM 1 FROM public.clients WHERE id = p_client_id AND user_id = auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Cliente não encontrado.'; END IF;
 UPDATE public.client_photo_invites SET completed_at = now() WHERE client_id = p_client_id AND completed_at IS NULL;
 v_token := encode(extensions.gen_random_bytes(32), 'hex');
 INSERT INTO public.client_photo_invites(user_id,client_id,token_hash) VALUES(auth.uid(),p_client_id,encode(sha256(convert_to(v_token,'UTF8')),'hex'));
 RETURN jsonb_build_object('token',v_token);
END; $$;
CREATE OR REPLACE FUNCTION public.create_client_photo_invite(p_client_id uuid) RETURNS jsonb LANGUAGE sql SET search_path = '' AS $$ SELECT private.create_client_photo_invite(p_client_id); $$;
REVOKE ALL ON FUNCTION private.create_client_photo_invite(uuid), public.create_client_photo_invite(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.create_client_photo_invite(uuid), public.create_client_photo_invite(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION private.client_photo_invite_status(p_token text) RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
 SELECT COALESCE((SELECT CASE WHEN completed_at IS NOT NULL THEN 'completed' WHEN expires_at <= now() THEN 'expired' ELSE 'pending' END FROM public.client_photo_invites WHERE token_hash = encode(sha256(convert_to(p_token,'UTF8')),'hex') AND p_token ~ '^[a-f0-9]{64}$'), 'invalid');
$$;
CREATE OR REPLACE FUNCTION public.client_photo_invite_status(p_token text) RETURNS text LANGUAGE sql SET search_path = '' AS $$ SELECT private.client_photo_invite_status(p_token); $$;
REVOKE ALL ON FUNCTION private.client_photo_invite_status(text), public.client_photo_invite_status(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.client_photo_invite_status(text), public.client_photo_invite_status(text) TO anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION private.clear_client_identity_photo(p_client_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_path text; v_urls jsonb;
BEGIN
 SELECT identity_photo_path INTO v_path FROM public.clients WHERE id=p_client_id AND user_id=auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Cliente não encontrado.'; END IF;
 SELECT COALESCE(jsonb_agg(iv.photo_url) FILTER (WHERE iv.photo_url IS NOT NULL),'[]'::jsonb) INTO v_urls FROM public.identity_verifications iv JOIN public.loans l ON l.id=iv.loan_id WHERE l.client_id=p_client_id;
 UPDATE public.clients SET identity_photo_path=NULL WHERE id=p_client_id;
 UPDATE public.identity_verifications SET status='expired',photo_url=NULL,verified_at=NULL,token=gen_random_uuid()::text WHERE loan_id IN (SELECT id FROM public.loans WHERE client_id=p_client_id);
 UPDATE public.client_photo_invites SET completed_at=now() WHERE client_id=p_client_id AND completed_at IS NULL;
 RETURN jsonb_build_object('old_path',v_path,'old_urls',v_urls);
END; $$;
CREATE OR REPLACE FUNCTION public.clear_client_identity_photo(p_client_id uuid) RETURNS jsonb LANGUAGE sql SET search_path = '' AS $$ SELECT private.clear_client_identity_photo(p_client_id); $$;
REVOKE ALL ON FUNCTION private.clear_client_identity_photo(uuid), public.clear_client_identity_photo(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.clear_client_identity_photo(uuid), public.clear_client_identity_photo(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION private.complete_client_photo(p_token text,p_photo_path text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_inv public.client_photo_invites; v_old text; v_urls jsonb; v_hash text;
BEGIN
 v_hash:=encode(sha256(convert_to(p_token,'UTF8')),'hex');
 IF p_token !~ '^[a-f0-9]{64}$' OR p_photo_path IS NULL OR p_photo_path !~ ('^'||v_hash||'/[a-f0-9-]{36}\.(jpg|png|webp)$') THEN RAISE EXCEPTION 'Foto inválida.'; END IF;
 -- Lock the client first, matching invitation creation/deletion lock order.
 PERFORM 1 FROM public.clients WHERE id=(SELECT client_id FROM public.client_photo_invites WHERE token_hash=v_hash) FOR UPDATE;
 SELECT * INTO v_inv FROM public.client_photo_invites WHERE token_hash=v_hash FOR UPDATE;
 IF NOT FOUND OR v_inv.completed_at IS NOT NULL OR v_inv.expires_at <= now() THEN RAISE EXCEPTION 'Link inválido, expirado ou já utilizado.'; END IF;
 SELECT identity_photo_path INTO v_old FROM public.clients WHERE id=v_inv.client_id AND user_id=v_inv.user_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Cliente não encontrado.'; END IF;
 SELECT COALESCE(jsonb_agg(iv.photo_url) FILTER (WHERE iv.photo_url IS NOT NULL),'[]'::jsonb) INTO v_urls FROM public.identity_verifications iv JOIN public.loans l ON l.id=iv.loan_id WHERE l.client_id=v_inv.client_id;
 UPDATE public.clients SET identity_photo_path=p_photo_path WHERE id=v_inv.client_id;
 UPDATE public.identity_verifications SET status='expired',photo_url=NULL,verified_at=NULL,token=gen_random_uuid()::text WHERE loan_id IN (SELECT id FROM public.loans WHERE client_id=v_inv.client_id);
 UPDATE public.client_photo_invites SET completed_at=now() WHERE id=v_inv.id;
 RETURN jsonb_build_object('old_path',v_old,'old_urls',v_urls);
END; $$;
CREATE OR REPLACE FUNCTION public.complete_client_photo(p_token text,p_photo_path text) RETURNS jsonb LANGUAGE sql SET search_path = '' AS $$ SELECT private.complete_client_photo(p_token,p_photo_path); $$;
REVOKE ALL ON FUNCTION private.complete_client_photo(text,text),public.complete_client_photo(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.complete_client_photo(text,text),public.complete_client_photo(text,text) TO service_role;