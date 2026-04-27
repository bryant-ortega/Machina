# Machina — BUILD_PLAN.md
### Claude Cowork Build Instructions for LosGothsCo Event Operations Platform

> This document is the step-by-step build guide for Claude Cowork.
> The full product spec lives in `README.md`. When in doubt, README is the source of truth for what a feature should do.
> This document defines **how and in what order to build it**.

---

## Repository Structure Note

The Next.js app lives in `/machina`.

All commands, paths, and file references in this document
should be executed relative to `/machina`, not the repo root.

```
LosGothsCo Enterprise/        (= repo root)
├── machina/                  ← Next.js app (Claude works here)
├── README.md                 ← product spec
├── BUILD_PLAN.md             ← this document
└── docs/                     ← optional later
```

---

## Critical Rules — Read Before Every Session

These rules apply at all times. Do not deviate without asking first.

1. **Build one phase at a time.** Do not start Phase 2 until Phase 1 acceptance criteria pass.
2. **Do not invent features.** If something is not in README.md or this BUILD_PLAN, do not build it.
3. **Do not rename schema tables or columns without asking.** Other phases depend on exact names.
4. **Build one route at a time.** Complete and verify each route before starting the next.
5. **After every major feature: run TypeScript check, lint, and verify with a Supabase query test.**
6. **Do not build anything in the "Do Not Build Yet" list below.**
7. **When uncertain, stop and ask.** Do not guess at business logic.
8. **All secrets go in environment variables.** Never hardcode keys, URLs, or credentials.
9. **Admin role only for MVP.** Do not implement Partner or DJ role permissions until Phase 8.
10. **Keep components small and single-purpose.** One component per file. No God components.

---

## Do Not Build Yet

These features are explicitly deferred. Do not scaffold, stub, or reference them until their phase is reached:

- ❌ PayPal Payouts API integration
- ❌ Full custom View Builder UI (drag-and-drop field picker, create/edit/delete custom views)
- ❌ Per-event view customization (`event_view_customizations` table)
- ❌ Partner role permissions and access controls
- ❌ Vendor logins
- ❌ Public share links for views
- ❌ `.ics` / webcal posting calendar export
- ❌ W-9 automated reminder cron job
- ❌ Vendor registration form
- ❌ react-pdf PDF generation
- ❌ Resend email integration

---

## MVP Scope

The first working version of Machina is complete when an Admin can:

- Log in via magic link
- View and manage the DJ roster
- Upload a W-9 for a DJ
- Create an event with named stages and DJ slot assignments
- View events in Month View and Year View
- Create and edit an estimated budget for an event
- Actualize a budget into a final budget and compare est. vs. final
- View a Run of Show generated from event data
- Export any view as a PDF

Everything else is post-MVP.

---

## Build Order Summary

| Phase | What Gets Built |
|---|---|
| 0 | Repo, Supabase project, environment, folder structure |
| 1 | Supabase schema — core tables only |
| 2 | RLS policies |
| 3 | Auth — Admin magic link login |
| 4 | Seed data |
| 5 | DJ registration form + W-9 upload |
| 6 | Admin DJ roster + DJ profile page |
| 7 | Event creation form |
| 8 | Month View + Year View |
| 9 | Estimated budget |
| 10 | Final budget + Est vs Final compare |
| 11 | Run of Show view |
| 12 | PDF export |
| 13 | Partner role |
| 14 | Override system |
| 15 | Posting Calendar view |
| 16 | DJ Analytics view |
| 17 | View Builder (custom views) |
| 18 | Payment tracking (manual mark-paid) |
| 19 | PayPal Payouts |
| 20 | Automated emails + W-9 reminders |

---

## Phase 0 — Project Setup

### Goal
A running Next.js app connected to Supabase with the correct folder structure, environment variables, and GitHub repo.

### Steps

#### 0.1 — GitHub
```bash
# Create a new GitHub repository named: machina
# Clone it locally
git clone https://github.com/YOUR_USERNAME/machina.git
cd machina
```

#### 0.2 — Next.js
```bash
npx create-next-app@latest . \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*"
```

> Note: This plan was originally written against Next.js 14, but `@latest` will
> install the current major (16.x at time of build). The Phase 0.7 client/server
> code uses the modern `await cookies()` pattern that requires Next.js 15+ —
> stay on the latest major rather than pinning back to 14.

#### 0.3 — Dependencies
```bash
npm install @supabase/supabase-js @supabase/ssr
npm install lucide-react
npm install clsx tailwind-merge
npm install zod
npm install @hookform/resolvers react-hook-form
```

> Note: `@supabase/auth-helpers-nextjs` is deprecated and intentionally NOT installed.
> All auth flows use `@supabase/ssr`, which is the supported successor and provides
> the same functionality with the modern App Router API.

#### 0.4 — Supabase Project
- Create a new Supabase project at https://supabase.com
- Project name: `machina` (or your preferred name)
- Enable RLS by default on new tables
- Save the project URL, publishable key, and secret key

