-- ============================================================================
-- Migration 0015 — revert the Phase 18 ledger experiment
-- ============================================================================
-- Phase 18's full ledger (expense_payments + per-event payments page) was
-- shipped briefly and then rolled back: the inline Paid + Method controls
-- on the Final budget cover Chase's actual workflow ("when I actualize a
-- budget I am making payments and marking them as paid").
--
-- This migration:
--   1. DROP the expense_payments table (cleans up the dead schema). Safe
--      whether or not migration 0012 ever ran — DROP TABLE IF EXISTS.
--   2. Re-apply the unpaid/paid CHECK constraint on
--      event_budget_expenses.payment_status, in case 0013 was skipped on
--      the live DB. Idempotent.
--
-- After this runs, the only payment-related state lives back where it
-- started in Phase 18 (slim): event_budget_expenses.payment_status
-- ('unpaid' | 'paid') and event_budget_expenses.payment_method (freeform
-- text via 0011's CHECK relaxation).
-- ============================================================================

DROP TABLE IF EXISTS expense_payments;

-- Re-establish the binary constraint defensively. If 0013 already ran,
-- this is a no-op. If it didn't, it migrates any 'partial' rows down to
-- 'unpaid' first so the new constraint can apply.
UPDATE event_budget_expenses
   SET payment_status = 'unpaid'
 WHERE payment_status = 'partial';

ALTER TABLE event_budget_expenses
  DROP CONSTRAINT IF EXISTS event_budget_expenses_payment_status_check;

ALTER TABLE event_budget_expenses
  ADD CONSTRAINT event_budget_expenses_payment_status_check
  CHECK (payment_status IN ('unpaid', 'paid'));
