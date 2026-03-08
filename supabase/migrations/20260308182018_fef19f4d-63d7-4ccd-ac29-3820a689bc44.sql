
CREATE TABLE public.interest_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  paid_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.interest_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view interest payments of their loans"
ON public.interest_payments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM loans JOIN clients ON clients.id = loans.client_id
    WHERE loans.id = interest_payments.loan_id AND clients.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert interest payments for their loans"
ON public.interest_payments
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM loans JOIN clients ON clients.id = loans.client_id
    WHERE loans.id = interest_payments.loan_id AND clients.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete interest payments of their loans"
ON public.interest_payments
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM loans JOIN clients ON clients.id = loans.client_id
    WHERE loans.id = interest_payments.loan_id AND clients.user_id = auth.uid()
  )
);