> Note on key naming: Supabase has migrated from the legacy `anon` / `service_role`
> JWT keys to a new format with a clearer naming convention:
> - **Publishable key** (`sb_publishable_…`) — replaces `anon`. Browser-safe; gated by RLS.
> - **Secret key** (`sb_secret_…`) — replaces `service_role`. Server-only; bypasses RLS.
>
> Both work transparently with `@supabase/ssr`. The env var names below
> (`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) keep their
> legacy names for code-stability — only the key *values* change format.

#### 0.5 — Environment Variables
Create `.env.local` in the project root:
```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Add `.env.local` to `.gitignore` — verify it is ignored before first commit.

#### 0.6 — Folder Structure
Create the following folders exactly as shown:
```
src/
├── app/
│   ├── (admin)/
│   │   ├── events/
│   │   │   ├── new/
│   │   │   └── [id]/
│   │   │       ├── edit/
│   │   │       ├── budget/
│   │   │       └── runofshow/
│   │   ├── djs/
│   │   │   └── [id]/
│   │   └── settings/
│   ├── dj/
│   │   ├── profile/
│   │   └── upload-w9/
│   ├── register/
│   │   └── dj/
│   └── api/
│       └── storage/
│           └── signed-url/
├── components/
│   ├── ui/
│   ├── forms/
│   ├── layout/
│   └── views/
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   └── server.ts
│   └── utils.ts
├── types/
│   └── database.ts
└── middleware.ts            # Next.js requires middleware.ts at src/ root, not inside lib/
```

#### 0.7 — Supabase Client Files

`src/lib/supabase/client.ts` — browser client (uses anon key):
```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

`src/lib/supabase/server.ts` — server client (uses service role key for server actions only):
```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createServerSupabaseClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}
```

`src/middleware.ts` — session refresh and route protection:
```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options))
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Protect admin routes — return 404 (not 401) to unauthenticated users.
  // Note: `(admin)` is a Next.js route group, which means it does NOT appear
  // in the URL. Match by the actual top-level admin paths instead.
  const path = request.nextUrl.pathname
  const isAdminRoute =
    path.startsWith('/events') ||
    path.startsWith('/djs') ||
    path.startsWith('/settings')

  if (isAdminRoute && !user) {
    return NextResponse.rewrite(new URL('/not-found', request.url))
  }

  // Protect DJ routes
  if (path.startsWith('/dj') && !user) {
    return NextResponse.rewrite(new URL('/not-found', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

#### 0.8 — Initial Commit
```bash
git add .
git commit -m "Phase 0: project setup"
git push origin main
```

### Acceptance Criteria
- [ ] `npm run dev` starts without errors
- [ ] App loads at `localhost:3000`
- [ ] `.env.local` is in `.gitignore` and not committed
- [ ] Folder structure matches spec above
- [ ] Supabase project is live and accessible

---

## Phase 1 — Core Database Schema

### Goal
Create the 8 core tables needed for MVP. Do not create all tables at once — only these 8.

### Tables to Create (in this order)
1. `profiles`
2. `venues`
3. `djs`
4. `events`
5. `event_stages`
6. `event_dj_slots`
7. `event_budgets`
8. `event_budget_expenses`
9. `event_budget_income`
10. `event_tix_tiers`

Run each SQL block in the Supabase SQL editor. Verify each table exists before running the next.

---

```sql
-- 1. PROFILES
-- Auto-created for every auth.users row via trigger (see below)
CREATE TABLE profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role varchar NOT NULL CHECK (role IN ('admin', 'partner', 'dj', 'vendor')),
  display_name varchar NOT NULL,
  status varchar NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Trigger: auto-create profile on new auth user
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (user_id, role, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'role', 'dj'),
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

```sql
-- 2. VENUES
CREATE TABLE venues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar NOT NULL,
  address varchar,
  city varchar NOT NULL,
  state varchar NOT NULL
);
```

```sql
-- 3. DJS
CREATE TABLE djs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dj_name varchar NOT NULL,
  government_name varchar NOT NULL,
  phone varchar,
  email varchar UNIQUE NOT NULL,
  pay_method varchar CHECK (pay_method IN ('zelle', 'venmo', 'paypal')),
  pay_handle varchar,
  region varchar NOT NULL CHECK (region IN ('SoCal', 'NorCal', 'Chicago', 'Arizona', 'Seattle', 'Other')),
  w9_storage_path varchar,
  w9_status varchar NOT NULL DEFAULT 'pending' CHECK (w9_status IN ('pending', 'on_file')),
  rank varchar,
  registered_at timestamptz NOT NULL DEFAULT now()
);
```

```sql
-- 4. EVENTS
CREATE TABLE events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year int NOT NULL,
  date date NOT NULL,
  event_id varchar UNIQUE NOT NULL,
  weekend_number int NOT NULL CHECK (weekend_number BETWEEN 1 AND 5),
  weekend_flag varchar NOT NULL CHECK (weekend_flag IN ('good', 'warning')),
  day_of_week varchar NOT NULL,
  title varchar NOT NULL,
  type varchar NOT NULL CHECK (type IN ('club', 'concert', 'festival')),
  venue_id uuid REFERENCES venues(id),
  city varchar NOT NULL,
  state varchar NOT NULL,
  status varchar NOT NULL DEFAULT 'tentative' CHECK (status IN ('tentative', 'confirmed')),
  collab boolean NOT NULL DEFAULT false,
  stages int NOT NULL DEFAULT 1 CHECK (stages BETWEEN 1 AND 4),
  doors_time time NOT NULL,
  end_time time NOT NULL,
  capacity int CHECK (capacity > 0),
  guarantee boolean DEFAULT false,
  bar_included boolean DEFAULT false,
  rent numeric CHECK (rent >= 0),
  split_pct numeric CHECK (split_pct BETWEEN 0 AND 100),
  venue_tix_fee numeric CHECK (venue_tix_fee >= 0),
  advance_contact_email varchar,
  advance_contact_phone varchar,
  announce_date date,
  begin_art_date date,
  art_due_date date,
  on_sale_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES profiles(id)
);
```

```sql
-- 5. EVENT_STAGES
CREATE TABLE event_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  stage_number int NOT NULL CHECK (stage_number BETWEEN 1 AND 4),
  stage_name varchar NOT NULL,
  UNIQUE (event_id, stage_number)
);
```

```sql
-- 6. EVENT_DJ_SLOTS
CREATE TABLE event_dj_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  stage_id uuid NOT NULL REFERENCES event_stages(id) ON DELETE CASCADE,
  slot_order int NOT NULL CHECK (slot_order BETWEEN 1 AND 6),
  dj_id uuid NOT NULL REFERENCES djs(id),
  slot_type varchar NOT NULL CHECK (slot_type IN ('open', 'support_1', 'support_2', 'main_support', 'headline', 'close')),
  rate numeric CHECK (rate >= 0),
  start_time time,
  end_time time,
  UNIQUE (event_id, stage_id, slot_order)
);
```

```sql
-- 7. EVENT_BUDGETS
CREATE TABLE event_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  budget_type varchar NOT NULL CHECK (budget_type IN ('estimated', 'final')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES profiles(id),
  UNIQUE (event_id, budget_type)
);
```

```sql
-- 8. EVENT_BUDGET_EXPENSES
CREATE TABLE event_budget_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id uuid NOT NULL REFERENCES event_budgets(id) ON DELETE CASCADE,
  category varchar NOT NULL CHECK (category IN ('digital', 'consumables', 'travel', 'transportation', 'vendors', 'staff', 'djs')),
  item varchar NOT NULL,
  qty numeric NOT NULL DEFAULT 1 CHECK (qty > 0),
  price numeric NOT NULL DEFAULT 0 CHECK (price >= 0),
  total numeric GENERATED ALWAYS AS (qty * price) STORED,
  payment_status varchar NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partial', 'paid')),
  payment_method varchar CHECK (payment_method IN ('paypal', 'zelle', 'venmo', 'other')),
  payee_type varchar CHECK (payee_type IN ('dj', 'vendor', 'other')),
  payee_id uuid
);
```

```sql
-- 9. EVENT_BUDGET_INCOME
CREATE TABLE event_budget_income (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id uuid NOT NULL REFERENCES event_budgets(id) ON DELETE CASCADE,
  income_type varchar NOT NULL CHECK (income_type IN ('tickets', 'bar', 'merch', 'sponsor', 'vendor')),
  label varchar NOT NULL,
  value numeric NOT NULL DEFAULT 0 CHECK (value >= 0)
);
```

```sql
-- 10. EVENT_TIX_TIERS
CREATE TABLE event_tix_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id uuid NOT NULL REFERENCES event_budgets(id) ON DELETE CASCADE,
  tier_number int NOT NULL CHECK (tier_number BETWEEN 1 AND 8),
  price numeric NOT NULL DEFAULT 0 CHECK (price >= 0),
  sold int NOT NULL DEFAULT 0 CHECK (sold >= 0),
  total numeric GENERATED ALWAYS AS (sold * price) STORED,
  UNIQUE (budget_id, tier_number)
);
```

### Acceptance Criteria
- [ ] All 10 tables exist in Supabase table editor
- [ ] All constraints visible in Supabase (PKs, FKs, CHECKs, UNIQUEs)
- [ ] Trigger `on_auth_user_created` exists and is enabled
- [ ] No errors in Supabase SQL editor on any block

---

## Phase 2 — Row-Level Security (RLS)

### Goal
Enable RLS on all tables and add policies. MVP only needs Admin access — DJ policies are added in Phase 5.

```sql
-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE djs ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_dj_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_budget_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_budget_income ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_tix_tiers ENABLE ROW LEVEL SECURITY;
```

```sql
-- Helper function: get current user's role
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS varchar AS $$
  SELECT role FROM profiles WHERE user_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```

```sql
-- PROFILES: users can read their own; admins can read all
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "profiles_select_admin" ON profiles
  FOR SELECT USING (get_my_role() = 'admin');

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (user_id = auth.uid());
```

```sql
-- VENUES: admins full access; all authenticated users can read
CREATE POLICY "venues_select_authenticated" ON venues
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "venues_insert_admin" ON venues
  FOR INSERT WITH CHECK (get_my_role() = 'admin');

