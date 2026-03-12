
-- Add amount_paid and status columns to installments table
ALTER TABLE public.installments 
  ADD COLUMN IF NOT EXISTS amount_paid numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pendente';

-- Update existing paid installments to have correct status and amount_paid
UPDATE public.installments SET status = 'liquidado', amount_paid = amount WHERE paid = true;
