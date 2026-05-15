-- ============================================================================
-- Migration 0014 — backfill inline Paid + Method into expense_payments
-- ============================================================================
-- Phase 18 (the slim version, shipped briefly before the full ledger) let
-- the admin mark expense rows as Paid + type a freeform method directly on
-- the row (event_budget_expenses.payment_status / .payment_method). The
-- full Phase 18 ledger replaces that with one row per payment in
-- expense_payments — but the inline data the admin already entered would
-- otherwise be invisible in the new UI.
--
-- This migration synthesizes one ledger entry per "paid" expense row that
-- had a method recorded, so the new payments page surfaces the original
-- method + amount. paid_at = now() (we never recorded the original date),
-- paid_by = the first admin profile we can find, status = 'confirmed',
-- note = a marker so we can tell these apart from real entries.
--
-- IDEMPOTENCY: the WHERE clause excludes any expense that already has a
-- payment in the ledger. Re-running the migration is therefore a no-op.
-- Rows where payment_status='paid' but payment_method is NULL are skipped
-- (we'd have nothing to put in the required payment_method column).
-- ============================================================================

DO $$
DECLARE
  admin_profile_id uuid;
BEGIN
  -- Pick the first admin profile to attribute the backfill to. If no
  -- admin exists yet (clean DB), do nothing — the user can re-run this
  -- once an admin is seeded.
  SELECT id INTO admin_profile_id
    FROM profiles
   WHERE role = 'admin'
   ORDER BY created_at ASC NULLS LAST
   LIMIT 1;

  IF admin_profile_id IS NULL THEN
    RAISE NOTICE 'Skipping backfill — no admin profile found.';
    RETURN;
  END IF;

  INSERT INTO expense_payments
    (expense_id, payment_method, amount, paid_at, paid_by, note, status)
  SELECT
    e.id,
    e.payment_method,
    e.qty * e.price,
    now(),
    admin_profile_id,
    'Backfilled from inline payment_method (Phase 18 transition)',
    'confirmed'
  FROM event_budget_expenses e
  WHERE e.payment_status = 'paid'
    AND e.payment_method IS NOT NULL
    AND e.qty * e.price > 0
    -- Idempotency guard: skip if any ledger entry already exists for this expense.
    AND NOT EXISTS (
      SELECT 1
        FROM expense_payments p
       WHERE p.expense_id = e.id
    );
END $$;