CREATE POLICY "venues_update_admin" ON venues
  FOR UPDATE USING (get_my_role() = 'admin');

CREATE POLICY "venues_delete_admin" ON venues
  FOR DELETE USING (get_my_role() = 'admin');
```

```sql
-- DJS: admins full access; DJs can read/update their own row
CREATE POLICY "djs_select_admin" ON djs
  FOR SELECT USING (get_my_role() = 'admin');

CREATE POLICY "djs_select_own" ON djs
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "djs_insert_own" ON djs
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "djs_update_admin" ON djs
  FOR UPDATE USING (get_my_role() = 'admin');

CREATE POLICY "djs_update_own_w9" ON djs
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "djs_delete_admin" ON djs
  FOR DELETE USING (get_my_role() = 'admin');
```

```sql
-- EVENTS: admins full access
CREATE POLICY "events_all_admin" ON events
  FOR ALL USING (get_my_role() = 'admin');
```

```sql
-- EVENT_STAGES: admins full access
CREATE POLICY "event_stages_all_admin" ON event_stages
  FOR ALL USING (get_my_role() = 'admin');
```

```sql
-- EVENT_DJ_SLOTS: admins full access
CREATE POLICY "event_dj_slots_all_admin" ON event_dj_slots
  FOR ALL USING (get_my_role() = 'admin');
```

```sql
-- EVENT_BUDGETS: admins full access
CREATE POLICY "event_budgets_all_admin" ON event_budgets
  FOR ALL USING (get_my_role() = 'admin');
```

```sql
-- EVENT_BUDGET_EXPENSES: admins full access
CREATE POLICY "event_budget_expenses_all_admin" ON event_budget_expenses
  FOR ALL USING (get_my_role() = 'admin');
```

```sql
-- EVENT_BUDGET_INCOME: admins full access
CREATE POLICY "event_budget_income_all_admin" ON event_budget_income
  FOR ALL USING (get_my_role() = 'admin');
```

```sql
-- EVENT_TIX_TIERS: admins full access
CREATE POLICY "event_tix_tiers_all_admin" ON event_tix_tiers
  FOR ALL USING (get_my_role() = 'admin');
```

### Acceptance Criteria
- [ ] RLS is enabled on all 10 tables (green shield icon in Supabase)
- [ ] `get_my_role()` function exists in Supabase
- [ ] All policies visible in Supabase Authentication → Policies
- [ ] Unauthenticated query to `events` returns 0 rows (not an error, just empty — RLS working)

---

## Phase 3 — Admin Auth

### Goal
Admin can log in via magic link. Unauthenticated users hitting admin routes get a 404.

### Steps

#### 3.1 — Create Admin User in Supabase
In Supabase Dashboard → Authentication → Users → Invite User:
- Enter admin email
- After invite, manually update their `profiles` row: set `role = 'admin'`

#### 3.2 — Login Page
Create `src/app/login/page.tsx`:
- Single email input field
- "Send Magic Link" button
- On submit: calls `supabase.auth.signInWithOtp({ email })`
- Success state: "Check your email for a login link"
- No password field — magic link only

#### 3.3 — Auth Callback Route
Create `src/app/auth/callback/route.ts`:
- Handles the magic link redirect from Supabase
- Exchanges code for session
- Redirects to `/(admin)/events` on success

#### 3.4 — Verify Middleware
Confirm middleware from Phase 0 is redirecting unauthenticated users on admin routes to `/not-found`.

#### 3.5 — Basic Admin Shell
Create `src/app/(admin)/layout.tsx`:
- Simple sidebar with nav links: Events, DJs, Settings
- Shows logged-in user's display name
- Sign out button that calls `supabase.auth.signOut()`

### Acceptance Criteria
- [ ] Admin receives magic link email on submit
- [ ] Clicking magic link logs in and redirects to `/(admin)/events`
- [ ] Visiting `/(admin)/events` while logged out shows 404
- [ ] Sign out clears session and redirects to `/login`
- [ ] Admin name shows in sidebar

---

## Phase 4 — Seed Data

### Goal
Populate the database with real reference data so all subsequent phases can be built and tested against actual records.

Run in Supabase SQL editor after Phase 3 is complete (admin must exist in `profiles` first — replace `ADMIN_PROFILE_ID` with the actual UUID from your profiles table).

```sql
-- VENUES
INSERT INTO venues (id, name, address, city, state) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'The Regent', '448 S Main St', 'Los Angeles', 'CA'),
  ('a1000000-0000-0000-0000-000000000002', 'Music Box', '1337 India St', 'San Diego', 'CA'),
  ('a1000000-0000-0000-0000-000000000003', 'DNA Lounge', '375 11th St', 'San Francisco', 'CA'),
  ('a1000000-0000-0000-0000-000000000004', 'Harlow''s', '2708 J St', 'Sacramento', 'CA'),
  ('a1000000-0000-0000-0000-000000000005', 'Irving Plaza', '17 Irving Pl', 'New York', 'NY');
