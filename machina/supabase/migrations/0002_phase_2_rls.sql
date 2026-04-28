-- ============================================================================
-- Phase 2 — Row-Level Security (RLS)
-- ============================================================================
-- Enables RLS on all 10 tables and adds the policies needed for MVP.
-- Source of truth: BUILD_PLAN.md → Phase 2.
--
-- MVP scope: only the Admin role gets full access. DJs get scoped self-access
-- on profiles and djs tables (so they can manage their own row + W-9 upload).
-- All other DJ/Partner permissions are deferred to Phase 5+ per BUILD_PLAN.
--
-- Critical: `get_my_role()` is declared SECURITY DEFINER so it can read the
-- caller's profile row even before any profiles policy applies. Without that,
-- the function would itself be blocked by RLS and every policy that calls it
-- would silently evaluate to NULL.
-- ============================================================================


-- 1. ENABLE RLS ON ALL TABLES ------------------------------------------------
ALTER TABLE profiles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE venues                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE djs                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE events                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_stages           ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_dj_slots         ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_budgets          ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_budget_expenses  ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_budget_income    ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_tix_tiers        ENABLE ROW LEVEL SECURITY;


-- 2. HELPER FUNCTION ---------------------------------------------------------
-- Returns the role of the currently authenticated user, or NULL if no session.
-- STABLE so the query optimizer can cache the result within a statement.
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS varchar AS $$
  SELECT role FROM profiles WHERE user_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- 3. PROFILES POLICIES -------------------------------------------------------
-- Users see and edit their own profile; admins see everyone.
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "profiles_select_admin" ON profiles
  FOR SELECT USING (get_my_role() = 'admin');

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (user_id = auth.uid());


-- 4. VENUES POLICIES ---------------------------------------------------------
-- Any authenticated user can read venues; only admins can mutate.
CREATE POLICY "venues_select_authenticated" ON venues
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "venues_insert_admin" ON venues
  FOR INSERT WITH CHECK (get_my_role() = 'admin');

CREATE POLICY "venues_update_admin" ON venues
  FOR UPDATE USING (get_my_role() = 'admin');

CREATE POLICY "venues_delete_admin" ON venues
  FOR DELETE USING (get_my_role() = 'admin');


-- 5. DJS POLICIES ------------------------------------------------------------
-- Admins have full access. DJs can read/insert/update their own row only —
-- the duplicate update policies (own_w9 + admin) coexist; either one passing
-- allows the update.
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


-- 6. EVENTS + RELATED TABLES — ADMIN ONLY ------------------------------------
-- These tables are operational and not visible to DJs/Vendors in MVP.
-- Partner role policies are added in Phase 13.

CREATE POLICY "events_all_admin" ON events
  FOR ALL USING (get_my_role() = 'admin');

CREATE POLICY "event_stages_all_admin" ON event_stages
  FOR ALL USING (get_my_role() = 'admin');

CREATE POLICY "event_dj_slots_all_admin" ON event_dj_slots
  FOR ALL USING (get_my_role() = 'admin');

CREATE POLICY "event_budgets_all_admin" ON event_budgets
  FOR ALL USING (get_my_role() = 'admin');

CREATE POLICY "event_budget_expenses_all_admin" ON event_budget_expenses
  FOR ALL USING (get_my_role() = 'admin');

CREATE POLICY "event_budget_income_all_admin" ON event_budget_income
  FOR ALL USING (get_my_role() = 'admin');

CREATE POLICY "event_tix_tiers_all_admin" ON event_tix_tiers
  FOR ALL USING (get_my_role() = 'admin');
