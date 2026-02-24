# VerifiedMeasure Platform V4 — Deployment Guide

## Architecture Summary
- **Tech Stack**: Next.js 14 App Router + TypeScript + Supabase + Vercel + Tailwind + Recharts
- **Auth**: `@supabase/ssr` createBrowserClient — client-side only, no middleware
- **16 Verticals**: dealflow, salesintel, supplyintel, clinicalintel, legalintel, marketresearch, academicintel, creatorintel, gamingintel, realestateintel, privatecreditintel, cyberintel, biopharmintel, industrialintel, govintel, insuranceintel
- **Landing Page**: `/login` — shows marketing landing first, then auth form

---

## Step 1 — Supabase Setup

1. Create new Supabase project at supabase.com
2. SQL Editor → Run `FULL_DATABASE_SCHEMA.sql` (from previous build)
3. Authentication → Settings → **Disable email confirmation** ✓
4. Project Settings → API → copy URL and anon key

---

## Step 2 — GitHub Setup

1. Create new repository on GitHub: `verifiedmeasure-platform`
2. Upload ALL files maintaining folder structure
3. Ensure `public/vm-logo.png` is included

---

## Step 3 — Vercel Deploy

1. Vercel → New Project → Import GitHub repo
2. **Settings → Environment Variables** — add ALL THREE environments (Production + Preview + Development):
```
NEXT_PUBLIC_SUPABASE_URL       = https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY  = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
3. Deploy → wait for build to complete

---

## Step 4 — Post-Deploy SQL

In Supabase SQL Editor, run these scripts from the `/sql` folder:

```sql
-- 1. Make yourself admin (replace UUID)
UPDATE user_profiles SET role = 'admin' WHERE id = 'YOUR-USER-UUID';

-- 2. Add yourself demo credits
INSERT INTO credit_ledger (user_id, delta, note)
VALUES ('YOUR-USER-UUID', 500, 'Admin seeding credits');
```

---

## Step 5 — Verify Deployment

Test this exact flow:
1. Go to `verifiedmeasure.com` → Landing page appears ✓
2. Click "Get Started" → Auth form appears ✓
3. Create account → redirected to `/dashboard/dealflow` ✓
4. Vertical switcher opens 4×4 grid of 16 verticals ✓
5. Select rows → UnlockBar appears ✓
6. Click Unlock → credits deducted, data revealed ✓
7. Dark mode toggle works ✓

---

## Forbidden Architecture Patterns

❌ No `middleware.ts`
❌ No `createServerClient`
❌ No `@supabase/auth-helpers-nextjs`
❌ No `cookies()` anywhere
❌ No service role key in runtime
❌ No `.env` committed to git
❌ No shared Dashboard base class

---

## File Structure

```
vm-platform/
├── app/
│   ├── layout.tsx              # Root layout — html/body only
│   ├── page.tsx                # Redirect → /login
│   ├── globals.css
│   ├── login/
│   │   └── page.tsx            # Landing + auth form (combined)
│   └── dashboard/
│       ├── layout.tsx          # AuthGuard + TopNav
│       ├── page.tsx            # Redirect → /dashboard/dealflow
│       └── [verticalKey]/
│           └── page.tsx        # Renders VerticalRenderer
├── components/
│   ├── AuthGuard.tsx           # Session check, onAuthStateChange
│   ├── TopNav.tsx              # Logo + switcher + credits + dark mode
│   ├── VerticalSwitcher.tsx    # 4×4 mega-menu popup
│   └── verticals/
│       ├── VerticalRenderer.tsx
│       ├── shared/
│       │   ├── useVerticalData.ts
│       │   ├── KPICard.tsx
│       │   ├── UnlockBar.tsx
│       │   └── Drawer.tsx
│       └── {16 vertical folders}/Dashboard.tsx
├── lib/
│   ├── supabase.ts             # createBrowserClient — ONLY file
│   ├── verticals.ts            # Config registry for 16 verticals
│   ├── auth.ts
│   ├── credits.ts
│   └── access.ts
├── public/
│   └── vm-logo.png             # VerifiedMeasure logo
└── sql/
    ├── MAKE_ADMIN.sql
    ├── DEMO_UNLOCK_ALL.sql
    └── GRANT_CLIENT_ACCESS.sql
```