```

```sql
-- NOTE: DJs require auth.users rows to exist first (due to FK constraint).
-- For seed data purposes, create placeholder auth users in Supabase Dashboard
-- → Authentication → Users → Add User for each DJ below,
-- then run this insert replacing each USER_ID with the actual auth.users UUID.

-- This is a template — fill in real UUIDs after creating auth users:
INSERT INTO djs (id, user_id, dj_name, government_name, email, region, w9_status, rank) VALUES
  ('b1000000-0000-0000-0000-000000000001', 'REPLACE_WITH_AUTH_UUID', 'Chat Noir', 'Seed Record', 'chatnoir@seed.dev', 'SoCal', 'pending', 'headliner'),
  ('b1000000-0000-0000-0000-000000000002', 'REPLACE_WITH_AUTH_UUID', 'Sizzle', 'Seed Record', 'sizzle@seed.dev', 'SoCal', 'pending', 'headliner'),
  ('b1000000-0000-0000-0000-000000000003', 'REPLACE_WITH_AUTH_UUID', 'PALOMO', 'Seed Record', 'palomo@seed.dev', 'SoCal', 'pending', 'headliner'),
  ('b1000000-0000-0000-0000-000000000004', 'REPLACE_WITH_AUTH_UUID', 'Jinx', 'Seed Record', 'jinx@seed.dev', 'SoCal', 'on_file', 'main_support'),
  ('b1000000-0000-0000-0000-000000000005', 'REPLACE_WITH_AUTH_UUID', 'SoulCab', 'Seed Record', 'soulcab@seed.dev', 'SoCal', 'pending', 'main_support'),
  ('b1000000-0000-0000-0000-000000000006', 'REPLACE_WITH_AUTH_UUID', 'Sulkform', 'Seed Record', 'sulkform@seed.dev', 'SoCal', 'on_file', 'support'),
  ('b1000000-0000-0000-0000-000000000007', 'REPLACE_WITH_AUTH_UUID', 'ValleyGhoul', 'Seed Record', 'valleyghoul@seed.dev', 'NorCal', 'pending', 'support'),
  ('b1000000-0000-0000-0000-000000000008', 'REPLACE_WITH_AUTH_UUID', 'LosGothsCo. DJs', 'Internal House', 'lgco.djs@losgoths.co', 'SoCal', 'on_file', 'open');
