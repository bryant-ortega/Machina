-- Migration 0016 — Phase 17g: viewer role.
--
-- A `viewer` is a stripped-down account that can ONLY see the year
-- view (no events list, no budget, no DJ data, no admin UI). To make
-- the year view render under their auth, they need SELECT access on
-- `events`. Mutations stay admin-only.
--
-- Venues are already readable by any authenticated user (see 0002),
-- so the venues join on the year view works without further changes.
--
-- Apply via the Supabase SQL Editor.

-- ---------------------------------------------------------------------------
-- 1. Extend the profiles role check to include 'viewer'.
-- ---------------------------------------------------------------------------
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'partner', 'collab', 'dj', 'vendor', 'viewer'));

-- ---------------------------------------------------------------------------
-- 2. Let viewers read the events table.
--
-- This is additive — the existing `events_all_admin` policy keeps
-- admins fully empowered, and the new policy below gives viewers a
-- SELECT-only window. Both policies use OR semantics (Postgres RLS
-- evaluates ANY matching policy), so the union is what each role sees.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "events_select_viewer" ON events;
CREATE POLICY "events_select_viewer" ON events
  FOR SELECT USING (get_my_role() = 'viewer');
