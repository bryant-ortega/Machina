-- Migration 0009 — Phase 14: per-event bar tunables.
--
-- Bar per-head dollars and the LosGothsCo cut percentage were
-- previously hardcoded constants in src/lib/budget.ts ($24 / 16%). Now
-- they're per-budget editable so different venues / partner deals can
-- be modeled without code changes.
--
-- Existing rows backfill to the historical defaults so on-screen totals
-- don't move when this migration runs.
--
-- Apply via the Supabase SQL editor (or `supabase db push` if linked).

ALTER TABLE event_budgets
  ADD COLUMN bar_per_head numeric NOT NULL DEFAULT 24,
  ADD COLUMN bar_pct      numeric NOT NULL DEFAULT 0.16;