```

```sql
-- EVENTS (2 seed events)
INSERT INTO events (
  id, year, date, event_id, weekend_number, weekend_flag,
  day_of_week, title, type, venue_id, city, state, status,
  stages, doors_time, end_time, capacity, bar_included,
  split_pct, created_by
) VALUES
(
  'c1000000-0000-0000-0000-000000000001',
  2026, '2026-04-25', '20260425-LA', 4, 'good',
  'Saturday', 'Gothicumbia Spring Los Angeles', 'club',
  'a1000000-0000-0000-0000-000000000001',
  'Los Angeles', 'CA', 'confirmed',
  1, '21:00', '02:00', 1200, true, 70,
  'REPLACE_WITH_ADMIN_PROFILE_ID'
),
(
  'c1000000-0000-0000-0000-000000000002',
  2026, '2026-04-11', '20260411-SD', 2, 'good',
  'Saturday', 'Gothicumbia Spring San Diego', 'club',
  'a1000000-0000-0000-0000-000000000002',
  'San Diego', 'CA', 'confirmed',
  1, '21:00', '02:00', 600, true, 70,
  'REPLACE_WITH_ADMIN_PROFILE_ID'
);
```

```sql
-- STAGES for seed events
INSERT INTO event_stages (id, event_id, stage_number, stage_name) VALUES
  ('d1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 1, 'Main Stage'),
  ('d1000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000002', 1, 'Main Stage');
```

```sql
-- DJ SLOTS for Gothicumbia Spring LA
-- AMOR DE PARIS (opener), 1201770 (support), El Selector (main support), HI-C (headline), SoulCab (close)
-- Using seed DJs as stand-ins for DJs not in seed set
INSERT INTO event_dj_slots (event_id, stage_id, slot_order, dj_id, slot_type, rate) VALUES
  ('c1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 1, 'b1000000-0000-0000-0000-000000000008', 'open', 0),
  ('c1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 2, 'b1000000-0000-0000-0000-000000000006', 'support_1', 150),
  ('c1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 3, 'b1000000-0000-0000-0000-000000000005', 'main_support', 300),
  ('c1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 4, 'b1000000-0000-0000-0000-000000000002', 'headline', 800),
  ('c1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 5, 'b1000000-0000-0000-0000-000000000005', 'close', 200);
```

```sql
-- ESTIMATED BUDGET for Gothicumbia Spring LA
INSERT INTO event_budgets (id, event_id, budget_type, created_by) VALUES
  ('e1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'estimated', 'REPLACE_WITH_ADMIN_PROFILE_ID');

INSERT INTO event_budget_expenses (budget_id, category, item, qty, price) VALUES
  ('e1000000-0000-0000-0000-000000000001', 'djs', 'Opener', 1, 0),
  ('e1000000-0000-0000-0000-000000000001', 'djs', 'Support 1', 1, 150),
  ('e1000000-0000-0000-0000-000000000001', 'djs', 'Main Support', 1, 300),
  ('e1000000-0000-0000-0000-000000000001', 'djs', 'Headliner', 1, 800),
  ('e1000000-0000-0000-0000-000000000001', 'djs', 'Closer', 1, 200),
  ('e1000000-0000-0000-0000-000000000001', 'digital', 'Flyer', 1, 150),
  ('e1000000-0000-0000-0000-000000000001', 'digital', 'IG Ads', 1, 200),
  ('e1000000-0000-0000-0000-000000000001', 'consumables', 'Balloons', 1, 80),
  ('e1000000-0000-0000-0000-000000000001', 'consumables', 'Helium Tank', 1, 120),
  ('e1000000-0000-0000-0000-000000000001', 'consumables', 'Glow Sticks', 1, 60),
  ('e1000000-0000-0000-0000-000000000001', 'consumables', 'Fog Juice', 1, 40),
  ('e1000000-0000-0000-0000-000000000001', 'consumables', 'Distilled Water', 1, 10),
  ('e1000000-0000-0000-0000-000000000001', 'staff', 'Production Manager', 1, 300),
  ('e1000000-0000-0000-0000-000000000001', 'staff', 'Photographer 1', 1, 200);

INSERT INTO event_tix_tiers (budget_id, tier_number, price, sold) VALUES
  ('e1000000-0000-0000-0000-000000000001', 1, 15, 200),
  ('e1000000-0000-0000-0000-000000000001', 2, 20, 300),
  ('e1000000-0000-0000-0000-000000000001', 3, 25, 150);
```

### Acceptance Criteria
- [ ] 5 venues visible in Supabase table editor
- [ ] 8 DJs visible in `djs` table
- [ ] 2 events visible in `events` table
- [ ] 2 stages, 5 DJ slots visible
- [ ] 1 estimated budget with expense lines and tix tiers visible
- [ ] Admin can query all seed data via Supabase SQL editor

---

## Phase 5 — DJ Registration + W-9 Upload

### Goal
Public DJ registration form with magic link flow. Authenticated W-9 upload page.

### Routes to Build
- `GET/POST /register/dj` — public registration form
- `GET/POST /dj/upload-w9` — authenticated W-9 upload (DJ role)
- `GET /dj/profile` — DJ's own profile view

### Implementation Notes
- Form validation with `zod` + `react-hook-form`
- On submit: call `supabase.auth.signInWithOtp({ email, options: { data: { role: 'dj', display_name: dj_name } } })`
- The trigger from Phase 1 creates the `profiles` row automatically
- After magic link verification, insert into `djs` table using the authenticated user's `auth.uid()`
- W-9 upload: accept PDF only, max 10MB, validate server-side
- Store to Supabase Storage path: `w9s/{user_id}/w9.pdf`
- Save path to `djs.w9_storage_path`; set `w9_status = 'on_file'`
- Duplicate email: show "already registered" message, do not create account

### Storage Setup (Supabase Dashboard)
- Create a new Storage bucket named `w9s`
- Set bucket to **Private**
- Add policy: authenticated users can upload to their own path only:
```sql
CREATE POLICY "w9_upload_own" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'w9s' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "w9_read_admin" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'w9s' AND
    get_my_role() = 'admin'
  );
```

### Signed URL API Route
Create `src/app/api/storage/signed-url/route.ts`:
- Accepts `storagePath` in request body
- Uses `service_role` key server-side to generate signed URL (60 min expiry)
- Returns signed URL to client
- Never expose `service_role` key to client — this route is the only way to get a signed URL

### Acceptance Criteria
- [ ] DJ can submit registration form
- [ ] Magic link email arrives
- [ ] After verification, DJ row exists in `djs` table
- [ ] DJ can log in to `/dj/upload-w9` and upload a PDF
- [ ] `w9_storage_path` populated; `w9_status` flips to `on_file`
- [ ] W-9 file is private — direct URL returns error
- [ ] Signed URL API route returns working URL that expires
- [ ] Duplicate email shows "already registered" message

---

## Phase 6 — Admin DJ Roster + DJ Profile

### Goal
Admin can view all DJs, see W-9 status, and edit any DJ's record.

### Routes to Build
- `GET /(admin)/djs` — DJ roster page
- `GET /(admin)/djs/[id]` — DJ profile (admin editable)

### Implementation Notes
- Roster: sorted A–Z by `dj_name`
- W-9 status badge: ✅ On File (green) / ⚠ Pending (amber)
- Alert banner at top of roster if any DJ has `w9_status = 'pending'`
- DJ profile: all fields editable by admin; save triggers audit log entry
- W-9 download: call signed URL API route → open URL in new tab
- Booking history: query `event_dj_slots` joined with `events` for this DJ
- Region filter in roster sidebar

### Acceptance Criteria
- [ ] Roster shows all DJs sorted A–Z
- [ ] W-9 status badges correct for seed data (Jinx and Sulkform show ✅; others show ⚠)
- [ ] Alert banner shows when pending DJs exist
- [ ] Admin can edit DJ fields and save
- [ ] W-9 download works via signed URL
- [ ] Booking history shows correct events for seed DJs

---

## Phase 7 — Event Creation Form

### Goal
Admin can create a new event with all fields from the spec. Estimated budget is auto-created on save.

### Route to Build
- `GET/POST /(admin)/events/new`
- `GET/POST /(admin)/events/[id]/edit`

### Implementation Notes

**Date field auto-derives:**
- `year` — `date.getFullYear()`
- `day_of_week` — `date.toLocaleDateString('en-US', { weekday: 'long' })`
- `weekend_number` — which occurrence of that day in the month (1st Sat, 2nd Sat, etc.)
- `weekend_flag`:
  - `good` if `weekend_number` is 2, 3, 4 (for months with 4 weekends) or 2, 3, 4 for 5-weekend months
  - `warning` if `weekend_number` is 1 or last of month
- `event_id` — `YYYYMMDD-CITYCODE` (first 2 letters of city, uppercase)

**Auto-calculated dates (by event type):**

| Type | Announce | Begin Art | Art Due | On Sale |
|---|---|---|---|---|
| club | date − 21 days | announce + 2 days | announce + 9 days | announce + 1 day |
| concert | date − 42 days | announce + 3 days | announce + 14 days | announce + 2 days |
| festival | date − 90 days | announce + 5 days | announce + 21 days | announce + 3 days |

All auto-calculated dates are editable (override system comes in Phase 14 — for now just make fields editable).

**Venue field:**
- Autocomplete from `venues` table
- Nullable — can be left blank
- "+ Add Venue" inline option opens a small modal to add a new venue

**DJ slot assignment:**
- Alphabetical dropdown populated from `djs` table sorted by `dj_name`
- Slot type dropdown: open, support_1, support_2, main_support, headline, close
- Rate field: auto-populated based on slot type (hardcoded defaults for now — override system in Phase 14)

**Default rates by slot type (editable):**
| Slot Type | Default Rate |
|---|---|
| open | $0 |
| support_1 | $150 |
| support_2 | $200 |
| main_support | $350 |
| headline | $800 |
| close | $200 |

**On save:**
- Insert into `events`
- Insert into `event_stages` for each stage
- Insert into `event_dj_slots` for each slot
- Auto-create `event_budgets` row with `budget_type = 'estimated'`
- Auto-populate `event_budget_expenses` with default line items (all at qty=1, price=0 except DJ rates)

### Autocomplete Fields
Use `datalist` HTML element or a simple dropdown component for:
- City (distinct cities from `events`)
- Venue name (from `venues` table)
- Stage names (distinct names from `event_stages`)

### Acceptance Criteria
- [ ] Admin can fill out and submit the event form
- [ ] All derived fields (year, day_of_week, weekend_number, weekend_flag, event_id) are correct
- [ ] Auto-calculated dates are correct for each event type
- [ ] Venue autocomplete works; new venue can be added inline
- [ ] Stages and DJ slots save correctly
- [ ] Estimated budget is auto-created with default expense lines
- [ ] Event appears in Supabase `events` table after save
- [ ] Edit form pre-populates all fields from saved event

---

## Phase 8 — Month View + Year View

### Goal
Admin can see all events in a monthly and yearly calendar layout.

### Routes to Build
- `GET /(admin)/views/month` — Month View
- `GET /(admin)/views/year` — Year View

### Month View
- Month + year selector (dropdowns)
- Toggle: confirmed events only
- Events ordered by `weekend_number` then `date`
- Columns: Date, Day, Title, Venue, City, State, Status
- Status shown as badge: Confirmed (green) / Tentative (amber)
- Each row links to event detail / edit

### Year View
- Year selector
- Toggle: confirmed events only
- Grouped by month (Jan → Dec)
- Same columns as Month View within each month group

### Acceptance Criteria
- [ ] Month View shows seed events in correct order
- [ ] Year View groups events by month correctly
- [ ] Confirmed toggle filters correctly
- [ ] Year selector changes data
- [ ] Clicking an event row navigates to edit page

---

## Phase 9 — Estimated Budget View

### Goal
Admin can view and edit the estimated budget for any event.

### Route to Build
- `GET/POST /(admin)/events/[id]/budget`

### Implementation Notes

**Layout sections:**
1. Expenses table (category grouped, editable qty + price, computed total)
2. Ticket Tiers table (tier number, price, sold, computed total)
3. Income summary (auto-calculated from tix tiers + bar + merch)
4. Summary totals

**Income calculations (all editable via override — Phase 14):**
- `gross_tix_sold` = sum of all tier `sold`
- `paid_attendance` = gross_tix_sold − drop_off (default 0)
- `total_attendance` = paid_attendance + guests (default 0)
- `gross_tix_total` = sum of all tier `total`
- `losgothsco_tix_net` = gross_tix_total × (split_pct / 100)
- Bar (if `bar_included`):
  - `bar_gross` = paid_attendance × 24
  - `losgothsco_bar` = bar_gross × 0.16
- Merch:
  - `merch_gross` = paid_attendance × 0.36
  - `merch_net_after_fees` = merch_gross × 0.97
  - `merch_cogs` = merch_gross × 0.35
  - `merch_seller_fee` = 120
  - `net_merch` = merch_net_after_fees − merch_cogs − merch_seller_fee
- `walkout` = losgothsco_tix_net + losgothsco_bar − deductions (default 0)
- `est_income` = walkout + net_merch + sponsor_income + vendor_income
- `est_expenses` = sum of all expense line totals
- `est_profit` = est_income − est_expenses

**Defaults:**
| Field | Default |
|---|---|
| Paid attendance | 500 |
| Bar per-head | $24 |
| LosGothsCo bar % | 16% |
| Merch per-head | $0.36 |
| Merch seller fee | $120 |
| Drop-off | 0 |
| Guests | 0 |
| Deductions | $0 |

### Acceptance Criteria
- [ ] Budget view loads for seed event
- [ ] All expense lines show with editable qty and price
- [ ] Totals compute correctly
- [ ] Ticket tiers show and compute correctly
- [ ] All income calculations are correct
- [ ] Editing a line item saves to database

---

## Phase 10 — Final Budget + Compare View

### Goal
Admin can actualize a budget after an event and compare est. vs. final side by side.

### Implementation Notes
- **Actualize Event** button on the budget page
- Creates a new `event_budgets` row with `budget_type = 'final'`
- Pre-populates all `event_budget_expenses` and `event_tix_tiers` by copying from the estimated budget
- Admin edits actuals line by line
- Toggle at top of budget page: **Est.** / **Final** / **Compare**
- Compare mode: three columns per line — Est., Final, Δ Variance (Final − Est.)
- Positive variance = came in under estimate (green)
- Negative variance = went over estimate (red)

### Acceptance Criteria
- [ ] Actualize button creates final budget pre-populated from estimated
- [ ] Est. / Final / Compare toggle works
- [ ] Compare view shows correct variance per line
- [ ] Variance colors correct (green under, red over)
- [ ] Cannot create a second estimated or final budget for the same event (UNIQUE constraint enforced)

---

## Phase 11 — Run of Show View

### Goal
Auto-generated schedule per stage from DOORS and END times.

### Route to Build
- `GET /(admin)/events/[id]/runofshow`

### Schedule Calculation

For each stage, generate schedule rows in this order:

| Row | Time Calculation |
|---|---|
| LosGothsCo Load-In | doors − 180 min |
| DJs Load-In | doors − 90 min |
| Soundcheck Start | doors − 60 min |
| Soundcheck End | doors − 10 min |
| **Doors** | doors |
| Opener | doors |
| Support 1 | doors + 60 min (only if slot exists) |
| Support 2 | doors + 120 min (only if slot exists) |
| Main Support | end − 180 min (only if slot exists) |
| Headliner | end − 120 min (only if slot exists) |
| Closer | end − 60 min (only if slot exists) |
| End / Load-Out | end |
| LosGothsCo Out | end + 30 min |

- Show DJ name next to their slot row
- Only show slot rows where a DJ is actually booked for that slot type
- If event has multiple stages, show each stage as a separate column or section

### Acceptance Criteria
- [ ] Run of Show loads for seed event
- [ ] All times calculate correctly from seed event doors (21:00) and end (02:00)
- [ ] DJ names appear on correct rows
- [ ] Only booked slot types appear (no empty rows for unbooked slots)
- [ ] Doors row appears between Soundcheck End and Opener

---

## Phase 12 — PDF Export

### Goal
Any system view can be exported as a PDF.

### Dependencies to Install
```bash
npm install @react-pdf/renderer
```

### Implementation Notes
- Create PDF template components in `src/components/pdf-templates/`
- One template per view type: `RunOfShowPDF`, `BudgetPDF`, `MonthViewPDF`
- PDF generation runs server-side in an API route
- Client requests PDF via `GET /api/pdf?view=runofshow&eventId=xxx`
- API route renders the PDF component to a buffer and returns it with `Content-Type: application/pdf`
- "Export PDF" button on each view triggers the download

### Templates to Build (in order)
1. `RunOfShowPDF` — schedule table with LosGothsCo branding
2. `BudgetPDF` — expenses, income, summary, and partner split
3. `MonthViewPDF` — event list for the selected month

### Acceptance Criteria
- [ ] Export PDF button on Run of Show downloads a PDF
- [ ] Export PDF button on Budget downloads a PDF
- [ ] Export PDF button on Month View downloads a PDF
- [ ] PDFs render correctly with all data
- [ ] PDF generation is server-side only

---

## Phase 13 — Partner Role

### Goal
Partner user can log in and access all views with read/write on operational data. Cannot delete, manage team, or trigger payments.

### Implementation Notes
- Invite partner via Supabase Dashboard → manually set `profiles.role = 'partner'`
- Update RLS policies to add partner access alongside admin:
  - Read: events, djs, venues, budgets, views
  - Write: events (no delete), event stages, DJ slots, budget expenses/income
  - No access: team settings, payment triggers, partner split configuration
- Update middleware to allow partner role on admin routes
- UI: hide Delete buttons, Payment buttons, and Settings nav items for partner role
- Partner sees own profit split on budget view only

### Acceptance Criteria
- [ ] Partner can log in and see all events and views
- [ ] Partner can create and edit events
- [ ] Partner cannot delete events (button hidden + RLS blocks it)
- [ ] Partner cannot access `/settings/team` or `/settings/partners`
- [ ] Partner sees own profit split % on budget view

---

## Phase 14 — Override System

### Goal
Any auto-calculated field can be overridden per event. Override is logged and reversible.

### Tables to Add
```sql
CREATE TABLE event_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  field_key varchar NOT NULL,
  original_value jsonb NOT NULL,
  override_value jsonb NOT NULL,
  override_reason varchar,
  overridden_by uuid NOT NULL REFERENCES profiles(id),
  overridden_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, field_key)
);

ALTER TABLE event_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "overrides_all_admin" ON event_overrides
  FOR ALL USING (get_my_role() = 'admin');
```

### UI Pattern
- Auto-calculated fields show a small **⚙ Auto** badge
- Clicking badge opens an inline input with optional reason field
- On save: write to `event_overrides`; field now shows **✏ Override** badge
- Clicking Override badge shows history + **Revert to Auto** button
- Revert deletes the `event_overrides` row

### Fields That Support Overrides
DJ rates, soundcheck times, run of show slot times, announce/art/on-sale dates, bar per-head, bar %, merch per-head, merch seller fee, paid attendance, deductions, sponsor income, vendor income.

### Acceptance Criteria
- [ ] ⚙ Auto badge shows on all calculated fields
- [ ] Clicking badge opens override input
- [ ] Override saves to `event_overrides` table
- [ ] ✏ Override badge shows after save
- [ ] Revert works and deletes override row
- [ ] Overridden value is used in all calculations

---

## Phase 15 — Posting Calendar

### Goal
All event action dates displayed in a calendar/list view.

### Route to Build
- `GET /(admin)/views/posting-calendar`

### Implementation Notes
- Query all events and their announce, on_sale, begin_art, art_due dates
- Display as a list grouped by date
- Each entry shows: date, event title, action type (e.g. "Art Due")
- Month + year filter
- Status filter (confirmed / tentative / all)

### Acceptance Criteria
- [ ] Posting calendar shows all action dates for seed events
- [ ] Dates are correct based on seed event data
- [ ] Month filter works
- [ ] Status filter works

---

## Phase 16 — DJ Analytics View

### Goal
Show booking stats for all DJs.

### Route to Build
- `GET /(admin)/views/dj-analytics`

### Implementation Notes
- Query all DJs
- For each DJ: count of events in `event_dj_slots` joined with `events`
- Confirmed event %: confirmed events / total events × 100
- Year selector filters to that calendar year
- Sort by event count descending by default

### Acceptance Criteria
- [ ] All DJs listed with event count and confirmed %
- [ ] Counts correct for seed data
- [ ] Year selector changes data
- [ ] Sort works

---

## Phase 17 — View Builder

### Goal
Admin can create, edit, and manage custom views without touching code.

### Tables to Add
```sql
CREATE TABLE views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar NOT NULL,
  description varchar,
  audience varchar NOT NULL CHECK (audience IN ('internal', 'designer', 'venue', 'dj', 'partner', 'other')),
  is_system boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE view_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  view_id uuid NOT NULL REFERENCES views(id) ON DELETE CASCADE,
  field_key varchar NOT NULL,
  label varchar NOT NULL,
  position int NOT NULL CHECK (position >= 0),
  visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (view_id, field_key)
);

CREATE TABLE event_view_customizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  view_id uuid NOT NULL REFERENCES views(id) ON DELETE CASCADE,
  field_key varchar NOT NULL,
  visible boolean,
  label varchar,
  position int CHECK (position >= 0),
  created_by uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, view_id, field_key)
);

ALTER TABLE views ENABLE ROW LEVEL SECURITY;
ALTER TABLE view_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_view_customizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "views_all_admin" ON views FOR ALL USING (get_my_role() = 'admin');
CREATE POLICY "view_fields_all_admin" ON view_fields FOR ALL USING (get_my_role() = 'admin');
CREATE POLICY "customizations_all_admin" ON event_view_customizations FOR ALL USING (get_my_role() = 'admin');
```

### Implementation Notes
- Build only after all system views (Phases 8–16) are working
- Field Picker: categorized list of all available `field_key` values
- Drag-to-reorder using a library (e.g. `@dnd-kit/core`)
- System views seeded into `views` table with `is_system = true`
- Per-event customization: "Customize for This Event" button on any view

### Acceptance Criteria
- [ ] Admin can create a new custom view
- [ ] Field Picker shows all available fields by category
- [ ] Fields can be reordered by drag
- [ ] Fields can be toggled visible/hidden
- [ ] Field labels can be renamed per view
- [ ] Custom view renders with selected fields
- [ ] Per-event customization saves and shows Customized badge
- [ ] Reset to Default removes customization

---

## Phase 18 — Payment Tracking (Manual)

### Goal
Admin can mark any expense as paid, partial, or unpaid with a payment record.

### Tables to Add
```sql
CREATE TABLE expense_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id uuid NOT NULL REFERENCES event_budget_expenses(id) ON DELETE CASCADE,
  payment_method varchar NOT NULL CHECK (payment_method IN ('paypal', 'zelle', 'venmo', 'other')),
  amount numeric NOT NULL CHECK (amount > 0),
  paypal_transaction_id varchar,
  paypal_batch_id varchar,
  paid_at timestamptz NOT NULL DEFAULT now(),
  paid_by uuid NOT NULL REFERENCES profiles(id),
  note varchar,
  status varchar NOT NULL CHECK (status IN ('pending', 'confirmed', 'failed'))
);

