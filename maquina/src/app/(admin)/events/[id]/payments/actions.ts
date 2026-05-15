'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { deriveStatus } from '@/lib/expense-payments'

/**
 * Phase 18 — payment ledger server actions.
 *
 * addExpensePayment    — record a new payment against an expense line.
 *                        Validates the running paid total ≤ line total
 *                        before insert, then recomputes the rolled-up
 *                        status on event_budget_expenses.payment_status.
 *
 * deleteExpensePayment — remove a payment from the ledger and recompute.
 *                        Useful for fixing typos / wrong-amount entries.
 *
 * Both run as service-role for the multi-table writes (insert payment +
 * update expense). RLS on expense_payments is admin-only anyway, but the
 * recompute also reads the parent expense row regardless of RLS.
 */

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const UUID_LIKE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const AddPaymentInput = z.object({
  expense_id: z.string().regex(UUID_LIKE, 'Invalid expense id'),
  // Freeform — matches event_budget_expenses.payment_method after
  // migration 0011 / 0012. Trimmed; empty rejected.
  payment_method: z
    .string()
    .trim()
    .min(1, 'Payment method is required')
    .max(80),
  amount: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? NaN : Number(v)),
    z
      .number()
      .positive('Amount must be greater than 0')
      .max(1_000_000, 'Amount looks wrong (max $1,000,000)')
  ),
  // Optional ISO date (YYYY-MM-DD) or ISO timestamp. Defaults to now() in DB.
  paid_at: z
    .string()
    .trim()
    .min(1)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  note: z
    .string()
    .trim()
    .max(500, 'Note must be 500 characters or fewer')
    .optional()
    .or(z.literal('').transform(() => undefined)),
})

const DeletePaymentInput = z.object({
  payment_id: z.string().regex(UUID_LIKE, 'Invalid payment id'),
})

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export type AddPaymentResult =
  | { ok: true; paymentId: string }
  | { ok: false; reason: 'unauthorized'; message: string }
  | {
      ok: false
      reason: 'invalid'
      issues: Array<{ path: string; message: string }>
    }
  | { ok: false; reason: 'overpay'; message: string }
  | { ok: false; reason: 'not_found'; message: string }
  | { ok: false; reason: 'db_failed'; message: string }

export type DeletePaymentResult =
  | { ok: true }
  | { ok: false; reason: 'unauthorized'; message: string }
  | {
      ok: false
      reason: 'invalid'
      issues: Array<{ path: string; message: string }>
    }
  | { ok: false; reason: 'not_found'; message: string }
  | { ok: false; reason: 'db_failed'; message: string }

// ---------------------------------------------------------------------------
// addExpensePayment
// ---------------------------------------------------------------------------

