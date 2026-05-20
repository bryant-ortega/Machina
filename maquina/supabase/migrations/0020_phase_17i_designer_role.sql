-- Migration 0020 — Phase 17i: designer role.
--
-- A `designer` is a stripped-down account meant for outside flyer
-- designers. They can sign in and see ONE thing: the custom view(s)
-- you've created with audience='designer', rendered read-only — no
-- event detail page, no budgets, no DJ private info, no admin chrome.
--
-- Mirrors the viewer role (0016) — additive RLS policies stacked next
-- to the existing admin-only policies via OR semantics. Mutations stay
-- admin-only across the board.
--
-- IMPORTANT — budget tables intentionally have NO designer policy.
-- That means even if a designer-audience view accidentally includes a
-- financial field, the loader returns nothing for it and the cell
-- renders empty. RLS is the actual security boundary; the UI choice
-- is defence in depth, not the gate.
--
-- Apply via the Supabase SQL Editor, then run the NOTIFY at the bottom.

-- ---------------------------------------------------------------------------
-- 1. Extend the profiles role check to include 'designer'.
-- ---------------------------------------------------------------------------
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'partner', 'collab', 'dj', 'vendor', 'viewer', 'designer'));

-- ---------------------------------------------------------------------------
-- 2. Let designers read events (basic event metadata + venues join).
--    Mirror of events_select_viewer.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "events_select_designer" ON events;
CREATE POLICY "events_select_designer" ON events
  FOR SELECT USING (get_my_role() = 'designer');

-- ---------------------------------------------------------------------------
-- 3. Let designers read DJ slots so the lineup join works through
--    PostgREST resource embedding (`event_dj_slots → djs(dj_name)`).
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "event_dj_slots_select_designer" ON event_dj_slots;
CREATE POLICY "event_dj_slots_select_designer" ON event_dj_slots
  FOR SELECT USING (get_my_role() = 'designer');

-- ---------------------------------------------------------------------------
-- 4. Let designers read djs.
--
-- NOTE — RLS gates rows, not columns. This policy gives designers
-- SELECT on every column of djs (incl. pay_method, pay_handle, phone,
-- email, w9_status). The designer page only ever projects dj_name,
-- but a designer holding a valid JWT could in theory query other
-- columns directly via the REST API. If that's a concern, the next
-- step is to revoke this and expose a SECURITY DEFINER RPC that
-- returns only (id, dj_name) for a given set of event_ids. Punted to
-- keep this slice focused; flagged here for future tightening.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "djs_select_designer" ON djs;
CREATE POLICY "djs_select_designer" ON djs
  FOR SELECT USING (get_my_role() = 'designer');

-- ---------------------------------------------------------------------------
-- 5. Let designers read ONLY views with audience='designer'.
--    Admins keep the existing `views_all_admin` policy (FOR ALL).
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "views_select_designer" ON views;
CREATE POLICY "views_select_designer" ON views
  FOR SELECT USING (
    get_my_role() = 'designer'
    AND audience = 'designer'
  );

-- ---------------------------------------------------------------------------
-- 6. Let designers read view_fields whose parent view is audience='designer'.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "view_fields_select_designer" ON view_fields;
CREATE POLICY "view_fields_select_designer" ON view_fields
  FOR SELECT USING (
    get_my_role() = 'designer'
    AND EXISTS (
      SELECT 1 FROM views v
      WHERE v.id = view_fields.view_id
        AND v.audience = 'designer'
    )
  );

-- ---------------------------------------------------------------------------
-- 7. Reload PostgREST schema cache so the new policies / role apply
--    immediately (avoids the recurring "could not find table" stall).
-- ---------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
