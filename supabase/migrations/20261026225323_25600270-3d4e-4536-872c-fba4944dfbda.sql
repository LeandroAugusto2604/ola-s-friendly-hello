CREATE TABLE public.client_registration_invites (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL,
 token_hash text NOT NULL UNIQUE,
 expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
 client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
 completed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.client_registration_invites TO authenticated;
GRANT ALL ON public.client_registration_invites TO service_role;
ALTER TABLE public.client_registration_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners can read their registration invites" ON public.client_registration_invites FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER update_client_registration_invites_updated_at BEFORE UPDATE ON public.client_registration_invites FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.create_client_registration_invite()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_token text; v_id uuid; v_expiry timestamptz;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Você precisa estar conectado.'; END IF;
 v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
 INSERT INTO public.client_registration_invites(user_id, token_hash)
 VALUES(auth.uid(), encode(sha256(convert_to(v_token, 'UTF8')), 'hex'))
 RETURNING id, expires_at INTO v_id, v_expiry;
 RETURN jsonb_build_object('invitation_id', v_id, 'token', v_token, 'expires_at', v_expiry);
END;
$$;
REVOKE ALL ON FUNCTION public.create_client_registration_invite() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_client_registration_invite() TO authenticated;

CREATE OR REPLACE FUNCTION public.client_registration_invite_status(p_token text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_invite public.client_registration_invites;
BEGIN
 IF p_token IS NULL OR p_token !~ '^[a-f0-9]{64}$' THEN RETURN 'invalid'; END IF;
 SELECT * INTO v_invite FROM public.client_registration_invites WHERE token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
 IF NOT FOUND THEN RETURN 'invalid'; END IF;
 IF v_invite.completed_at IS NOT NULL THEN RETURN 'completed'; END IF;
 IF v_invite.expires_at <= now() THEN RETURN 'expired'; END IF;
 RETURN 'pending';
END;
$$;
REVOKE ALL ON FUNCTION public.client_registration_invite_status(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.client_registration_invite_status(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.submit_client_registration(p_token text, p_full_name text, p_address text, p_phone text, p_rg text, p_cpf text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_invite public.client_registration_invites; v_client uuid; v_cpf text; v_phone text;
BEGIN
 IF p_token IS NULL OR p_token !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Link inválido ou expirado.'; END IF;
 SELECT * INTO v_invite FROM public.client_registration_invites WHERE token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex') FOR UPDATE;
 IF NOT FOUND OR v_invite.expires_at <= now() OR v_invite.completed_at IS NOT NULL THEN RAISE EXCEPTION 'Link inválido, expirado ou já utilizado.'; END IF;
 v_cpf := regexp_replace(coalesce(p_cpf, ''), '[^0-9]', '', 'g');
 v_phone := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
 IF p_full_name IS NULL OR length(trim(p_full_name)) NOT BETWEEN 3 AND 150
 OR p_address IS NULL OR length(trim(p_address)) NOT BETWEEN 5 AND 500
 OR p_rg IS NULL OR length(trim(p_rg)) NOT BETWEEN 5 AND 30
 OR length(coalesce(p_phone, '')) > 15 OR length(v_phone) NOT BETWEEN 10 AND 11
 OR length(coalesce(p_cpf, '')) > 14 OR length(v_cpf) <> 11 THEN
 RAISE EXCEPTION 'Confira nome, endereço, celular, RG e CPF.';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(v_invite.user_id::text || v_cpf, 0));
 IF EXISTS (SELECT 1 FROM public.clients WHERE user_id = v_invite.user_id AND regexp_replace(cpf, '[^0-9]', '', 'g') = v_cpf) THEN
 RAISE EXCEPTION 'Este CPF já está cadastrado. Entre em contato com o responsável.';
 END IF;
 INSERT INTO public.clients(user_id, full_name, address, phone, rg, cpf)
 VALUES(v_invite.user_id, trim(p_full_name), trim(p_address), v_phone, trim(p_rg), v_cpf) RETURNING id INTO v_client;
 UPDATE public.client_registration_invites SET client_id = v_client, completed_at = now() WHERE id = v_invite.id;
END;
$$;
REVOKE ALL ON FUNCTION public.submit_client_registration(text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_client_registration(text, text, text, text, text, text) TO anon, authenticated;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'clients') THEN
 ALTER PUBLICATION supabase_realtime ADD TABLE public.clients;
 END IF;
END $$;