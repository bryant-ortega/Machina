-- Migration 0018 — add five new regions to the djs + vendors
-- region CHECK constraint.
--
-- New values: New York, Portland, Texas, Central Cal, Las Vegas.
-- Existing values stay unchanged.
--
-- Apply via the Supabase SQL Editor.

-- ---------------------------------------------------------------------------
-- djs
-- ---------------------------------------------------------------------------
ALTER TABLE djs DROP CONSTRAINT IF EXISTS djs_region_check;
ALTER TABLE djs
  ADD CONSTRAINT djs_region_check
  CHECK (region IN (
    'SoCal', 'NorCal', 'Chicago', 'Arizona', 'Seattle', 'Other',
    'New York', 'Portland', 'Texas', 'Central Cal', 'Las Vegas'
  ));

-- ---------------------------------------------------------------------------
-- vendors
-- ---------------------------------------------------------------------------
ALTER TABLE vendors DROP CONSTRAINT IF EXISTS vendors_region_check;
ALTER TABLE vendors
  ADD CONSTRAINT vendors_region_check
  CHECK (region IN (
    'SoCal', 'NorCal', 'Chicago', 'Arizona', 'Seattle', 'Other',
    'New York', 'Portland', 'Texas', 'Central Cal', 'Las Vegas'
  ));
