-- ============================================================================
-- Migration 0013 — drop 'partial' from event_budget_expenses.payment_status
-- ============================================================================
-- The original schema (0001) allowed three states: unpaid / partial / paid.
-- In practice the partial state isn't useful for Chase's workflow — a line
-- is either fully paid or it isn't, and the per-payment ledger
-- (expense_payments, added in 0012) already shows exact paid-so-far totals.
--
-- Migrate any existing 'partial' rows to 'unpaid' so the new check
-- constraint passes, then narrow the constraint to the two surviving
-- states.
-- ============================================================================

UPDATE event_budget_expenses
   SET payment_status = 'unpaid'
 WHERE payment_status = 'partial';

ALTER TABLE event_budget_expenses
  DROP CONSTRAINT IF EXISTS event_budget_expenses_payment_status_check;

ALTER TABLE event_budget_expenses
  ADD CONSTRAINT event_budget_expenses_payment_status_check
  CHECK (payment_status IN ('unpaid', 'paid'));
