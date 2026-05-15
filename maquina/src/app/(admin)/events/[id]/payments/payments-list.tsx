'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  addExpensePayment,
  deleteExpensePayment,
  type AddPaymentResult,
  type DeletePaymentResult,
} from './actions'

/**
 * Phase 18 — payment ledger list (one category group per instance).
 *
 * Each expense line is a card showing:
 *   - item, qty × price, line total
 *   - rolled-up status badge
 *   - $ paid / $ remaining
 *   - inline payment history with per-row delete buttons
 *   - inline "Add payment" form (method, amount, date, note)
 *
 * The add and delete server actions return discriminated union results so
 * we can show a friendly inline error (overpay, validation, db_failed)
 * instead of throwing.
 */

export type PaymentRow = {
  id: string
  payment_method: string
  amount: number
  paid_at: string
  note: string | null
  status: string
}

export type ExpenseRow = {
  id: string
  category: string
  item: string
  qty: number
  price: number
  lineTotal: number
  paid: number
  remaining: number
  status: 'unpaid' | 'paid'
  payments: PaymentRow[]
}

export function PaymentsList({
  categoryLabel,
  rows,
}: {
  categoryLabel: string
  rows: ExpenseRow[]
}) {
  return (
    <section className="space-y-3">
      <header className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold tracking-tight">
          {categoryLabel}
        </h2>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {rows.filter((r) => r.status === 'paid').length} of {rows.length}{' '}
          paid
        </span>
      </header>

      <div className="space-y-3">
        {rows.map((row) => (
          <ExpenseCard key={row.id} row={row} />
        ))}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Per-expense card
// ---------------------------------------------------------------------------

function ExpenseCard({ row }: { row: ExpenseRow }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Add-payment form state. Default amount to remaining balance (or full
  // line total if nothing has been paid yet).
  const defaultAmount =
    row.remaining > 0 ? row.remaining.toFixed(2) : row.lineTotal.toFixed(2)
  const [method, setMethod] = useState('')
  const [amount, setAmount] = useState(defaultAmount)
  const [paidAt, setPaidAt] = useState(todayIsoDate())
  const [note, setNote] = useState('')

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    startTransition(async () => {
      const result: AddPaymentResult = await addExpensePayment({
        expense_id: row.id,
        payment_method: method,
        amount,
        paid_at: paidAt,
        note,
      })

      if (result.ok) {
        setSuccess('Payment recorded.')
        // Clear method + note, leave date sticky for batch entry.
        setMethod('')
        setNote('')
        setAmount('')
        router.refresh()
        return
      }

      if (result.reason === 'invalid') {
        setError(result.issues.map((i) => i.message).join('; '))
        return
      }
      setError(result.message)
    })
  }

  function handleDelete(paymentId: string) {
    if (
      !window.confirm(
        'Delete this payment? The expense status will be recomputed.'
      )
    ) {
      return
    }
    setError(null)
    setSuccess(null)
    startTransition(async () => {
      const result: DeletePaymentResult = await deleteExpensePayment({
        payment_id: paymentId,
      })
      if (result.ok) {
        setSuccess('Payment deleted.')
        router.refresh()
        return
      }
      if (result.reason === 'invalid') {
        setError(result.issues.map((i) => i.message).join('; '))
        return
      }
      setError(result.message)
    })
  }

  const fullyPaid = row.remaining < 0.01 && row.lineTotal > 0

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      {/* Header strip */}
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-zinc-900 dark:text-zinc-100">
            {row.item || <span className="italic text-zinc-500">—</span>}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {row.qty} × {fmtUSD(row.price)} ={' '}
            <strong className="tabular-nums text-zinc-700 dark:text-zinc-300">
              {fmtUSD(row.lineTotal)}
            </strong>
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="tabular-nums text-zinc-600 dark:text-zinc-400">
            {fmtUSD(row.paid)} paid /{' '}
            <span
              className={
                row.remaining > 0.01
                  ? 'text-amber-700 dark:text-amber-300'
                  : 'text-zinc-500'
              }
            >
              {fmtUSD(row.remaining)} left
            </span>
          </span>
          <StatusBadge status={row.status} />
        </div>
      </div>

      {/* Existing payments */}
      {row.payments.length > 0 ? (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-900">
          {row.payments.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center gap-3 px-4 py-2 text-sm"
            >
              <span className="tabular-nums font-medium text-zinc-900 dark:text-zinc-100">
                {fmtUSD(p.amount)}
              </span>
              <span className="text-zinc-600 dark:text-zinc-400">
                via <span className="font-medium">{p.payment_method}</span>
              </span>
              <span className="text-xs text-zinc-500 dark:text-zinc-500">
                {fmtDate(p.paid_at)}
              </span>
              {p.status !== 'confirmed' && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
                  {p.status}
                </span>
              )}
              {p.note ? (
                <span className="truncate text-xs italic text-zinc-500 dark:text-zinc-400">
                  “{p.note}”
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => handleDelete(p.id)}
                disabled={pending}
                className="ml-auto rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-zinc-900 dark:hover:text-red-300"
                aria-label={`Delete payment of ${fmtUSD(p.amount)}`}
                title="Delete payment"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {/* Add payment form (hidden when fully paid) */}
      {fullyPaid ? (
        <p className="border-t border-zinc-100 px-4 py-3 text-xs text-emerald-700 dark:border-zinc-900 dark:text-emerald-300">
          Fully paid.
        </p>
      ) : (
        <form
          onSubmit={handleAdd}
          className="grid grid-cols-1 gap-2 border-t border-zinc-100 bg-zinc-50/50 p-4 sm:grid-cols-[1fr_120px_140px_auto] dark:border-zinc-900 dark:bg-zinc-900/30"
        >
          <input
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            placeholder="Method (Zelle, cash, check #1234…)"
            maxLength={80}
            required
            className={inputCls}
          />
          <input
            type="number"
            inputMode="decimal"
            min={0.01}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount"
            required
            className={inputCls}
          />
          <input
            type="date"
            value={paidAt}
            onChange={(e) => setPaidAt(e.target.value)}
            className={inputCls}
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {pending ? 'Adding…' : 'Add payment'}
          </button>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional)"
            maxLength={500}
            className={`sm:col-span-4 ${inputCls}`}
          />
        </form>
      )}

      {/* Error / success banners — kept inside the card so multi-row
          interactions don't leak status across cards. */}
      {error && (
        <p className="border-t border-red-200 bg-red-50 px-4 py-2 text-xs text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      )}
      {success && (
        <p className="border-t border-emerald-200 bg-emerald-50 px-4 py-2 text-xs text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200">
          {success}
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Bits + bobs
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: 'unpaid' | 'paid' }) {
  const cls =
    status === 'paid'
      ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200'
      : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${cls}`}
    >
      {status}
    </span>
  )
}

const inputCls =
  'rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 shadow-sm outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-500 dark:focus:ring-zinc-700'

function fmtUSD(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0)
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return iso
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function todayIsoDate(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}
