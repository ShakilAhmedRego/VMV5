-- ============================================================
-- DEMO_UNLOCK_ALL.sql
-- Unlocks ALL records across all 16 verticals for a demo user
-- Also grants 500 demo credits
-- ============================================================

-- Replace YOUR-DEMO-USER-UUID-HERE with the UUID from Supabase → Auth → Users
DO $$
DECLARE
  demo_user UUID := 'YOUR-DEMO-USER-UUID-HERE';
BEGIN
  -- Add demo credits
  INSERT INTO public.credit_ledger (user_id, delta, reason)
  VALUES (demo_user, 500, 'demo_setup');

  -- Unlock all companies (dealflow)
  INSERT INTO public.company_access (user_id, company_id)
  SELECT demo_user, id FROM public.companies ON CONFLICT DO NOTHING;

  -- Unlock all leads (salesintel)
  INSERT INTO public.lead_access (user_id, lead_id)
  SELECT demo_user, id FROM public.b2b_leads ON CONFLICT DO NOTHING;

  -- Unlock all suppliers (supplyintel)
  INSERT INTO public.supplier_access (user_id, supplier_id)
  SELECT demo_user, id FROM public.suppliers ON CONFLICT DO NOTHING;

  -- Unlock all trials (clinicalintel)
  INSERT INTO public.trial_access (user_id, trial_id)
  SELECT demo_user, id FROM public.clinical_trials ON CONFLICT DO NOTHING;

  -- Unlock all cases (legalintel)
  INSERT INTO public.case_access (user_id, case_id)
  SELECT demo_user, id FROM public.legal_cases ON CONFLICT DO NOTHING;

  -- Unlock all entities (marketresearch)
  INSERT INTO public.entity_access (user_id, entity_id)
  SELECT demo_user, id FROM public.market_entities ON CONFLICT DO NOTHING;

  -- Unlock all papers (academicintel)
  INSERT INTO public.paper_access (user_id, paper_id)
  SELECT demo_user, id FROM public.papers ON CONFLICT DO NOTHING;

  -- Unlock all creators (creatorintel)
  INSERT INTO public.creator_access (user_id, creator_id)
  SELECT demo_user, id FROM public.creators ON CONFLICT DO NOTHING;

  -- Unlock all studios (gamingintel)
  INSERT INTO public.studio_access (user_id, studio_id)
  SELECT demo_user, id FROM public.game_studios ON CONFLICT DO NOTHING;

  -- Unlock all properties (realestateintel)
  INSERT INTO public.property_access (user_id, property_id)
  SELECT demo_user, id FROM public.properties ON CONFLICT DO NOTHING;

  -- Unlock all private companies (privatecreditintel)
  INSERT INTO public.pc_company_access (user_id, company_id)
  SELECT demo_user, id FROM public.private_companies ON CONFLICT DO NOTHING;

  -- Unlock all orgs (cyberintel)
  INSERT INTO public.org_access (user_id, org_id)
  SELECT demo_user, id FROM public.organizations ON CONFLICT DO NOTHING;

  -- Unlock all programs (biopharmintel)
  INSERT INTO public.program_access (user_id, program_id)
  SELECT demo_user, id FROM public.drug_programs ON CONFLICT DO NOTHING;

  -- Unlock all facilities (industrialintel)
  INSERT INTO public.facility_access (user_id, facility_id)
  SELECT demo_user, id FROM public.industrial_facilities ON CONFLICT DO NOTHING;

  -- Unlock all opportunities (govintel)
  INSERT INTO public.opportunity_access (user_id, opportunity_id)
  SELECT demo_user, id FROM public.gov_opportunities ON CONFLICT DO NOTHING;

  -- Unlock all accounts (insuranceintel)
  INSERT INTO public.account_access (user_id, account_id)
  SELECT demo_user, id FROM public.insurance_accounts ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Demo user fully unlocked across all 16 verticals with 500 credits.';
END $$;
