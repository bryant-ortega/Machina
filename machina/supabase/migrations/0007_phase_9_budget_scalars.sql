-- ============================================================================
-- Migration 0007: Phase 9 prep — per-event budget scalars + default tix tiers
-- ============================================================================
-- The Phase 9 estimated budget view derives an income summary from formulas,
-- but a few per-event inputs aren't computable — they're admin-edited
-- assumptions that need to round-trip across page loads:
--
--   drop_off         (paid_attendance = gross_tix_sold − drop_off)
--   guests           (total_attendance = paid_attendance + guests)
--   deductions       (walkout = losgothsco_tix_net + losgothsco_bar − deductions)
--   sponsor_income   (folds into est_income)
--   vendor_income    (folds into est_income)
--
-- Per Chase: bar knobs ($24/head, 16% LosGothsCo cut) stay as code
-- constants — Phase 14 will add per-event overrides for those. Merch is
-- editable per event now, but as a flat dollar amount rather than a
-- per-head ratio (Chase: "i need a merch gross and the default should be
-- $400"). The other merch knobs (% after fees, % COGS, flat seller fee)
-- still come from org defaults but are stored per-event so admins can
-- tweak them without touching code.
--
-- Phase 9 also wants every event's estimated budget to come pre-seeded with
-- 3 default tix tiers ($10 / $15 / $20). createEvent will be updated to
-- insert these going forward; this migration backfills any existing
-- estimated budget that has zero tiers, so the seed-dev events all show a
-- sensible default in the new budget UI.
-- ============================================================================


-- 1. Add per-event scalar columns to event_budgets ---------------------------
ALTER TABLE event_budgets
  ADD COLUMN IF NOT EXISTS drop_off       numeric NOT NULL DEFAULT 0
    CHECK (drop_off       >= 0),
  ADD COLUMN IF NOT EXISTS guests         numeric NOT NULL DEFAULT 0
    CHECK (guests         >= 0),
  ADD COLUMN IF NOT EXISTS deductions     numeric NOT NULL DEFAULT 0
    CHECK (deductions     >= 0),
  ADD COLUMN IF NOT EXISTS sponsor_income numeric NOT NULL DEFAULT 0
    CHECK (sponsor_income >= 0),
  ADD COLUMN IF NOT EXISTS vendor_income  numeric NOT NULL DEFAULT 0
    CHECK (vendor_income  >= 0),
  -- Per-event merch knobs. Chase: merch_gross is the flat $ admins type
  -- in (default $400); per-head is computed and shown read-only in the
  -- UI. % after fees, % COGS, and flat seller fee remain editable.
  ADD COLUMN IF NOT EXISTS merch_gross           numeric NOT NULL DEFAULT 400
    CHECK (merch_gross           >= 0),
  ADD COLUMN IF NOT EXISTS merch_pct_after_fees  numeric NOT NULL DEFAULT 0.97
    CHECK (merch_pct_after_fees  >= 0 AND merch_pct_after_fees <= 1),
  ADD COLUMN IF NOT EXISTS merch_cogs_pct        numeric NOT NULL DEFAULT 0.35
    CHECK (merch_cogs_pct        >= 0 AND merch_cogs_pct        <= 1),
  ADD COLUMN IF NOT EXISTS merch_seller_fee      numeric NOT NULL DEFAULT 120
    CHECK (merch_seller_fee      >= 0);


-- 2. Backfill default tix tiers for estimated budgets that have none ---------
-- One-shot. Idempotent: the NOT EXISTS guard skips any budget that already
-- has at least one tier, so re-running this migration is a no-op.
INSERT INTO event_tix_tiers (budget_id, tier_number, price, sold)
SELECT b.id, t.tier_number, t.price, 0
FROM event_budgets b
CROSS JOIN (
  VALUES (1, 10::numeric), (2, 15::numeric), (3, 20::numeric)
) AS t(tier_number, price)
WHERE b.budget_type = 'estimated'
  AND NOT EXISTS (
    SELECT 1 FROM event_tix_tiers WHERE budget_id = b.id
  );
