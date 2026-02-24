-- ============================================================
-- MAKE_ADMIN.sql
-- Run this after creating your account in Supabase
-- ============================================================

-- Step 1: Find your user UUID from Supabase → Authentication → Users
-- Step 2: Replace YOUR-USER-UUID-HERE below and run

UPDATE public.user_profiles
SET role = 'admin'
WHERE id = 'YOUR-USER-UUID-HERE';

-- Add yourself 9999 credits
INSERT INTO public.credit_ledger (user_id, delta, reason)
VALUES ('YOUR-USER-UUID-HERE', 9999, 'admin_bootstrap');

-- Verify:
SELECT id, role, status FROM public.user_profiles WHERE role = 'admin';
SELECT COALESCE(SUM(delta), 0) AS balance FROM public.credit_ledger WHERE user_id = 'YOUR-USER-UUID-HERE';
