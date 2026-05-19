import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Shared helpers for the "DJs" fraction column shown on the events
 * index, month view, and year view.
 *
 * "Filled" = a slot whose linked DJ is NOT the system placeholder
 * named 'TBD'. We treat null `dj_id` (shouldn't happen today, but
 * future-proof) and a DJ named 'TBD' as unfilled.
 *
 * Colors:
 *   - 0 total slots          → gray "—" (nothing to track yet)
 *   - filled < total         → yellow (still booking)
 *   - filled === total > 0   → green (fully booked)
 */

export type DjFraction = {
  filled: number
  total: number
}

/**
 * One round trip per page: fetches every slot for the given events
 * and the linked DJ's name, then rolls them up into a Map keyed by
 * event_id. Pass the result directly to <DjFractionBadge />.
 */
export async function fetchSlotCounts(
  supabase: SupabaseClient,
  eventIds: string[]
): Promise<Map<string, DjFraction>> {
  const counts = new Map<string, DjFraction>()
  if (eventIds.length === 0) return counts

  const { data } = await supabase
    .from('event_dj_slots')
    .select('event_id, djs(dj_name)')
    .in('event_id', eventIds)

  type Row = {
    event_id: string
    djs: { dj_name: string } | { dj_name: string }[] | null
  }

  for (const r of (data ?? []) as Row[] ) {
    const entry = counts.get(r.event_id) ?? { filled: 0, total: 0 }
    entry.total += 1
    const dj = Array.isArray(r.djs) ? r.djs[0] : r.djs
    const name = dj?.dj_name?.trim()
    if (name && name !== 'TBD') entry.filled += 1
    counts.set(r.event_id, entry)
  }
  return counts
}

/**
 * Renders the "filled/total" badge. Color follows the rules in the
 * module-header comment.
 */
export function DjFractionBadge({ filled, total }: DjFraction) {
  if (total === 0) {
    return (
      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500">
        —
      </span>
    )
  }
  const isComplete = filled === total
  const cls = isComplete
    ? 'rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200'
    : 'rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-200'
  return (
    <span className={cls} aria-label={`${filled} of ${total} DJ slots assigned`}>
      {filled}/{total}
    </span>
  )
}