ALTER TABLE expense_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payments_all_admin" ON expense_payments FOR ALL USING (get_my_role() = 'admin');
```

### Implementation Notes
- Mark as Paid modal: method, amount, date, optional note
- Server validates cumulative payments do not exceed expense total before writing
- Payment history panel per expense line
- `/events/[id]/payments` summary page
- Payment status updates `event_budget_expenses.payment_status`

### Acceptance Criteria
- [ ] Admin can mark an expense as paid
- [ ] Payment record saves to `expense_payments`
- [ ] Expense status updates to `paid` or `partial`
- [ ] Overage validation blocks payments exceeding expense total
- [ ] Payment history shows all records for an expense line
- [ ] Payment summary page shows totals by status

---

## Phase 19 — PayPal Payouts

### Goal
Admin can send payments to DJs and vendors with PayPal handles directly from the app.

### Pre-requisites
- PayPal Business account created
- PayPal Payouts API access approved (apply at developer.paypal.com)
- PayPal client ID and secret added to Vercel environment variables

### Environment Variables to Add
```
PAYPAL_CLIENT_ID=your-paypal-client-id
PAYPAL_CLIENT_SECRET=your-paypal-client-secret
PAYPAL_MODE=sandbox  # change to 'live' when ready
```

### Implementation Notes
- All PayPal API calls are server-side only in `/api/payments/paypal/`
- Never expose PayPal credentials to the client
- Payout flow: confirm modal → server calls PayPal Payouts API → response updates expense record
- On failure: log to `expense_payments` with `status: failed`; show error to admin

### Acceptance Criteria
- [ ] Pay via PayPal button appears on expense lines with PayPal payees
- [ ] Confirmation modal shows payee name, handle, and amount
- [ ] Sandbox payout succeeds and expense updates to paid
- [ ] Failed payout shows error and leaves expense unpaid
- [ ] PayPal transaction ID saved to `expense_payments`

---

## Phase 20 — Automated Emails + W-9 Reminders

### Goal
Registration confirmation emails and weekly W-9 reminders.

### Tables to Add
```sql
CREATE TABLE w9_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dj_id uuid UNIQUE NOT NULL REFERENCES djs(id) ON DELETE CASCADE,
  last_sent_at timestamptz,
  reminder_count int NOT NULL DEFAULT 0 CHECK (reminder_count >= 0),
  stopped_at timestamptz
);

