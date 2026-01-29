-- Add columns to store original amount and interest rate
ALTER TABLE public.loans
ADD COLUMN original_amount numeric,
ADD COLUMN interest_rate numeric DEFAULT 0;

-- Update existing loans: assume current amount is the total (no way to know original, so set original_amount = amount and interest_rate = 0)
UPDATE public.loans SET original_amount = amount, interest_rate = 0 WHERE original_amount IS NULL;

-- Make original_amount NOT NULL after populating existing data
ALTER TABLE public.loans
ALTER COLUMN original_amount SET NOT NULL;