-- ============================================================
-- GRANT_CLIENT_ACCESS.sql
-- Grant a specific client access to specific verticals
-- ============================================================

-- Replace CLIENT-USER-UUID-HERE with the client's Supabase user UUID
-- Adjust credit_amount and uncomment only the verticals this client has access to

DO $$
DECLARE
  client UUID := 'CLIENT-USER-UUID-HERE';
  credit_amount INT := 100;
BEGIN
  -- Grant credits
  INSERT INTO public.credit_ledger (user_id, delta, reason)
  VALUES (client, credit_amount, 'client_onboarding');

  -- Uncomment verticals this client has purchased access to:

  -- INSERT INTO public.company_access (user_id, company_id)
  -- SELECT client, id FROM public.companies ON CONFLICT DO NOTHING;

  -- INSERT INTO public.lead_access (user_id, lead_id)
  -- SELECT client, id FROM public.b2b_leads ON CONFLICT DO NOTHING;

  -- INSERT INTO public.supplier_access (user_id, supplier_id)
  -- SELECT client, id FROM public.suppliers ON CONFLICT DO NOTHING;

  -- (add more verticals as needed)

  RAISE NOTICE 'Granted % credits to client %.', credit_amount, client;
END $$;
