import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_CATEGORY_ORDER,
  type ExpenseCategory,
} from '@/lib/budget'
import { sumConfirmed } from '@/lib/expense-payments'
import { PaymentsList } from './payments-list'

/**
 * Phase 18 — payment ledger page for one event.
 *
 * Shows every expense line on the event's FINAL budget grouped by category,
 * with each line's running paid total, status badge, full payment history,
 * and an inline "Add payment" form. The estimated budget never has a
 * payments page (you don't pay against estimates) — if no final exists,
 * we redirect-by-404 to nudge the admin to actualize first.
 *
 * Auth: handled by the (admin) layout. The PaymentsList client component
 * calls server actions which re-check admin role.
 */
export default async function PaymentsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()

  const { data: event } = await supabase
    .from('events')
    .select('id, event_id, title, date, city, state')
    .eq('id', id)
    .maybeSingle()

  if (!event) notFound()

  // Find the final budget — payments only make sense after actualize.
  const { data: finalBudget } = await supabase
    .from('event_budgets')
    .select('id')
    .eq('event_id', id)
    .eq('budget_type', 'final')
    .maybeSingle()

  // Pull every expense on the final budget, plus its full payment history
  // in one round-trip via the embedded select.
  const expenses = finalBudget
    ? (
        await supabase
          .from('event_budget_expenses')
          .select(
            `
              id,
              category,
              item,
              qty,
              price,
              payment_status,
              expense_payments (
                id,
                payment_method,
                amount,
                paid_at,
                note,
                status
              )
            `
          )
          .eq('budget_id', finalBudget.id)
          .order('category', { ascending: true })
          .order('item', { ascending: true })
      ).data ?? []
    : []

  type DbExpense = {
    id: string
    category: string
    item: string
    qty: number | null
    price: number | null
    payment_status: string | null
    expense_payments: Array<{
      id: string
      payment_method: string
      amount: number
      paid_at: string
      note: string | null
      status: string
    }> | null
  }

  // Normalize for the client list. Compute line totals + paid sums here so
  // the client doesn't have to re-derive them on every render.
  const rows = (expenses as DbExpense[]).map((e) => {
    const qty = Number(e.qty) || 0
    const price = Number(e.price) || 0
    const lineTotal = qty * price
    const payments = (e.expense_payments ?? []).map((p) => ({
      id: p.id,
      payment_method: p.payment_method,
      amount: Number(p.amount) || 0,
      paid_at: p.paid_at,
      note: p.note,
      status: p.status,
    }))
    const paid = sumConfirmed(payments)
    return {
      id: e.id,
      category: normalizeCategory(e.category),
      item: e.item,
      qty,
      price,
      lineTotal,
      paid,
      remaining: Math.max(0, lineTotal - paid),
      status: normalizeStatus(e.payment_status),
      payments,
    }
  })

  // Group by category in the canonical order.
  const grouped = EXPENSE_CATEGORY_ORDER.map((cat) => ({
    category: cat,
    label: EXPENSE_CATEGORY_LABELS[cat],
    rows: rows.filter((r) => r.category === cat),
  }))

  // Top-level rollup for the header card.
  const totals = rows.reduce(
    (acc, r) => {
      acc.total += r.lineTotal
      acc.paid += r.paid
      return acc
    },
    { total: 0, paid: 0 }
  )

  return (
    <div className="flex-1 px-4 py-6 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <Link
            href={`/events/${id}/budget?view=final`}
            className="text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            ← Back to budget
          </Link>
        </div>

        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Payments
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {event.title} ·{' '}
            {new Date(`${event.date}T00:00:00`).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}{' '}
            · {event.city}, {event.state}
          </p>
          <p className="font-mono text-xs text-zinc-500 dark:text-zinc-500">
            {event.event_id}
          </p>
        </header>

        {!finalBudget ? (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
            This event hasn&apos;t been actualized yet. Open the budget,
            click <strong>Actualize</strong>, then come back here to
            track payments.
          </div>
        ) : (
          <>
            {/* Summary card */}
            <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Stat label="Line total" value={fmtUSD(totals.total)} />
                <Stat
                  label="Paid"
                  value={fmtUSD(totals.paid)}
                  tone={
                    totals.paid >= totals.total && totals.total > 0
                      ? 'positive'
                      : undefined
                  }
                />
                <Stat
                  label="Remaining"
                  value={fmtUSD(Math.max(0, totals.total - totals.paid))}
                  tone={
                    totals.total - totals.paid > 0.01 ? 'negative' : undefined
                  }
                />
                <Stat
                  label="Lines"
                  value={`${rows.filter((r) => r.status === 'paid').length} of ${rows.length} paid`}
                />
              </div>
            </section>

            {/* Per-category groups */}
            {grouped
              .filter((g) => g.rows.length > 0)
              .map((group) => (
                <PaymentsList
                  key={group.category}
                  categoryLabel={group.label}
                  rows={group.rows}
                />
              ))}

            {rows.length === 0 ? (
              <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 px-4 py-6 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
                No expense lines on this final budget yet.
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tiny presentational helpers (kept inline; not worth their own file).
// ---------------------------------------------------------------------------

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'positive' | 'negative'
}) {
  const cls =
    tone === 'positive'
      ? 'text-emerald-700 dark:text-emerald-300'
      : tone === 'negative'
        ? 'text-red-700 dark:text-red-300'
        : 'text-zinc-900 dark:text-zinc-100'
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </p>
      <p className={`mt-0.5 text-lg font-semibold tabular-nums ${cls}`}>
        {value}
      </p>
    </div>
  )
}

function fmtUSD(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0)
}

function normalizeCategory(c: string): ExpenseCategory {
  return (EXPENSE_CATEGORY_ORDER as readonly string[]).includes(c)
    ? (c as ExpenseCategory)
    : 'staff'
}

function normalizeStatus(
  s: string | null | undefined
): 'unpaid' | 'paid' {
  return s === 'paid' ? 'paid' : 'unpaid'
}
