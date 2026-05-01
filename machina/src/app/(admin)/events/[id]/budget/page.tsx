import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { BudgetForm } from './budget-form'

/**
 * Admin budget page (Phase 9 — estimated only).
 *
 * Loads the event's estimated budget plus all dependent rows in one
 * Promise.all, then hands them to <BudgetForm /> which owns the editable
 * UI and the live income summary.
 *
 * If the event was created before Phase 9 shipped and somehow lacks an
 * estimated budget row, we 404 — Phase 10 (final budgets) will introduce
 * a "create budget" path. The seed data and current createEvent always
 * write the row, so the only realistic case for this branch is a
 * partially-failed legacy insert; we want to surface it loudly rather
 * than silently auto-create.
 */
export default async function BudgetPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()

  const { data: event, error: eventErr } = await supabase
    .from('events')
    .select(
      'id, event_id, title, date, city, state, type, status, split_pct, bar_included'
    )
    .eq('id', id)
    .maybeSingle()

  if (eventErr || !event) notFound()

  // Estimated budget for this event. Older code paths may not have
  // created one — surface the gap with notFound() rather than silently
  // bootstrapping (we'll revisit the bootstrap once Phase 10 exists).
  const { data: budget } = await supabase
    .from('event_budgets')
    .select(
      'id, drop_off, guests, deductions, sponsor_income, vendor_income, merch_gross, merch_pct_after_fees, merch_cogs_pct, merch_seller_fee'
    )
    .eq('event_id', id)
    .eq('budget_type', 'estimated')
    .maybeSingle()

  if (!budget) notFound()

  const [{ data: expenses }, { data: tiers }] = await Promise.all([
    supabase
      .from('event_budget_expenses')
      .select('id, category, item, qty, price')
      .eq('budget_id', budget.id)
      .order('category', { ascending: true })
      .order('item', { ascending: true }),
    supabase
      .from('event_tix_tiers')
      .select('id, tier_number, price, sold')
      .eq('budget_id', budget.id)
      .order('tier_number', { ascending: true }),
  ])

  return (
    <div className="flex-1 px-8 py-10">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <Link
            href={`/events/${id}/edit`}
            className="text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            ← Back to event
          </Link>
        </div>

        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Estimated budget
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

        <BudgetForm
          event={{
            id: event.id as string,
            split_pct: Number(event.split_pct ?? 0),
            bar_included: !!event.bar_included,
          }}
          budget={{
            id: budget.id as string,
            drop_off: Number(budget.drop_off ?? 0),
            guests: Number(budget.guests ?? 0),
            deductions: Number(budget.deductions ?? 0),
            sponsor_income: Number(budget.sponsor_income ?? 0),
            vendor_income: Number(budget.vendor_income ?? 0),
            merch_gross: Number(budget.merch_gross ?? 400),
            merch_pct_after_fees: Number(budget.merch_pct_after_fees ?? 0.97),
            merch_cogs_pct: Number(budget.merch_cogs_pct ?? 0.35),
            merch_seller_fee: Number(budget.merch_seller_fee ?? 120),
          }}
          initialExpenses={(expenses ?? []).map((e) => ({
            id: e.id as string,
            category: e.category as string,
            item: e.item as string,
            qty: e.qty == null ? '0' : String(e.qty),
            price: e.price == null ? '0' : String(e.price),
          }))}
          initialTiers={(tiers ?? []).map((t) => ({
            id: t.id as string,
            tier_number: t.tier_number as number,
            price: t.price == null ? '0' : String(t.price),
            sold: t.sold == null ? '0' : String(t.sold),
          }))}
        />
      </div>
    </div>
  )
}
