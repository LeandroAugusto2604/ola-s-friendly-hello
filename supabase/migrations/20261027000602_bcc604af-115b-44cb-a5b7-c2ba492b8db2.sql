CREATE TABLE public.push_subscriptions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, endpoint text NOT NULL UNIQUE, p256dh text NOT NULL, auth text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT,DELETE ON public.push_subscriptions TO authenticated; GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads push devices" ON public.push_subscriptions FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE POLICY "Owner removes push devices" ON public.push_subscriptions FOR DELETE TO authenticated USING(user_id=auth.uid());
CREATE TRIGGER update_push_subscriptions_updated_at BEFORE UPDATE ON public.push_subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TABLE public.push_daily_deliveries (subscription_id uuid NOT NULL REFERENCES public.push_subscriptions(id) ON DELETE CASCADE, delivery_date date NOT NULL, status text NOT NULL DEFAULT 'claimed', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(subscription_id,delivery_date));
GRANT ALL ON public.push_daily_deliveries TO service_role;
ALTER TABLE public.push_daily_deliveries ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_push_daily_deliveries_updated_at BEFORE UPDATE ON public.push_daily_deliveries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE OR REPLACE FUNCTION public.claim_daily_overdue_push() RETURNS TABLE(subscription_id uuid, endpoint text,p256dh text,auth text,overdue_count bigint) LANGUAGE sql SET search_path='' AS $$
WITH eligible AS (
 SELECT s.id,s.endpoint,s.p256dh,s.auth,count(i.id) AS overdue_count FROM public.push_subscriptions s JOIN public.clients c ON c.user_id=s.user_id JOIN public.loans l ON l.client_id=c.id JOIN public.installments i ON i.loan_id=l.id
 WHERE NOT i.paid AND i.status <> 'liquidado' AND i.due_date < (now() AT TIME ZONE 'America/Sao_Paulo')::date
 AND (now() AT TIME ZONE 'America/Sao_Paulo')::time >= time '09:00' AND (now() AT TIME ZONE 'America/Sao_Paulo')::time < time '10:00'
 GROUP BY s.id
), claimed AS (INSERT INTO public.push_daily_deliveries(subscription_id,delivery_date) SELECT id,(now() AT TIME ZONE 'America/Sao_Paulo')::date FROM eligible ON CONFLICT DO NOTHING RETURNING subscription_id)
SELECT e.id,e.endpoint,e.p256dh,e.auth,e.overdue_count FROM eligible e JOIN claimed c ON c.subscription_id=e.id;
$$;
REVOKE ALL ON FUNCTION public.claim_daily_overdue_push() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_daily_overdue_push() TO service_role;