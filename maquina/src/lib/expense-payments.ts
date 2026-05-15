/**
 * Pure helpers for the Phase 18 expense_payments ledger.
 *
 * One expense line can have many payments (deposit + balance, partial cash
 * + Zelle, etc.). The rolled-up status on event_budget_expenses.payment_status
 * is derived from the sum of confirmed payments vs the line total, and the
 * server actions that mutate the ledger (addExpensePayment /
 * deleteExpensePayment) call deriveStatus to refresh the parent row.
 *
 * Pending and failed payments are excluded from the paid total — only
 * 'confirmed' counts. That matches the Phase 19 PayPal flow where a payout
 * is logged as 'pending' until the webhook flips it to 'confirmed'.
 */

export type PaymentStatus = 'unpaid' | 'paid'

/**
 * Derive the rolled-up status for one line from its total + paid sum.
 * Binary state: a line is either fully paid (within sub-penny float
 * tolerance) or it isn't. The exact $ progress lives on the payments
 * page; the rolled-up flag is just for badge / filter convenience.
 */
export function deriveStatus(
  lineTotal: number,
  paidSum: number,
  epsilon: number = 0.01
): PaymentStatus {
  const total = Math.max(0, lineTotal)
  const paid = Math.max(0, paidSum)
  // A zero-total line is paid by definition (nothing to pay).
  if (total <= epsilon) return 'paid'
  if (paid + epsilon >= total) return 'paid'
  return 'unpaid'
}

/** Sum the dollar amounts of confirmed payments only. */
export function sumConfirmed(
  payments: Array<{ amount: number; status: string }>
): number {
  let s = 0
  for (const p of payments) {
    if (p.status === 'confirmed') s += Number(p.amount) || 0
  }
  return s
}
