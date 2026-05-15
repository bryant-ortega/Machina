-- ============================================================================
-- Migration 0012 — Phase 18: expense_payments ledger
-- ============================================================================
-- Phase 18 ships proper payment tracking: a per-payment ledger so an admin
-- can record multiple payments against a single expense line (deposit +
-- balance, partial cash + balance via Zelle, etc.) and we can keep an
-- accurate paid-so-far number with full history.
--
-- The rolled-up status (`unpaid` / `partial` / `paid`) still lives on
-- event_budget_expenses.payment_status — the addExpensePayment /
-- deleteExpensePayment server actions recompute it whenever the ledger
-- changes. Reading status from the parent expense row is fast and matches
-- how the rest of the budget UI already renders.
--
-- payment_method is freeform text, matching the change in 0011 (cash,
-- check #1234, ACH, etc., not just the original 'paypal'/'zelle'/...).
--
-- status on the payment row tracks the lifecycle of one payment attempt:
--   confirmed — money moved, manual entry (default for the manual flow
--               we're shipping in Phase 18)
--   pending   — initiated but not yet acked (used by Phase 19's PayPal
--               Payouts API call before the webhook lands)
--   failed    — the underlying transfer didn't go through (PayPal
--               returned an error). Kept in the ledger for audit.
--
-- Only confirmed payments count toward "paid so far". pending + failed
-- are excluded from the rolled-up total.
-- ============================================================================

CREATE TABLE expense_payments (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id             uuid        NOT NULL REFERENCES event_budget_expenses(id) ON DELETE CASCADE,
  payment_method         varchar(80) NOT NULL,
  amount                 numeric     NOT NULL CHECK (amount > 0),
  paypal_transaction_id  varchar,
  paypal_batch_id        varchar,
  paid_at                timestamptz NOT NULL DEFAULT now(),
  paid_by                uuid        NOT NULL REFERENCES profiles(id),
  note                   varchar(500),
  status                 varchar     NOT NULL DEFAULT 'confirmed'
                                     CHECK (status IN ('pending', 'confirmed', 'failed')),
  created_at             timestamptz NOT NULL DEFAULT now()
);

-- Lookup pattern is "all payments for one expense" — index supports it.
CREATE INDEX expense_payments_expense_id_idx
  ON expense_payments (expense_id);

ALTER TABLE expense_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expense_payments_admin_all"
  ON expense_payments
  FOR ALL
  USING (get_my_role() = 'admin');
