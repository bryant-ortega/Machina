-- ============================================================================
-- Migration 0011: payment_method becomes freeform text
-- ============================================================================
-- Original schema (0001) constrained event_budget_expenses.payment_method to
--   ('paypal','zelle','venmo','other').
-- Real-world payments include cash, check #, ACH, Apple Pay, etc., and the
-- admin wants to record those verbatim instead of always falling back to
-- 'other'. Drop the CHECK and let the column be any text. The column stays
-- NULLABLE so unpaid lines can be left blank.
--
-- payment_status keeps its existing CHECK ('unpaid','partial','paid') —
-- those three values are exhaustive for our flow.
-- ============================================================================

ALTER TABLE event_budget_expenses
  DROP CONSTRAINT IF EXISTS event_budget_expenses_payment_method_check;
