-- ============================================================
-- VERIFIEDMEASURE — FULL DATABASE SCHEMA
-- Run this in Supabase SQL Editor (top to bottom, one block at a time)
-- Creates: all tables, RLS, RPCs, triggers, seed data
-- ============================================================

-- ============================================================
-- STEP 1: EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- STEP 2: CORE SYSTEM TABLES
-- ============================================================

-- User profiles (auto-created on signup via trigger)
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role        text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  status      text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'pending')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Credit ledger (append-only — never UPDATE, never DELETE)
CREATE TABLE IF NOT EXISTS public.credit_ledger (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  delta       integer NOT NULL,
  reason      text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Audit log
CREATE TABLE IF NOT EXISTS public.audit_log (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor       uuid REFERENCES auth.users(id),
  action      text NOT NULL,
  entity      text NOT NULL,
  meta        jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- STEP 3: TRIGGER — auto-create user_profile on signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, role, status)
  VALUES (NEW.id, 'user', 'active')
  ON CONFLICT (id) DO NOTHING;
  -- Give new users 10 free credits
  INSERT INTO public.credit_ledger (user_id, delta, reason)
  VALUES (NEW.id, 10, 'welcome_bonus');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- STEP 4: HELPER FUNCTION — is_admin()
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- ============================================================
-- STEP 5: VERTICAL TABLES + ACCESS TABLES
-- ============================================================

-- ------------------------------------------------------------
-- 1. DEALFLOW — companies
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.companies (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_name        text NOT NULL,
  funding_stage       text,
  sector              text,
  hq_location         text,
  description         text,
  founded_year        integer,
  total_raised        numeric,
  valuation           numeric,
  revenue_estimate    numeric,
  intelligence_score  integer DEFAULT 50,
  lead_investors      text,
  investor_count      integer,
  board_members       text,
  last_round_date     text,
  workflow_status     text DEFAULT 'active',
  next_action         text,
  deal_owner          text,
  created_at          timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.company_access (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id  uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  granted_at  timestamptz DEFAULT now(),
  UNIQUE(user_id, company_id)
);

-- ------------------------------------------------------------
-- 2. SALESINTEL — b2b_leads
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.b2b_leads (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  company             text NOT NULL,
  full_name           text,
  title               text,
  email               text,
  phone               text,
  linkedin_url        text,
  email_status        text DEFAULT 'unknown',
  employee_count      integer,
  revenue_range       text,
  industry            text,
  intelligence_score  integer DEFAULT 50,
  priority_score      integer DEFAULT 50,
  intent_signal       text,
  last_activity       text,
  workflow_status     text DEFAULT 'new',
  bounce_risk         text,
  verified_at         text,
  created_at          timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lead_access (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id    uuid NOT NULL REFERENCES public.b2b_leads(id) ON DELETE CASCADE,
  granted_at timestamptz DEFAULT now(),
  UNIQUE(user_id, lead_id)
);

-- ------------------------------------------------------------
-- 3. SUPPLYINTEL — suppliers
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.suppliers (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_name       text NOT NULL,
  country             text,
  category            text,
  risk_score          integer DEFAULT 50,
  risk_level          text DEFAULT 'medium',
  compliance_status   text DEFAULT 'unknown',
  iso_certified       boolean DEFAULT false,
  certifications      text,
  lead_time_days      integer,
  shipping_mode       text,
  contact_email       text,
  last_audit_date     text,
  created_at          timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.supplier_access (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  granted_at  timestamptz DEFAULT now(),
  UNIQUE(user_id, supplier_id)
);

-- ------------------------------------------------------------
-- 4. CLINICALINTEL — clinical_trials
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clinical_trials (
  id                    uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  trial_title           text NOT NULL,
  phase                 text,
  recruitment_status    text DEFAULT 'unknown',
  complexity_score      numeric DEFAULT 50,
  condition             text,
  min_age               integer,
  max_age               integer,
  gender                text DEFAULT 'All',
  inclusion_criteria    text,
  primary_location      text,
  countries             text,
  site_count            integer,
  sponsor               text,
  principal_investigator text,
  contact_email         text,
  created_at            timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.trial_access (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trial_id   uuid NOT NULL REFERENCES public.clinical_trials(id) ON DELETE CASCADE,
  granted_at timestamptz DEFAULT now(),
  UNIQUE(user_id, trial_id)
);

-- ------------------------------------------------------------
-- 5. LEGALINTEL — legal_cases
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.legal_cases (
  id                    uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_title            text NOT NULL,
  jurisdiction          text,
  filed_date            text,
  status                text DEFAULT 'active',
  damages_claimed       numeric,
  plaintiff             text,
  defendant             text,
  plaintiff_counsel     text,
  defense_counsel       text,
  judge                 text,
  next_hearing_date     text,
  expected_resolution   text,
  created_at            timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.case_access (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  case_id    uuid NOT NULL REFERENCES public.legal_cases(id) ON DELETE CASCADE,
  granted_at timestamptz DEFAULT now(),
  UNIQUE(user_id, case_id)
);

-- ------------------------------------------------------------
-- 6. MARKETRESEARCH — market_entities
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.market_entities (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_name      text NOT NULL,
  category        text,
  hq_region       text,
  trend_score     numeric DEFAULT 50,
  trend_direction text DEFAULT 'flat',
  sentiment_score numeric DEFAULT 50,
  search_volume   integer,
  social_mentions integer,
  avg_review_rating numeric,
  product_lines   text,
  sku_count       integer,
  created_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.entity_access (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_id  uuid NOT NULL REFERENCES public.market_entities(id) ON DELETE CASCADE,
  granted_at timestamptz DEFAULT now(),
  UNIQUE(user_id, entity_id)
);

-- ------------------------------------------------------------
-- 7. ACADEMICINTEL — papers
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.papers (
  id                   uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  title                text NOT NULL,
  journal              text,
  published_date       text,
  doi                  text,
  authors              text,
  institution          text,
  citation_count       integer DEFAULT 0,
  h_index              numeric,
  impact_factor        numeric,
  is_open_access       boolean DEFAULT false,
  collaboration_score  numeric DEFAULT 50,
  funding_source       text,
  grant_id             text,
  created_at           timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.paper_access (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  paper_id   uuid NOT NULL REFERENCES public.papers(id) ON DELETE CASCADE,
  granted_at timestamptz DEFAULT now(),
  UNIQUE(user_id, paper_id)
);

-- ------------------------------------------------------------
-- 8. CREATORINTEL — creators
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.creators (
  id                   uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_name         text NOT NULL,
  primary_platform     text,
  niche                text,
  followers            integer DEFAULT 0,
  engagement_rate      numeric DEFAULT 0,
  is_verified          boolean DEFAULT false,
  audience_location    text,
  audience_age_range   text,
  contact_email        text,
  avg_views            integer,
  avg_likes            integer,
  past_brands          text,
  rate_card            text,
  created_at           timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.creator_access (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  creator_id  uuid NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,
  granted_at  timestamptz DEFAULT now(),
  UNIQUE(user_id, creator_id)
);

-- ------------------------------------------------------------
-- 9. GAMINGINTEL — game_studios
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.game_studios (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  studio_name      text NOT NULL,
  country          text,
  founded_year     integer,
  funding_stage    text,
  engine_used      text,
  team_size        integer,
  tech_lead        text,
  latest_title     text,
  latest_release_date text,
  avg_metacritic   integer,
  discord_members  integer,
  steam_followers  integer,
  contact_email    text,
  created_at       timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.studio_access (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  studio_id   uuid NOT NULL REFERENCES public.game_studios(id) ON DELETE CASCADE,
  granted_at  timestamptz DEFAULT now(),
  UNIQUE(user_id, studio_id)
);

-- ------------------------------------------------------------
-- 10. REALESTATEINTEL — properties
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.properties (
  id                   uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_name        text NOT NULL,
  property_type        text,
  city                 text,
  state                text,
  valuation_estimate   numeric,
  risk_score           numeric DEFAULT 50,
  debt_maturity_flag   boolean DEFAULT false,
  owner_name           text,
  owner_type           text,
  acquisition_date     text,
  debt_amount          numeric,
  lender               text,
  debt_maturity_date   text,
  cap_rate             numeric,
  created_at           timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.property_access (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  granted_at  timestamptz DEFAULT now(),
  UNIQUE(user_id, property_id)
);

-- ------------------------------------------------------------
-- 11. PRIVATECREDITINTEL — private_companies
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.private_companies (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_name      text NOT NULL,
  industry          text,
  hq_location       text,
  revenue_estimate  numeric,
  ebitda_estimate   numeric,
  total_debt        numeric,
  credit_risk_score integer DEFAULT 50,
  delinquency_flag  boolean DEFAULT false,
  payment_history   text,
  ucc_filing_count  integer DEFAULT 0,
  lien_count        integer DEFAULT 0,
  lien_details      text,
  created_at        timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pc_company_access (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id  uuid NOT NULL REFERENCES public.private_companies(id) ON DELETE CASCADE,
  granted_at  timestamptz DEFAULT now(),
  UNIQUE(user_id, company_id)
);

-- ------------------------------------------------------------
-- 12. CYBERINTEL — organizations
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organizations (
  id                      uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_name       text NOT NULL,
  industry                text,
  employee_count          integer,
  security_posture_score  integer DEFAULT 50,
  attack_surface_score    integer DEFAULT 50,
  breach_count_12m        integer DEFAULT 0,
  last_breach_date        text,
  breach_details          text,
  open_ports              text,
  exposed_services        text,
  critical_cve_count      integer DEFAULT 0,
  high_cve_count          integer DEFAULT 0,
  cve_details             text,
  created_at              timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.org_access (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id     uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  granted_at timestamptz DEFAULT now(),
  UNIQUE(user_id, org_id)
);

-- ------------------------------------------------------------
-- 13. BIOPHARMINTEL — drug_programs
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.drug_programs (
  id                    uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  program_name          text NOT NULL,
  phase                 text,
  development_status    text DEFAULT 'active',
  sponsor_company       text,
  mechanism_of_action   text,
  drug_class            text,
  molecule_type         text,
  scientific_details    text,
  primary_indication    text,
  secondary_indications text,
  target_population     text,
  deal_partner          text,
  deal_value            numeric,
  license_type          text,
  created_at            timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.program_access (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  program_id  uuid NOT NULL REFERENCES public.drug_programs(id) ON DELETE CASCADE,
  granted_at  timestamptz DEFAULT now(),
  UNIQUE(user_id, program_id)
);

-- ------------------------------------------------------------
-- 14. INDUSTRIALINTEL — industrial_facilities
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.industrial_facilities (
  id                      uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  facility_name           text NOT NULL,
  facility_type           text,
  location                text,
  country                 text,
  risk_score              numeric DEFAULT 50,
  is_expanding            boolean DEFAULT false,
  expansion_details       text,
  production_capacity     text,
  utilization_rate        text,
  compliance_event_count  integer DEFAULT 0,
  last_inspection_date    text,
  inspector_contact       text,
  iso_14001               boolean DEFAULT false,
  iso_9001                boolean DEFAULT false,
  other_certifications    text,
  created_at              timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.facility_access (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  facility_id uuid NOT NULL REFERENCES public.industrial_facilities(id) ON DELETE CASCADE,
  granted_at  timestamptz DEFAULT now(),
  UNIQUE(user_id, facility_id)
);

-- ------------------------------------------------------------
-- 15. GOVINTEL — gov_opportunities
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gov_opportunities (
  id                    uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  opportunity_title     text NOT NULL,
  agency                text,
  solicitation_type     text,
  status                text DEFAULT 'open',
  award_amount          numeric,
  deadline              text,
  posted_date           text,
  expected_award_date   text,
  naics_code            text,
  set_aside_type        text,
  point_of_contact      text,
  awardee               text,
  contract_number       text,
  created_at            timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.opportunity_access (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opportunity_id uuid NOT NULL REFERENCES public.gov_opportunities(id) ON DELETE CASCADE,
  granted_at     timestamptz DEFAULT now(),
  UNIQUE(user_id, opportunity_id)
);

-- ------------------------------------------------------------
-- 16. INSURANCEINTEL — insurance_accounts
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.insurance_accounts (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_name      text NOT NULL,
  account_type      text DEFAULT 'carrier',
  hq_state          text,
  lines_of_business text,
  specialties       text,
  premium_volume    numeric,
  compliance_score  integer DEFAULT 70,
  licensed_states   text,
  license_numbers   text,
  am_best_rating    text,
  loss_ratio        numeric,
  combined_ratio    numeric,
  created_at        timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.account_access (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id  uuid NOT NULL REFERENCES public.insurance_accounts(id) ON DELETE CASCADE,
  granted_at  timestamptz DEFAULT now(),
  UNIQUE(user_id, account_id)
);

-- ============================================================
-- STEP 6: INDEXES FOR PERFORMANCE
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_credit_ledger_user_id ON public.credit_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_created ON public.credit_ledger(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON public.audit_log(actor);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON public.audit_log(created_at DESC);

-- Access table indexes
CREATE INDEX IF NOT EXISTS idx_company_access_user   ON public.company_access(user_id);
CREATE INDEX IF NOT EXISTS idx_lead_access_user       ON public.lead_access(user_id);
CREATE INDEX IF NOT EXISTS idx_supplier_access_user   ON public.supplier_access(user_id);
CREATE INDEX IF NOT EXISTS idx_trial_access_user      ON public.trial_access(user_id);
CREATE INDEX IF NOT EXISTS idx_case_access_user       ON public.case_access(user_id);
CREATE INDEX IF NOT EXISTS idx_entity_access_user     ON public.entity_access(user_id);
CREATE INDEX IF NOT EXISTS idx_paper_access_user      ON public.paper_access(user_id);
CREATE INDEX IF NOT EXISTS idx_creator_access_user    ON public.creator_access(user_id);
CREATE INDEX IF NOT EXISTS idx_studio_access_user     ON public.studio_access(user_id);
CREATE INDEX IF NOT EXISTS idx_property_access_user   ON public.property_access(user_id);
CREATE INDEX IF NOT EXISTS idx_pc_company_access_user ON public.pc_company_access(user_id);
CREATE INDEX IF NOT EXISTS idx_org_access_user        ON public.org_access(user_id);
CREATE INDEX IF NOT EXISTS idx_program_access_user    ON public.program_access(user_id);
CREATE INDEX IF NOT EXISTS idx_facility_access_user   ON public.facility_access(user_id);
CREATE INDEX IF NOT EXISTS idx_opportunity_access_user ON public.opportunity_access(user_id);
CREATE INDEX IF NOT EXISTS idx_account_access_user    ON public.account_access(user_id);

-- ============================================================
-- STEP 7: ROW LEVEL SECURITY
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.user_profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_ledger       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_access      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.b2b_leads           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_access         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_access     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_trials     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trial_access        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_cases         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_access         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_entities     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entity_access       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.papers              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paper_access        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creators            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_access      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_studios        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_access       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_access     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.private_companies   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pc_company_access   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_access          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drug_programs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_access      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.industrial_facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facility_access     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gov_opportunities   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_access  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurance_accounts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_access      ENABLE ROW LEVEL SECURITY;

-- ============ RLS POLICIES ============

-- user_profiles: users see own, admins see all
CREATE POLICY "users_own_profile" ON public.user_profiles
  FOR SELECT USING (id = auth.uid() OR is_admin());
CREATE POLICY "users_update_own_profile" ON public.user_profiles
  FOR UPDATE USING (id = auth.uid());

-- credit_ledger: users see own balance
CREATE POLICY "users_own_credits" ON public.credit_ledger
  FOR SELECT USING (user_id = auth.uid() OR is_admin());
CREATE POLICY "users_insert_credits" ON public.credit_ledger
  FOR INSERT WITH CHECK (is_admin());

-- audit_log: admin only
CREATE POLICY "admin_audit_log" ON public.audit_log
  FOR ALL USING (is_admin());

-- Vertical source tables: all authenticated users can SELECT (preview model)
-- Access tables: users see only their own rows

-- DEALFLOW
CREATE POLICY "auth_select_companies" ON public.companies
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "admin_manage_companies" ON public.companies
  FOR ALL USING (is_admin());
CREATE POLICY "users_own_company_access" ON public.company_access
  FOR SELECT USING (user_id = auth.uid() OR is_admin());
CREATE POLICY "users_insert_company_access" ON public.company_access
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- SALESINTEL
CREATE POLICY "auth_select_leads" ON public.b2b_leads
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "admin_manage_leads" ON public.b2b_leads
  FOR ALL USING (is_admin());
CREATE POLICY "users_own_lead_access" ON public.lead_access
  FOR SELECT USING (user_id = auth.uid() OR is_admin());
CREATE POLICY "users_insert_lead_access" ON public.lead_access
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- SUPPLYINTEL
CREATE POLICY "auth_select_suppliers" ON public.suppliers
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "admin_manage_suppliers" ON public.suppliers
  FOR ALL USING (is_admin());
CREATE POLICY "users_own_supplier_access" ON public.supplier_access
  FOR SELECT USING (user_id = auth.uid() OR is_admin());
CREATE POLICY "users_insert_supplier_access" ON public.supplier_access
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- CLINICALINTEL
CREATE POLICY "auth_select_trials" ON public.clinical_trials
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "admin_manage_trials" ON public.clinical_trials
  FOR ALL USING (is_admin());
CREATE POLICY "users_own_trial_access" ON public.trial_access
  FOR SELECT USING (user_id = auth.uid() OR is_admin());
CREATE POLICY "users_insert_trial_access" ON public.trial_access
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- LEGALINTEL
CREATE POLICY "auth_select_cases" ON public.legal_cases
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "admin_manage_cases" ON public.legal_cases
  FOR ALL USING (is_admin());
CREATE POLICY "users_own_case_access" ON public.case_access
  FOR SELECT USING (user_id = auth.uid() OR is_admin());
CREATE POLICY "users_insert_case_access" ON public.case_access
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- MARKETRESEARCH
CREATE POLICY "auth_select_entities" ON public.market_entities
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "admin_manage_entities" ON public.market_entities
  FOR ALL USING (is_admin());
CREATE POLICY "users_own_entity_access" ON public.entity_access
  FOR SELECT USING (user_id = auth.uid() OR is_admin());
CREATE POLICY "users_insert_entity_access" ON public.entity_access
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- ACADEMICINTEL
CREATE POLICY "auth_select_papers" ON public.papers
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "admin_manage_papers" ON public.papers
  FOR ALL USING (is_admin());
CREATE POLICY "users_own_paper_access" ON public.paper_access
  FOR SELECT USING (user_id = auth.uid() OR is_admin());
CREATE POLICY "users_insert_paper_access" ON public.paper_access
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- CREATORINTEL
CREATE POLICY "auth_select_creators" ON public.creators
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "admin_manage_creators" ON public.creators
  FOR ALL USING (is_admin());
CREATE POLICY "users_own_creator_access" ON public.creator_access
  FOR SELECT USING (user_id = auth.uid() OR is_admin());
CREATE POLICY "users_insert_creator_access" ON public.creator_access
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- GAMINGINTEL
CREATE POLICY "auth_select_studios" ON public.game_studios
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "admin_manage_studios" ON public.game_studios
  FOR ALL USING (is_admin());
CREATE POLICY "users_own_studio_access" ON public.studio_access
  FOR SELECT USING (user_id = auth.uid() OR is_admin());
CREATE POLICY "users_insert_studio_access" ON public.studio_access
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- REALESTATEINTEL
CREATE POLICY "auth_select_properties" ON public.properties
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "admin_manage_properties" ON public.properties
  FOR ALL USING (is_admin());
CREATE POLICY "users_own_property_access" ON public.property_access
  FOR SELECT USING (user_id = auth.uid() OR is_admin());
CREATE POLICY "users_insert_property_access" ON public.property_access
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- PRIVATECREDITINTEL
CREATE POLICY "auth_select_private_companies" ON public.private_companies
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "admin_manage_private_companies" ON public.private_companies
  FOR ALL USING (is_admin());
CREATE POLICY "users_own_pc_access" ON public.pc_company_access
  FOR SELECT USING (user_id = auth.uid() OR is_admin());
CREATE POLICY "users_insert_pc_access" ON public.pc_company_access
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- CYBERINTEL
CREATE POLICY "auth_select_orgs" ON public.organizations
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "admin_manage_orgs" ON public.organizations
  FOR ALL USING (is_admin());
CREATE POLICY "users_own_org_access" ON public.org_access
  FOR SELECT USING (user_id = auth.uid() OR is_admin());
CREATE POLICY "users_insert_org_access" ON public.org_access
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- BIOPHARMINTEL
CREATE POLICY "auth_select_programs" ON public.drug_programs
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "admin_manage_programs" ON public.drug_programs
  FOR ALL USING (is_admin());
CREATE POLICY "users_own_program_access" ON public.program_access
  FOR SELECT USING (user_id = auth.uid() OR is_admin());
CREATE POLICY "users_insert_program_access" ON public.program_access
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- INDUSTRIALINTEL
CREATE POLICY "auth_select_facilities" ON public.industrial_facilities
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "admin_manage_facilities" ON public.industrial_facilities
  FOR ALL USING (is_admin());
CREATE POLICY "users_own_facility_access" ON public.facility_access
  FOR SELECT USING (user_id = auth.uid() OR is_admin());
CREATE POLICY "users_insert_facility_access" ON public.facility_access
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- GOVINTEL
CREATE POLICY "auth_select_opportunities" ON public.gov_opportunities
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "admin_manage_opportunities" ON public.gov_opportunities
  FOR ALL USING (is_admin());
CREATE POLICY "users_own_opportunity_access" ON public.opportunity_access
  FOR SELECT USING (user_id = auth.uid() OR is_admin());
CREATE POLICY "users_insert_opportunity_access" ON public.opportunity_access
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- INSURANCEINTEL
CREATE POLICY "auth_select_accounts" ON public.insurance_accounts
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "admin_manage_accounts" ON public.insurance_accounts
  FOR ALL USING (is_admin());
CREATE POLICY "users_own_account_access" ON public.account_access
  FOR SELECT USING (user_id = auth.uid() OR is_admin());
CREATE POLICY "users_insert_account_access" ON public.account_access
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- ============================================================
-- STEP 8: SECURE UNLOCK RPCs
-- Each RPC: deduplicates, costs only new rows, debits credits
-- ============================================================

-- Generic unlock helper (used by all RPCs internally)
CREATE OR REPLACE FUNCTION public.process_unlock(
  p_user_id     uuid,
  p_ids         uuid[],
  p_table       text,
  p_id_col      text,
  p_access_table text,
  p_access_id_col text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_balance     integer;
  v_new_ids     uuid[];
  v_cost        integer;
BEGIN
  -- Get current balance
  SELECT COALESCE(SUM(delta), 0) INTO v_balance
  FROM public.credit_ledger WHERE user_id = p_user_id;

  -- Find IDs not yet unlocked
  EXECUTE format(
    'SELECT ARRAY(SELECT unnest($1) EXCEPT SELECT %I FROM %I WHERE user_id = $2)',
    p_access_id_col, p_access_table
  ) INTO v_new_ids USING p_ids, p_user_id;

  v_cost := array_length(v_new_ids, 1);
  IF v_cost IS NULL OR v_cost = 0 THEN
    RETURN jsonb_build_object('success', true, 'unlocked', 0, 'cost', 0);
  END IF;

  IF v_balance < v_cost THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_credits', 'balance', v_balance, 'cost', v_cost);
  END IF;

  -- Insert access rows
  EXECUTE format(
    'INSERT INTO %I (user_id, %I) SELECT $1, unnest($2) ON CONFLICT DO NOTHING',
    p_access_table, p_access_id_col
  ) USING p_user_id, v_new_ids;

  -- Debit credits
  INSERT INTO public.credit_ledger (user_id, delta, reason)
  VALUES (p_user_id, -v_cost, 'unlock_' || p_table);

  -- Audit
  INSERT INTO public.audit_log (actor, action, entity, meta)
  VALUES (p_user_id, 'unlock', p_table, jsonb_build_object('count', v_cost, 'ids', v_new_ids));

  RETURN jsonb_build_object('success', true, 'unlocked', v_cost, 'cost', v_cost, 'balance', v_balance - v_cost);
END;
$$;

-- Individual RPCs per vertical
CREATE OR REPLACE FUNCTION public.unlock_companies_secure(p_company_ids uuid[])
RETURNS jsonb LANGUAGE sql SECURITY DEFINER AS $$
  SELECT public.process_unlock(auth.uid(), p_company_ids, 'companies', 'id', 'company_access', 'company_id');
$$;

CREATE OR REPLACE FUNCTION public.unlock_leads_secure(p_lead_ids uuid[])
RETURNS jsonb LANGUAGE sql SECURITY DEFINER AS $$
  SELECT public.process_unlock(auth.uid(), p_lead_ids, 'b2b_leads', 'id', 'lead_access', 'lead_id');
$$;

CREATE OR REPLACE FUNCTION public.unlock_suppliers_secure(p_supplier_ids uuid[])
RETURNS jsonb LANGUAGE sql SECURITY DEFINER AS $$
  SELECT public.process_unlock(auth.uid(), p_supplier_ids, 'suppliers', 'id', 'supplier_access', 'supplier_id');
$$;

CREATE OR REPLACE FUNCTION public.unlock_trials_secure(p_trial_ids uuid[])
RETURNS jsonb LANGUAGE sql SECURITY DEFINER AS $$
  SELECT public.process_unlock(auth.uid(), p_trial_ids, 'clinical_trials', 'id', 'trial_access', 'trial_id');
$$;

CREATE OR REPLACE FUNCTION public.unlock_cases_secure(p_case_ids uuid[])
RETURNS jsonb LANGUAGE sql SECURITY DEFINER AS $$
  SELECT public.process_unlock(auth.uid(), p_case_ids, 'legal_cases', 'id', 'case_access', 'case_id');
$$;

CREATE OR REPLACE FUNCTION public.unlock_entities_secure(p_entity_ids uuid[])
RETURNS jsonb LANGUAGE sql SECURITY DEFINER AS $$
  SELECT public.process_unlock(auth.uid(), p_entity_ids, 'market_entities', 'id', 'entity_access', 'entity_id');
$$;

CREATE OR REPLACE FUNCTION public.unlock_papers_secure(p_paper_ids uuid[])
RETURNS jsonb LANGUAGE sql SECURITY DEFINER AS $$
  SELECT public.process_unlock(auth.uid(), p_paper_ids, 'papers', 'id', 'paper_access', 'paper_id');
$$;

CREATE OR REPLACE FUNCTION public.unlock_creators_secure(p_creator_ids uuid[])
RETURNS jsonb LANGUAGE sql SECURITY DEFINER AS $$
  SELECT public.process_unlock(auth.uid(), p_creator_ids, 'creators', 'id', 'creator_access', 'creator_id');
$$;

CREATE OR REPLACE FUNCTION public.unlock_studios_secure(p_studio_ids uuid[])
RETURNS jsonb LANGUAGE sql SECURITY DEFINER AS $$
  SELECT public.process_unlock(auth.uid(), p_studio_ids, 'game_studios', 'id', 'studio_access', 'studio_id');
$$;

CREATE OR REPLACE FUNCTION public.unlock_properties_secure(p_property_ids uuid[])
RETURNS jsonb LANGUAGE sql SECURITY DEFINER AS $$
  SELECT public.process_unlock(auth.uid(), p_property_ids, 'properties', 'id', 'property_access', 'property_id');
$$;

CREATE OR REPLACE FUNCTION public.unlock_private_companies_secure(p_company_ids uuid[])
RETURNS jsonb LANGUAGE sql SECURITY DEFINER AS $$
  SELECT public.process_unlock(auth.uid(), p_company_ids, 'private_companies', 'id', 'pc_company_access', 'company_id');
$$;

CREATE OR REPLACE FUNCTION public.unlock_organizations_secure(p_org_ids uuid[])
RETURNS jsonb LANGUAGE sql SECURITY DEFINER AS $$
  SELECT public.process_unlock(auth.uid(), p_org_ids, 'organizations', 'id', 'org_access', 'org_id');
$$;

CREATE OR REPLACE FUNCTION public.unlock_programs_secure(p_program_ids uuid[])
RETURNS jsonb LANGUAGE sql SECURITY DEFINER AS $$
  SELECT public.process_unlock(auth.uid(), p_program_ids, 'drug_programs', 'id', 'program_access', 'program_id');
$$;

CREATE OR REPLACE FUNCTION public.unlock_facilities_secure(p_facility_ids uuid[])
RETURNS jsonb LANGUAGE sql SECURITY DEFINER AS $$
  SELECT public.process_unlock(auth.uid(), p_facility_ids, 'industrial_facilities', 'id', 'facility_access', 'facility_id');
$$;

CREATE OR REPLACE FUNCTION public.unlock_opportunities_secure(p_opportunity_ids uuid[])
RETURNS jsonb LANGUAGE sql SECURITY DEFINER AS $$
  SELECT public.process_unlock(auth.uid(), p_opportunity_ids, 'gov_opportunities', 'id', 'opportunity_access', 'opportunity_id');
$$;

CREATE OR REPLACE FUNCTION public.unlock_accounts_secure(p_account_ids uuid[])
RETURNS jsonb LANGUAGE sql SECURITY DEFINER AS $$
  SELECT public.process_unlock(auth.uid(), p_account_ids, 'insurance_accounts', 'id', 'account_access', 'account_id');
$$;

-- Credit top-up (admin only)
CREATE OR REPLACE FUNCTION public.admin_add_credits(p_user_id uuid, p_amount integer, p_reason text DEFAULT 'admin_grant')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;
  INSERT INTO public.credit_ledger (user_id, delta, reason)
  VALUES (p_user_id, p_amount, p_reason);
  RETURN jsonb_build_object('success', true, 'added', p_amount);
END;
$$;

-- Promote user to admin (admin only)
CREATE OR REPLACE FUNCTION public.admin_set_role(p_user_id uuid, p_role text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;
  UPDATE public.user_profiles SET role = p_role WHERE id = p_user_id;
  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================================
-- STEP 9: SEED DATA — 10 rows per vertical (safe demo data)
-- ============================================================

-- DEALFLOW
INSERT INTO public.companies (company_name, funding_stage, sector, hq_location, total_raised, valuation, intelligence_score, description, founded_year) VALUES
('Acme Ventures', 'Series B', 'SaaS', 'San Francisco, CA', 25000000, 120000000, 82, 'Enterprise workflow automation platform', 2019),
('NexGen AI', 'Series A', 'AI/ML', 'New York, NY', 8000000, 40000000, 91, 'Generative AI for enterprise document processing', 2021),
('CloudBase Pro', 'Seed', 'Cloud Infrastructure', 'Austin, TX', 2500000, 12000000, 74, 'Developer-first cloud deployment tooling', 2022),
('HealthLink', 'Series C', 'HealthTech', 'Boston, MA', 55000000, 280000000, 88, 'Digital health records interoperability', 2017),
('FinTrack Systems', 'Growth', 'FinTech', 'Chicago, IL', 90000000, 450000000, 79, 'Real-time financial compliance monitoring', 2015),
('DataMesh Co', 'Series A', 'Data Infrastructure', 'Seattle, WA', 12000000, 60000000, 85, 'Distributed data mesh orchestration', 2020),
('SecureVault', 'Series B', 'Cybersecurity', 'Denver, CO', 30000000, 150000000, 93, 'Zero-trust identity management', 2018),
('GreenPath Energy', 'Series D+', 'CleanTech', 'Houston, TX', 150000000, 800000000, 77, 'Utility-scale solar project developer', 2014),
('Retail AI Labs', 'Seed', 'Retail Tech', 'Los Angeles, CA', 1800000, 9000000, 68, 'AI-powered inventory optimization for SMBs', 2023),
('LogistiQ', 'Series A', 'Supply Chain', 'Miami, FL', 9500000, 47000000, 81, 'Last-mile logistics intelligence platform', 2021);

-- SALESINTEL
INSERT INTO public.b2b_leads (company, full_name, title, email, email_status, employee_count, revenue_range, industry, intelligence_score, priority_score) VALUES
('TechCorp Global', 'Sarah Chen', 'VP of Engineering', 'sarah.chen@techcorp.com', 'verified', 5000, '$500M-$1B', 'Technology', 88, 92),
('Apex Financial', 'Marcus Webb', 'CFO', 'mwebb@apexfin.com', 'verified', 800, '$100M-$500M', 'Finance', 85, 87),
('MedGroup Inc', 'Priya Sharma', 'Director of Ops', 'psharma@medgroup.com', 'valid', 2200, '$200M-$500M', 'Healthcare', 79, 81),
('RetailNow Corp', 'James Okafor', 'CTO', 'jokafor@retailnow.io', 'verified', 350, '$50M-$100M', 'Retail', 91, 94),
('BuildRight LLC', 'Amanda Torres', 'Head of IT', 'atorres@buildright.com', 'risky', 120, '$10M-$50M', 'Construction', 62, 58),
('DataSphere', 'Leo Kim', 'CEO', 'leo@datasphere.ai', 'verified', 45, '$1M-$10M', 'Data Analytics', 95, 96),
('GovServe Solutions', 'Nicole Baker', 'Procurement Manager', 'nbaker@govserve.gov', 'valid', 900, '$100M-$200M', 'Government', 73, 75),
('AutoParts Direct', 'Ryan Hughes', 'SVP Sales', 'rhughes@autopartsdirect.com', 'unknown', 1500, '$200M-$500M', 'Automotive', 55, 60),
('EduPath Online', 'Tanya Morales', 'CMO', 'tmorales@edupath.com', 'verified', 220, '$20M-$50M', 'Education', 83, 85),
('FoodPro Systems', 'Derek Lawson', 'Director of Tech', 'dlawson@foodpro.com', 'valid', 680, '$80M-$150M', 'Food & Beverage', 77, 79);

-- SUPPLYINTEL
INSERT INTO public.suppliers (supplier_name, country, category, risk_score, compliance_status, iso_certified, lead_time_days) VALUES
('Apex Manufacturing Ltd', 'China', 'Electronics Components', 72, 'compliant', true, 21),
('Global Parts Co', 'Mexico', 'Automotive Parts', 45, 'compliant', true, 14),
('TechSource GmbH', 'Germany', 'Industrial Equipment', 28, 'compliant', true, 35),
('FastLogix Inc', 'USA', 'Logistics Services', 35, 'compliant', false, 7),
('SteelWorks Ltd', 'India', 'Raw Materials', 81, 'non-compliant', false, 28),
('PrecisionParts SA', 'Brazil', 'Precision Components', 58, 'partial', true, 45),
('NordSupply AB', 'Sweden', 'Packaging Materials', 22, 'compliant', true, 18),
('AsiaFab Corp', 'Vietnam', 'Textiles', 76, 'under-review', false, 30),
('CoreTech Systems', 'Taiwan', 'Semiconductors', 43, 'compliant', true, 60),
('QuickShip LLC', 'Canada', 'Fulfillment Services', 31, 'compliant', false, 5);

-- CLINICALINTEL
INSERT INTO public.clinical_trials (trial_title, phase, recruitment_status, complexity_score, condition, sponsor, primary_location) VALUES
('ONCO-301: Pembrolizumab + Chemo in NSCLC', 'Phase 3', 'recruiting', 87, 'Non-Small Cell Lung Cancer', 'OncoBio Therapeutics', 'New York, USA'),
('CardioGuard-2: ARB in Heart Failure', 'Phase 2', 'active', 65, 'Congestive Heart Failure', 'HeartBridge Pharma', 'London, UK'),
('NeuroPath-1: Gene Therapy ALS', 'Phase 1', 'recruiting', 94, 'Amyotrophic Lateral Sclerosis', 'NeuroGen Labs', 'Boston, USA'),
('DIAB-501: GLP-2 Analogue Type 2', 'Phase 3', 'active', 72, 'Type 2 Diabetes', 'MetaboRx Inc', 'Berlin, Germany'),
('PSYCH-202: Ketamine Depression', 'Phase 2', 'recruiting', 78, 'Treatment-Resistant Depression', 'MindCure Bio', 'Toronto, Canada'),
('IMMUNO-101: CAR-T Lymphoma', 'Phase 1', 'recruiting', 96, 'B-Cell Lymphoma', 'CellForge Biotech', 'San Diego, USA'),
('RETRO-401: Gene Editing Sickle Cell', 'Phase 2', 'active', 91, 'Sickle Cell Disease', 'GenomeWorks', 'Houston, USA'),
('RESP-301: IL-13 Asthma', 'Phase 3', 'completed', 68, 'Severe Asthma', 'PulmoRx Ltd', 'Paris, France'),
('PAIN-201: Na-channel Blocker', 'Preclinical', 'recruiting', 55, 'Chronic Neuropathic Pain', 'AlgoRx', 'Chicago, USA'),
('CARDIO-601: PCSK9 Inhibitor', 'Phase 4', 'active', 61, 'Hypercholesterolemia', 'LipidLabs Corp', 'Tokyo, Japan');

-- LEGALINTEL
INSERT INTO public.legal_cases (case_title, jurisdiction, filed_date, status, damages_claimed, plaintiff, defendant) VALUES
('TechCorp v. DataStream Inc — IP Infringement', 'S.D.N.Y.', '2024-03-15', 'active', 45000000, 'TechCorp Global', 'DataStream Inc'),
('Apex v. NovaBuild — Breach of Contract', 'N.D. Cal.', '2024-01-22', 'active', 12000000, 'Apex Financial', 'NovaBuild LLC'),
('SEC v. CryptoVault Partners', 'D.D.C.', '2023-09-10', 'active', 180000000, 'SEC', 'CryptoVault Partners'),
('HealthNet v. InsureCo — Antitrust', 'N.D. Ill.', '2023-11-05', 'appeal', 320000000, 'HealthNet Corp', 'InsureCo America'),
('GreenCo v. EPAWatch — Environmental', 'D. Colo.', '2024-02-28', 'pending', 8500000, 'GreenCo Energy', 'EPA'),
('RetailGiant v. SupplierX — Tortious Interference', 'S.D. Tex.', '2023-06-14', 'settled', 22000000, 'RetailGiant Inc', 'SupplierX Ltd'),
('AutoCorp v. ChipSource — Supply Disruption', 'E.D. Mich.', '2024-04-01', 'active', 67000000, 'AutoCorp USA', 'ChipSource Taiwan'),
('BioMed v. GeneTech — Patent', 'D. Del.', '2023-08-19', 'active', 95000000, 'BioMed Innovations', 'GeneTech Inc'),
('City of Austin v. ConstructCo — Negligence', 'W.D. Tex.', '2022-12-03', 'dismissed', 15000000, 'City of Austin', 'ConstructCo LLC'),
('FinServ v. Rogue Trader — Fraud', 'S.D. Fla.', '2024-05-10', 'active', 33000000, 'FinServ Capital', 'John Doe et al.');

-- MARKETRESEARCH
INSERT INTO public.market_entities (brand_name, category, hq_region, trend_score, sentiment_score, search_volume) VALUES
('ApexBrand', 'Consumer Electronics', 'North America', 84, 72, 2400000),
('NovaDrink', 'Beverages', 'Europe', 91, 88, 1800000),
('PureLife Wellness', 'Health & Wellness', 'North America', 76, 81, 950000),
('TechWear Pro', 'Apparel', 'Asia Pacific', 68, 55, 620000),
('GreenMart', 'Retail', 'North America', 79, 83, 1100000),
('SpeedMotors', 'Automotive', 'Europe', 62, 48, 3200000),
('CloudHome', 'Smart Home', 'North America', 88, 79, 780000),
('FitCore', 'Fitness', 'Global', 95, 91, 4500000),
('OrganicBasket', 'Food & Grocery', 'North America', 73, 86, 440000),
('ByteGames', 'Gaming', 'Asia Pacific', 82, 77, 2100000);

-- ACADEMICINTEL
INSERT INTO public.papers (title, journal, published_date, doi, citation_count, is_open_access, collaboration_score) VALUES
('Transformer Models in Drug Discovery: A Systematic Review', 'Nature Computational Science', '2023-06-12', '10.1038/s43588-023-0421-x', 892, true, 88),
('CRISPR-Cas9 Off-Target Effects: Risk Profiling in Somatic Cells', 'Cell', '2023-11-03', '10.1016/j.cell.2023.09.022', 1244, false, 91),
('Large Language Models and Clinical Decision Support', 'NEJM AI', '2024-01-20', '10.1056/AIoa2300017', 334, true, 79),
('Quantum Error Correction at Scale: Surface Code Benchmarks', 'Physical Review Letters', '2023-08-15', '10.1103/PhysRevLett.131.070601', 567, false, 82),
('Zero-Shot Learning in Protein Structure Prediction', 'Science', '2023-03-31', '10.1126/science.adg7990', 2103, true, 95),
('Federated Learning for Privacy-Preserving Healthcare Analytics', 'Nature Medicine', '2023-09-07', '10.1038/s41591-023-02475-5', 428, true, 87),
('Carbon Capture Economics at Gigaton Scale', 'Nature Energy', '2024-02-14', '10.1038/s41560-024-01471-2', 156, false, 73),
('Microbiome Diversity and Mental Health: Longitudinal Analysis', 'Cell Host & Microbe', '2023-07-19', '10.1016/j.chom.2023.06.003', 719, false, 84),
('Autonomous Vehicle Safety in Mixed-Traffic Environments', 'IEEE Transactions on Intelligent Transportation Systems', '2023-12-01', '10.1109/TITS.2023.3312847', 211, true, 76),
('mRNA Vaccine Platform Stability Across Variants', 'Lancet', '2024-03-05', '10.1016/S0140-6736(24)00412-1', 988, false, 93);

-- CREATORINTEL
INSERT INTO public.creators (creator_name, primary_platform, niche, followers, engagement_rate, is_verified) VALUES
('Alex Rivera', 'instagram', 'Fitness & Lifestyle', 2800000, 4.2, true),
('Luna Kim', 'tiktok', 'Beauty & Skincare', 5100000, 8.7, true),
('Marcus Dev', 'youtube', 'Tech Reviews', 980000, 3.1, true),
('Sofia Eats', 'instagram', 'Food & Cooking', 1650000, 5.9, false),
('CodeWithJay', 'youtube', 'Programming Tutorials', 720000, 6.4, true),
('TravelTina', 'instagram', 'Travel & Adventure', 3400000, 3.8, true),
('HealthyHarris', 'tiktok', 'Nutrition & Wellness', 8900000, 11.2, true),
('GameStreamer99', 'twitch', 'Gaming', 450000, 7.6, false),
('FashionForward', 'instagram', 'Fashion & Style', 2100000, 4.5, true),
('FinanceFred', 'youtube', 'Personal Finance', 330000, 5.2, false);

-- GAMINGINTEL
INSERT INTO public.game_studios (studio_name, country, founded_year, engine_used, team_size, avg_metacritic, latest_title) VALUES
('Pixel Forge Studios', 'USA', 2015, 'Unreal', 85, 82, 'StarBreach: Origins'),
('Nordic Code AB', 'Sweden', 2012, 'Unity', 42, 78, 'Frostfall Chronicles'),
('TokioBytes', 'Japan', 2008, 'In-house', 210, 91, 'Neon Dynasty RPG'),
('BrazilGames SA', 'Brazil', 2019, 'Godot', 18, 71, 'Carnival Chaos'),
('DevMachine UK', 'UK', 2011, 'Unreal', 120, 86, 'SteelCity: Redux'),
('IndiePulse LLC', 'USA', 2020, 'Godot', 8, 74, 'Echoes of Dust'),
('MegaStudio Korea', 'South Korea', 2006, 'In-house', 450, 88, 'HyperKnight Online'),
('SandboxSoft', 'Canada', 2016, 'Unity', 35, 79, 'WorldBuilder VR'),
('SprintGames AU', 'Australia', 2018, 'Unreal', 22, 76, 'Outback Odyssey'),
('PixelNest', 'Germany', 2013, 'Unity', 60, 83, 'Clockwork Empire');

-- REALESTATEINTEL
INSERT INTO public.properties (property_name, property_type, city, state, valuation_estimate, risk_score, debt_maturity_flag) VALUES
('One Market Plaza', 'Office', 'San Francisco', 'CA', 485000000, 72, true),
('Riverside Industrial Park', 'Industrial', 'Dallas', 'TX', 92000000, 45, false),
('Hudson Yards Tower C', 'Mixed-Use', 'New York', 'NY', 1200000000, 38, false),
('Sunbelt Logistics Hub', 'Warehouse', 'Phoenix', 'AZ', 78000000, 31, false),
('Lakefront Apartments Phase 2', 'Multifamily', 'Chicago', 'IL', 145000000, 55, true),
('Gulf Coast Retail Center', 'Retail', 'Houston', 'TX', 43000000, 81, true),
('Silicon Valley Campus', 'Office', 'San Jose', 'CA', 320000000, 42, false),
('Midwest Data Center', 'Industrial', 'Columbus', 'OH', 165000000, 28, false),
('Beachfront Hotel Resort', 'Hospitality', 'Miami', 'FL', 220000000, 68, true),
('Urban Mixed District', 'Mixed-Use', 'Atlanta', 'GA', 88000000, 51, false);

-- PRIVATECREDITINTEL
INSERT INTO public.private_companies (company_name, industry, hq_location, revenue_estimate, credit_risk_score, delinquency_flag, ucc_filing_count) VALUES
('Alpha Distribution LLC', 'Wholesale Distribution', 'Atlanta, GA', 45000000, 38, false, 2),
('Omega Manufacturing', 'Manufacturing', 'Detroit, MI', 120000000, 72, true, 7),
('PrimeCare Services', 'Healthcare Services', 'Nashville, TN', 28000000, 44, false, 1),
('SteelBridge Corp', 'Construction', 'Pittsburgh, PA', 85000000, 81, true, 12),
('AgroSupply Inc', 'Agriculture', 'Des Moines, IA', 62000000, 35, false, 3),
('Coastal Hospitality Group', 'Hospitality', 'Charleston, SC', 33000000, 59, false, 4),
('TruckFleet USA', 'Transportation', 'Memphis, TN', 51000000, 67, true, 9),
('NorthStar Realty', 'Real Estate', 'Minneapolis, MN', 94000000, 48, false, 2),
('SunTech Solutions', 'Technology Services', 'Austin, TX', 18000000, 29, false, 0),
('GreenField Foods', 'Food Processing', 'Kansas City, MO', 77000000, 53, false, 5);

-- CYBERINTEL
INSERT INTO public.organizations (organization_name, industry, employee_count, security_posture_score, attack_surface_score, breach_count_12m, critical_cve_count) VALUES
('GlobalBank Corp', 'Financial Services', 45000, 82, 38, 0, 2),
('HealthSystem East', 'Healthcare', 12000, 54, 71, 2, 8),
('RetailGiant US', 'Retail', 89000, 61, 84, 1, 5),
('TechUnicorn Inc', 'Technology', 3200, 91, 22, 0, 0),
('EnergyCo Utilities', 'Energy', 8500, 44, 88, 3, 14),
('AeroDefense LLC', 'Defense', 6700, 87, 29, 0, 1),
('UniversityNet', 'Education', 25000, 38, 92, 4, 21),
('MediaStream Corp', 'Media & Entertainment', 4100, 69, 55, 1, 3),
('ShipLine Global', 'Logistics', 17000, 57, 63, 1, 6),
('InsuranceGroup', 'Insurance', 9300, 76, 41, 0, 2);

-- BIOPHARMINTEL
INSERT INTO public.drug_programs (program_name, phase, development_status, sponsor_company, primary_indication, mechanism_of_action, drug_class) VALUES
('VM-101: Anti-PD-L1 NSCLC', 'Phase 3', 'active', 'OncoBio Therapeutics', 'Non-Small Cell Lung Cancer', 'PD-L1 checkpoint inhibition', 'Monoclonal Antibody'),
('GX-202: GLP-1/GIP Dual Agonist', 'Phase 2', 'active', 'MetaboRx Inc', 'Obesity / Type 2 Diabetes', 'Dual incretin receptor agonism', 'Small Molecule Peptide'),
('NV-303: AAV9 Gene Therapy SMA', 'Phase 1', 'active', 'NeuroGen Labs', 'Spinal Muscular Atrophy', 'SMN1 gene replacement', 'Gene Therapy'),
('CF-401: CFTR Modulator Triple', 'Phase 3', 'active', 'PulmoRx Ltd', 'Cystic Fibrosis', 'CFTR protein potentiator/corrector', 'Small Molecule'),
('RX-505: CAR-NK Leukemia', 'Phase 2', 'active', 'CellForge Biotech', 'Acute Myeloid Leukemia', 'CAR-NK cell cytotoxicity', 'Cell Therapy'),
('AL-102: PCSK9 siRNA', 'Phase 3', 'active', 'LipidLabs Corp', 'Hypercholesterolemia', 'PCSK9 mRNA silencing', 'RNA Therapeutics'),
('PD-201: Nav1.7 Inhibitor', 'Preclinical', 'active', 'AlgoRx', 'Chronic Pain', 'Selective sodium channel blockade', 'Small Molecule'),
('IM-601: IL-17A/F Bispecific', 'Phase 2', 'active', 'ImmunoTech Bio', 'Psoriasis / Psoriatic Arthritis', 'Dual IL-17 neutralization', 'Bispecific Antibody'),
('GE-701: Base Editing Sickle Cell', 'Phase 1', 'active', 'GenomeWorks', 'Sickle Cell Disease', 'Adenine base editor correction', 'Gene Editing'),
('DM-801: Tau Antisense ALS', 'Phase 2', 'active', 'NeuroPath Bio', 'ALS / FTD', 'Tau aggregation prevention', 'Antisense Oligonucleotide');

-- INDUSTRIALINTEL
INSERT INTO public.industrial_facilities (facility_name, facility_type, location, country, risk_score, is_expanding, compliance_event_count) VALUES
('Detroit Auto Assembly Plant A', 'Assembly', 'Detroit, MI', 'USA', 42, true, 2),
('Texas Refinery Complex', 'Refinery', 'Houston, TX', 'USA', 78, false, 8),
('Ohio Steel Mill No. 4', 'Steel Mill', 'Cleveland, OH', 'USA', 65, false, 5),
('Carolina Chemical Plant', 'Chemical Processing', 'Charlotte, NC', 'USA', 84, false, 12),
('Pacific Semiconductor Fab', 'Semiconductor', 'Portland, OR', 'USA', 31, true, 1),
('Minnesota Food Processing', 'Food Processing', 'Minneapolis, MN', 'USA', 38, true, 0),
('Gulf Petrochemical Facility', 'Petrochemical', 'New Orleans, LA', 'USA', 71, false, 6),
('Nevada Battery Gigafactory', 'Battery Manufacturing', 'Reno, NV', 'USA', 28, true, 0),
('Arizona Solar Panel Factory', 'Renewable Energy', 'Phoenix, AZ', 'USA', 22, true, 0),
('Virginia Defense Contractor Plant', 'Defense Manufacturing', 'Richmond, VA', 'USA', 45, false, 3);

-- GOVINTEL
INSERT INTO public.gov_opportunities (opportunity_title, agency, solicitation_type, status, award_amount, deadline, posted_date, naics_code) VALUES
('IT Modernization Platform — USAF', 'Department of Air Force', 'Full & Open', 'open', 45000000, '2026-03-15', '2026-01-10', '541512'),
('Cybersecurity Operations Center Services', 'DHS', 'Small Business Set-Aside', 'open', 12000000, '2026-02-28', '2025-12-01', '541519'),
('Healthcare Data Analytics BPA', 'VA', 'Full & Open', 'open', 89000000, '2026-04-30', '2026-01-20', '541511'),
('Border Infrastructure Sensors', 'CBP', 'Full & Open', 'open', 220000000, '2026-06-01', '2025-11-15', '334290'),
('Army Logistics AI Platform', 'Department of Army', '8(a) Set-Aside', 'open', 8500000, '2026-02-20', '2026-01-05', '541715'),
('Federal Cloud Migration Services', 'GSA', 'GWAC', 'open', 500000000, '2026-07-15', '2025-10-01', '541513'),
('Biodefense Lab Equipment', 'CDC', 'Full & Open', 'open', 33000000, '2026-03-31', '2026-01-18', '334516'),
('Navy Communication Systems', 'Department of Navy', 'Full & Open', 'open', 175000000, '2026-05-15', '2025-12-20', '334220'),
('FEMA Emergency Alert Platform', 'FEMA', 'HUBZone Set-Aside', 'open', 6200000, '2026-02-25', '2026-01-12', '541512'),
('DoE Grid Modernization Initiative', 'Department of Energy', 'Full & Open', 'open', 92000000, '2026-08-30', '2026-01-30', '237130');

-- INSURANCEINTEL
INSERT INTO public.insurance_accounts (account_name, account_type, hq_state, lines_of_business, compliance_score, am_best_rating, loss_ratio) VALUES
('Apex National Insurance', 'carrier', 'CT', 'Property, Casualty, Life', 88, 'A+', 0.61),
('Meridian Brokerage Group', 'broker', 'NY', 'Commercial Lines, Benefits', 79, NULL, NULL),
('SunCoast MGA', 'mga', 'FL', 'Specialty, E&S, Marine', 72, NULL, NULL),
('Northern Reinsurance Co', 'reinsurer', 'MA', 'Property Cat, Casualty XL', 91, 'A', 0.58),
('Pacific Rim Carriers', 'carrier', 'CA', 'Marine, Aviation, Energy', 83, 'A-', 0.64),
('Heartland P&C Insurance', 'carrier', 'OH', 'Commercial Auto, Workers Comp', 76, 'B++', 0.69),
('Premier Benefit Brokers', 'broker', 'TX', 'Health, Life, Group Benefits', 82, NULL, NULL),
('Coastal Specialty MGA', 'mga', 'SC', 'Flood, Wind, Parametric', 68, NULL, NULL),
('Transatlantic Re', 'reinsurer', 'NY', 'Global P&C, Specialty Re', 94, 'A+', 0.54),
('MidWest Agricultural Ins', 'carrier', 'IA', 'Crop, Livestock, Farm', 71, 'B+', 0.73);

-- ============================================================
-- STEP 10: FINALIZE
-- ============================================================
ANALYZE;

-- ============================================================
-- DONE. Summary:
-- ✅ 16 source tables with typed columns
-- ✅ 16 access tables with UNIQUE constraints
-- ✅ user_profiles + credit_ledger + audit_log
-- ✅ Auto-signup trigger (creates profile + 10 free credits)
-- ✅ is_admin() SECURITY DEFINER function
-- ✅ RLS on all 35 tables
-- ✅ 16 secure unlock RPCs (dedup + credit debit + audit)
-- ✅ admin_add_credits() and admin_set_role() RPCs
-- ✅ 10 seed rows per vertical (160 total demo records)
-- ✅ Indexes on all access tables + ledger
-- ============================================================
