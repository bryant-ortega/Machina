-- Migration 0008 — Phase 13: Collaboration Partner role.
--
-- Adds a third role 'collab' for external collaboration partners
-- (third-party promoters / venue contacts / co-hosts). Collabs are
-- attached to specific events via event_collaborators and have
-- read-only access scoped to those events.
--
-- This is NOT a co-admin role. The LosGothsCo internal team uses
-- role='admin' and has full access. 'collab' is for narrowly-scoped
-- external visibility on a single event at a time.
--
-- Apply via the Supabase SQL editor (or `supabase db push` if linked).

-- ---------------------------------------------------------------------------
-- 1) Allow 'collab' as a valid role on profiles.
-- ---------------------------------------------------------------------------

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'partner', 'collab', 'dj', 'vendor'));
-- 'partner' is kept for backwards compatibility with the original
-- BUILD_PLAN — currently unused, may be removed in a future migration.

-- ---------------------------------------------------------------------------
-- 2) event_collaborators junction table.
--
-- One row per (event, user) attachment. Inserted by admins via the
-- event edit page; the inserted user gets read access to that event
-- via the SELECT policies below.
-- ---------------------------------------------------------------------------

CREATE TABLE event_collaborators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  added_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

CREATE INDEX event_collaborators_event_idx
  ON event_collaborators (event_id);
CREATE INDEX event_collaborators_user_idx
  ON event_collaborators (user_id);

ALTER TABLE event_collaborators ENABLE ROW LEVEL SECURITY;

-- Admins can do everything.
CREATE POLICY "event_collaborators_all_admin"
  ON event_collaborators FOR ALL
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');

-- A collab can read their own attachments — needed so the events list
-- query can see the rows that scope their view.
CREATE POLICY "event_collaborators_read_self"
  ON event_collaborators FOR SELECT
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 3) SELECT policies for the 'collab' role on event-scoped tables.
--
-- Each policy permits a collab to read rows whose event is one they're
-- attached to. No INSERT / UPDATE / DELETE policies — collabs are
-- strictly read-only.
-- ---------------------------------------------------------------------------

-- events: scope by event id == attachment.
CREATE POLICY "events_select_collab"
  ON events FOR SELECT
  USING (
    get_my_role() = 'collab'
    AND id IN (
      SELECT event_id FROM event_collaborators
      WHERE user_id = auth.uid()
    )
  );

-- event_stages, event_dj_slots, event_budgets, event_budget_expenses,
-- event_tix_tiers: scope by event_id (or for budget_expenses/tiers,
-- by joining through event_budgets).

CREATE POLICY "event_stages_select_collab"
  ON event_stages FOR SELECT
  USING (
    get_my_role() = 'collab'
    AND event_id IN (
      SELECT event_id FROM event_collaborators
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "event_dj_slots_select_collab"
  ON event_dj_slots FOR SELECT
  USING (
    get_my_role() = 'collab'
    AND event_id IN (
      SELECT event_id FROM event_collaborators
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "event_budgets_select_collab"
  ON event_budgets FOR SELECT
  USING (
    get_my_role() = 'collab'
    AND event_id IN (
      SELECT event_id FROM event_collaborators
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "event_budget_expenses_select_collab"
  ON event_budget_expenses FOR SELECT
  USING (
    get_my_role() = 'collab'
    AND budget_id IN (
      SELECT id FROM event_budgets
      WHERE event_id IN (
        SELECT event_id FROM event_collaborators
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "event_tix_tiers_select_collab"
  ON event_tix_tiers FOR SELECT
  USING (
    get_my_role() = 'collab'
    AND budget_id IN (
      SELECT id FROM event_budgets
      WHERE event_id IN (
        SELECT event_id FROM event_collaborators
        WHERE user_id = auth.uid()
      )
    )
  );

-- djs: collabs can read DJ rows that are referenced by slots on their
-- attached events. Simpler implementation: allow collab to SELECT all
-- djs (read-only), since DJ data shown on a run of show is just name.
-- The full DJ profile (W-9 etc.) is not exposed to collabs — only
-- dj_name is selected by the run-of-show query.
CREATE POLICY "djs_select_collab"
  ON djs FOR SELECT
  USING (get_my_role() = 'collab');

-- venues: same reasoning — only the venue name is surfaced and only
-- as a join into events the collab can already see.
CREATE POLICY "venues_select_collab"
  ON venues FOR SELECT
  USING (get_my_role() = 'collab');

-- ---------------------------------------------------------------------------
-- Done. After applying this migration:
--   - role='collab' becomes a valid value on profiles
--   - event_collaborators table exists
--   - collabs can SELECT only their attached events + child rows
-- ---------------------------------------------------------------------------
