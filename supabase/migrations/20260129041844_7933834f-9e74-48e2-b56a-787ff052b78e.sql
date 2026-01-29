-- Drop the old unique constraint on CPF only
ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_cpf_key;

-- Create a new unique constraint that considers both CPF and user_id
-- This allows different users to have clients with the same CPF
CREATE UNIQUE INDEX clients_cpf_user_unique ON public.clients (cpf, user_id);