-- Migration 0010 — Phase 17: View Builder.
--
-- Admins can create custom views over the event list — pick which
-- fields show, rename their labels, and reorder them. Per-event
-- overrides allow customizing a view's layout for a single event
-- without forking the whole view.
--
-- Three new tables:
--
--   views                       — one row per view (system or custom).
--                                 The four built-in views (Month,
--                                 Year, Posting calendar, DJ
--                                 analytics) are seeded as
--                                 is_system=true.
--
--   view_fields                 — which event fields appear in a view,
--                                 in what order, with what label. One
--                                 row per (view, field_key).
--
--   event_view_customizations   — per-event override of any view_field
--                                 row's visibility / label / position.
--                                 Lets an admin tweak a single event's
--                                 layout in a view without affecting
--                                 every other event using that view.
--
-- All three are admin-only via RLS — only `get_my_role() = 'admin'`
-- can read or write. Non-admins get nothing (the views show up
-- through the existing /views/* server pages, which already gate
-- access in the (admin) layout).
--
-- Apply via the Supabase SQL editor (or `supabase db push` if linked).

-- ---------------------------------------------------------------------------
-- 1) views
-- ---------------------------------------------------------------------------

CREATE TABLE views (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        varchar     NOT NULL,
  description varchar,
  audience    varchar     NOT NULL CHECK (audience IN (
                'internal', 'designer', 'venue', 'dj', 'partner', 'other'
              )),
  is_system   boolean     NOT NULL DEFAULT false,
  -- Slug only set on system views — gives the renderer a stable handle
  -- to find e.g. the Month view independent of its uuid. Custom views
  -- have NULL slug.
  slug        varchar     UNIQUE,
  created_by  uuid        NOT NULL REFERENCES profiles(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX views_audience_idx ON views (audience);


-- ---------------------------------------------------------------------------
-- 2) view_fields
-- ---------------------------------------------------------------------------

CREATE TABLE view_fields (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  view_id    uuid        NOT NULL REFERENCES views(id) ON DELETE CASCADE,
  field_key  varchar     NOT NULL,
  label      varchar     NOT NULL,
  position   int         NOT NULL CHECK (position >= 0),
  visible    boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (view_id, field_key)
);

-- The renderer always sorts by position; index the lookup.
CREATE INDEX view_fields_view_position_idx
  ON view_fields (view_id, position);


-- ---------------------------------------------------------------------------
-- 3) event_view_customizations
--
-- Per-event override of a view_field row's visibility / label /
-- position. NULL on any column = "use the view default for this
-- field". Deleting a customization row reverts that field to the
-- view default for the event ("Reset to Default").
-- ---------------------------------------------------------------------------

CREATE TABLE event_view_customizations (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   uuid        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  view_id    uuid        NOT NULL REFERENCES views(id) ON DELETE CASCADE,
  field_key  varchar     NOT NULL,
  visible    boolean,
  label      varchar,
  position   int         CHECK (position IS NULL OR position >= 0),
  created_by uuid        NOT NULL REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, view_id, field_key)
);

CREATE INDEX evc_event_view_idx
  ON event_view_customizations (event_id, view_id);


-- ---------------------------------------------------------------------------
-- 4) RLS
-- ---------------------------------------------------------------------------

ALTER TABLE views                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE view_fields                ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_view_customizations  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "views_all_admin"
  ON views
  FOR ALL
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');

CREATE POLICY "view_fields_all_admin"
  ON view_fields
  FOR ALL
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');

CREATE POLICY "evc_all_admin"
  ON event_view_customizations
  FOR ALL
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');


-- ---------------------------------------------------------------------------
-- 5) Seed the four system views.
--
-- These mirror the existing /views/* pages so the View Builder can
-- list them alongside custom views. Seeded with is_system=true so
-- they can't be deleted or have their slugs changed. created_by is
-- the first admin profile — if no admin exists yet, the seed is a
-- no-op.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  admin_profile_id uuid;
  v_month uuid;
  v_year uuid;
  v_posting uuid;
  v_djs uuid;
BEGIN
  SELECT id INTO admin_profile_id
  FROM profiles
  WHERE role = 'admin'
  ORDER BY id
  LIMIT 1;

  IF admin_profile_id IS NULL THEN
    RAISE NOTICE 'No admin profile found — skipping system view seed. Re-run this section once an admin exists.';
    RETURN;
  END IF;

  -- Idempotent inserts keyed on slug.
  INSERT INTO views (name, description, audience, is_system, slug, created_by)
  VALUES
    ('Month view',       'Events for the selected month.',                'internal', true, 'system_month',            admin_profile_id),
    ('Year view',        'All events in the selected year, by month.',    'internal', true, 'system_year',             admin_profile_id),
    ('Posting calendar', 'Action dates flattened by day.',                'designer', true, 'system_posting_calendar', admin_profile_id),
    ('DJ analytics',     'Per-DJ confirmed event counts and share.',      'internal', true, 'system_dj_analytics',     admin_profile_id)
  ON CONFLICT (slug) DO NOTHING;
END
$$;