export async function addExpensePayment(
  raw: unknown
): Promise<AddPaymentResult> {
  // 1. Auth gate — must be a signed-in admin.
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, reason: 'unauthorized', message: 'Not signed in.' }
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!profile || profile.role !== 'admin') {
    return { ok: false, reason: 'unauthorized', message: 'Admin only.' }
  }

  // 2. Validate.
  const parsed = AddPaymentInput.safeParse(raw)
  if (!parsed.success) {
    return {
      ok: false,
      reason: 'invalid',
      issues: parsed.error.issues.map((i) => ({
        path: i.path.map(String).join('.') || '(form)',
        message: i.message,
      })),
    }
  }
  const data = parsed.data

  // 3. Service-role client for the cross-table write + read-back.
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // 4. Pull the parent expense + every existing confirmed payment for it.
  //    Need both to enforce "running total ≤ line total".
  const { data: expense, error: exErr } = await admin
    .from('event_budget_expenses')
    .select('id, qty, price, budget_id')
    .eq('id', data.expense_id)
    .maybeSingle()
  if (exErr) {
    return { ok: false, reason: 'db_failed', message: exErr.message }
  }
  if (!expense) {
    return {
      ok: false,
      reason: 'not_found',
      message: 'Expense line not found.',
    }
  }

  const lineTotal =
    (Number(expense.qty) || 0) * (Number(expense.price) || 0)

  const { data: existing, error: pErr } = await admin
    .from('expense_payments')
    .select('amount, status')
    .eq('expense_id', data.expense_id)
  if (pErr) {
    return { ok: false, reason: 'db_failed', message: pErr.message }
  }

  const confirmedSum = (existing ?? [])
    .filter((p) => p.status === 'confirmed')
    .reduce((acc, p) => acc + (Number(p.amount) || 0), 0)

  // Sub-penny tolerance — money is numeric, but float math can drift.
  if (confirmedSum + data.amount > lineTotal + 0.01) {
    const remaining = Math.max(0, lineTotal - confirmedSum)
    return {
      ok: false,
      reason: 'overpay',
      message: `Payment exceeds remaining balance ($${remaining.toFixed(2)} left).`,
    }
  }

  // 5. Insert. Manual entries are 'confirmed' immediately; PayPal will
  //    later use 'pending' and flip via webhook.
  const { data: inserted, error: iErr } = await admin
    .from('expense_payments')
    .insert({
      expense_id: data.expense_id,
      payment_method: data.payment_method,
      amount: data.amount,
      paid_at: data.paid_at || new Date().toISOString(),
      paid_by: profile.id,
      note: data.note || null,
      status: 'confirmed',
    })
    .select('id')
    .single()
  if (iErr || !inserted) {
    return {
      ok: false,
      reason: 'db_failed',
      message: iErr?.message ?? 'Insert failed',
    }
  }

  // 6. Recompute the rolled-up status on the parent expense row.
  const newStatus = deriveStatus(lineTotal, confirmedSum + data.amount)
  const { error: uErr } = await admin
    .from('event_budget_expenses')
    .update({ payment_status: newStatus })
    .eq('id', data.expense_id)
  if (uErr) {
    return { ok: false, reason: 'db_failed', message: uErr.message }
  }

  // 7. Cache invalidation. We don't know the event_id from the action
  //    args, so revalidate broadly — the budget + payments routes share
  //    the same data.
  if (expense.budget_id) {
    // Find event_id from the budget row so we can be specific.
    const { data: budget } = await admin
      .from('event_budgets')
      .select('event_id')
      .eq('id', expense.budget_id)
      .maybeSingle()
    if (budget?.event_id) {
      revalidatePath(`/events/${budget.event_id}/payments`)
      revalidatePath(`/events/${budget.event_id}/budget`)
    }
  }

  return { ok: true, paymentId: inserted.id as string }
}

// ---------------------------------------------------------------------------
// deleteExpensePayment
// ---------------------------------------------------------------------------

export async function deleteExpensePayment(
  raw: unknown
): Promise<DeletePaymentResult> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, reason: 'unauthorized', message: 'Not signed in.' }
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!profile || profile.role !== 'admin') {
    return { ok: false, reason: 'unauthorized', message: 'Admin only.' }
  }

  const parsed = DeletePaymentInput.safeParse(raw)
  if (!parsed.success) {
    return {
      ok: false,
      reason: 'invalid',
      issues: parsed.error.issues.map((i) => ({
        path: i.path.map(String).join('.') || '(form)',
        message: i.message,
      })),
    }
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Fetch the payment so we know which expense to recompute after delete.
  const { data: payment, error: getErr } = await admin
    .from('expense_payments')
    .select('id, expense_id')
    .eq('id', parsed.data.payment_id)
    .maybeSingle()
  if (getErr) {
    return { ok: false, reason: 'db_failed', message: getErr.message }
  }
  if (!payment) {
    return {
      ok: false,
      reason: 'not_found',
      message: 'Payment not found.',
    }
  }

  const { error: delErr } = await admin
    .from('expense_payments')
    .delete()
    .eq('id', payment.id)
  if (delErr) {
    return { ok: false, reason: 'db_failed', message: delErr.message }
  }

  // Recompute parent status from remaining confirmed payments.
  const { data: expense } = await admin
    .from('event_budget_expenses')
    .select('id, qty, price, budget_id')
    .eq('id', payment.expense_id)
    .maybeSingle()
  if (expense) {
    const lineTotal =
      (Number(expense.qty) || 0) * (Number(expense.price) || 0)
    const { data: remaining } = await admin
      .from('expense_payments')
      .select('amount, status')
      .eq('expense_id', payment.expense_id)
    const confirmedSum = (remaining ?? [])
      .filter((p) => p.status === 'confirmed')
      .reduce((acc, p) => acc + (Number(p.amount) || 0), 0)
    const newStatus = deriveStatus(lineTotal, confirmedSum)
    await admin
      .from('event_budget_expenses')
      .update({ payment_status: newStatus })
      .eq('id', payment.expense_id)

    if (expense.budget_id) {
      const { data: budget } = await admin
        .from('event_budgets')
        .select('event_id')
        .eq('id', expense.budget_id)
        .maybeSingle()
      if (budget?.event_id) {
        revalidatePath(`/events/${budget.event_id}/payments`)
        revalidatePath(`/events/${budget.event_id}/budget`)
      }
    }
  }

  return { ok: true }
}
