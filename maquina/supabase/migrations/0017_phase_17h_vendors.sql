-- Migration 0017 — Phase 17h: vendor self-registration.
--
-- Adds the `vendors` table, mirroring `djs` in shape: one row per
-- vendor business, linked to an auth user via user_id, with a W-9
-- status column the upload flow flips from 'pending' to 'on_file'.
--
-- Storage reuses the existing `w9s` bucket. Migration 0004's
-- w9_upload_own / w9_update_own policies match by `auth.uid()`, so
-- vendors uploading to `w9s/{vendor_user_id}/w9.pdf` are already
-- allowed — no storage RLS change needed.
--
-- Apply via the Supabase SQL Editor.

-- ---------------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------------
CREATE TABLE vendors (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name    varchar     NOT NULL,
  contact_name    varchar     NOT NULL,
  email           varchar     UNIQUE NOT NULL,
  phone           varchar,
  region          varchar     NOT NULL CHECK (region IN ('SoCal', 'NorCal', 'Chicago', 'Arizona', 'Seattle', 'Other')),
  pay_method      varchar     CHECK (pay_method IN ('zelle', 'venmo', 'paypal')),
  pay_handle      varchar,
  w9_storage_path varchar,
  w9_status       varchar     NOT NULL DEFAULT 'pending' CHECK (w9_status IN ('pending', 'on_file')),
  registered_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX vendors_user_id_idx ON vendors (user_id);
CREATE INDEX vendors_region_idx ON vendors (region);


-- ---------------------------------------------------------------------------
-- 2. RLS — mirrors the djs policy set in 0002.
-- ---------------------------------------------------------------------------
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vendors_select_admin" ON vendors
  FOR SELECT USING (get_my_role() = 'admin');

CREATE POLICY "vendors_select_own" ON vendors
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "vendors_insert_own" ON vendors
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "vendors_update_admin" ON vendors
  FOR UPDATE USING (get_my_role() = 'admin');

CREATE POLICY "vendors_update_own_w9" ON vendors
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "vendors_delete_admin" ON vendors
  FOR DELETE USING (get_my_role() = 'admin');