ALTER TABLE w9_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "w9_reminders_admin" ON w9_reminders FOR ALL USING (get_my_role() = 'admin');
```

### Environment Variables to Add
```
RESEND_API_KEY=your-resend-api-key
```

### Implementation Notes
- Install Resend: `npm install resend`
- Registration confirmation: trigger after magic link verified + DJ row created
- W-9 reminder: Vercel Cron at `src/app/api/cron/w9-reminders/route.ts`
  - Schedule: `0 9 * * 1` (every Monday 9am)
  - Query all DJs with `w9_status = 'pending'`
  - For each: check `w9_reminders.last_sent_at` — skip if sent within 7 days
  - Send reminder email with link to `/dj/upload-w9`
  - Update `w9_reminders` record
- Manual email compose modal: recipient, subject, message, PDF attachment, optional extra attachment

### Acceptance Criteria
- [ ] DJ receives confirmation email after registration
- [ ] Cron job runs and sends reminders to pending DJs
- [ ] Reminders stop when W-9 is uploaded (`stopped_at` is set)
- [ ] `reminder_count` increments correctly
- [ ] Manual email modal sends with PDF attachment
- [ ] Additional file can be attached before sending

---

## Audit Log (Add Alongside Each Phase)

The `audit_log` table should be created in Phase 2 and written to throughout all phases.

```sql
CREATE TABLE audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  user_role varchar NOT NULL,
  action varchar NOT NULL CHECK (action IN (
    'create', 'edit', 'delete', 'override',
    'email_sent', 'file_uploaded',
    'payment_initiated', 'payment_confirmed', 'payment_failed'
  )),
  table_name varchar NOT NULL,
  record_id uuid,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_log_admin" ON audit_log FOR ALL USING (get_my_role() = 'admin');
```

Write to `audit_log` in every server action that creates, edits, or deletes a record. Pass the before/after values in `payload`.

---

## Environment Variables — Complete Reference

| Variable | Used In | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + Server | Safe to expose |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + Server | Safe to expose; RLS limits it |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Never expose to client; bypasses RLS |
| `RESEND_API_KEY` | Server only | Phase 20 |
| `PAYPAL_CLIENT_ID` | Server only | Phase 19 |
| `PAYPAL_CLIENT_SECRET` | Server only | Phase 19 |
| `PAYPAL_MODE` | Server only | `sandbox` or `live` |

---

*Machina — BUILD_PLAN.md*
*LosGothsCo Event Operations Platform*
*Last updated: April 2026*
