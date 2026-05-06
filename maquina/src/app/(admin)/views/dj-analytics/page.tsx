import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { DjAnalyticsToolbar } from './toolbar'

/**
 * DJ Analytics — Phase 16.
 *
 * For each registered DJ: how many *confirmed* events were they slotted
 * into so far this year (year-to-date — events that have already
 * happened), and what percentage of the year's confirmed-and-completed
 * events that represents (DJ's confirmed events ÷ year-to-date confirmed
 * events). Tentative events are ignored throughout, and future-confirmed
 * events don't count yet — this view is about what's actually been played.
 *
 * Counts are *distinct events*, so a DJ playing two stages or two slots
 * at the same event still counts once for that event. This matches how
 * a booker thinks about it ("Marie played 8 shows last year") rather
 * than the raw slot row count.
 *
 * URL state:
 *   ?year=YYYY              (default = current year)
 *   ?sort=count|name|pct    (default = count desc)
 *
 * Auth gate is owned by the (admin) layout.
 */
export default async function DjAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{
    year?: string
    sort?: string
  }>
}) {
  const sp = await searchParams
  const now = new Date()
  const year = parseIntInRange(sp.year, 2000, 2100, now.getFullYear())
  const sort: SortKey =
    sp.sort === 'name' || sp.sort === 'pct' ? sp.sort : 'count'

  // YTD bounds: from Jan 1 of the selected year up through *today*.
  // "Confirmed events so far this year" means events that have actually
  // happened, not future-confirmed bookings. If the selected year is in
  // the past, lastISO clamps to Dec 31 of that year. If it's a future
  // year, the range is empty (and the page just shows zero).
  const firstISO = `${year}-01-01`
  const todayISO = new Date().toISOString().slice(0, 10)
  const yearEndISO = `${year}-12-31`
  const lastISO = todayISO < yearEndISO ? todayISO : yearEndISO

  const supabase = await createServerSupabaseClient()

  // Pull every DJ once. We list every registered DJ — even if they
  // weren't booked this year — so the booker can see who's been idle.
  const { data: djs } = await supabase
    .from('djs')
    .select('id, dj_name, region, rank')
    .order('dj_name', { ascending: true })

  // Confirmed events for the year. Tentative events are explicitly
  // excluded — both the per-DJ event count and the percentage
  // denominator are confirmed-only.
  const { data: yearEvents } = await supabase
    .from('events')
    .select('id')
    .eq('status', 'confirmed')
    .gte('date', firstISO)
    .lte('date', lastISO)

  const confirmedEventIds = new Set<string>()
  for (const e of yearEvents ?? []) {
    confirmedEventIds.add(e.id)
  }
  const eventIds = Array.from(confirmedEventIds)
  const totalConfirmedThisYear = confirmedEventIds.size

  let slots: { dj_id: string; event_id: string }[] = []
  if (eventIds.length > 0) {
    const { data } = await supabase
      .from('event_dj_slots')
      .select('dj_id, event_id')
      .in('event_id', eventIds)
    slots = data ?? []
  }

  // Roll up to per-DJ counts of *distinct* confirmed events. The slot
  // query was already scoped to confirmedEventIds, but we still dedupe
  // here in case a DJ plays multiple stages of the same event.
  const eventsByDj = new Map<string, Set<string>>()
  for (const row of slots) {
    if (!confirmedEventIds.has(row.event_id)) continue
    const set = eventsByDj.get(row.dj_id) ?? new Set<string>()
    set.add(row.event_id)
    eventsByDj.set(row.dj_id, set)
  }

  type Row = {
    id: string
    djName: string
    region: string
    rank: string | null
    confirmed: number
    pct: number // 0..100, integer
  }

  const rows: Row[] = (djs ?? []).map((d) => {
    const confirmed = eventsByDj.get(d.id)?.size ?? 0
    const pct =
      totalConfirmedThisYear === 0
        ? 0
        : Math.round((confirmed / totalConfirmedThisYear) * 100)
    return {
      id: d.id,
      djName: d.dj_name,
      region: d.region,
      rank: d.rank ?? null,
      confirmed,
      pct,
    }
  })

  // Sort. Secondary sort is always dj_name ascending so output is
  // stable when the primary key ties.
  rows.sort((a, b) => {
    if (sort === 'name') return a.djName.localeCompare(b.djName)
    if (sort === 'pct') {
      if (b.pct !== a.pct) return b.pct - a.pct
      return a.djName.localeCompare(b.djName)
    }
    // sort === 'count'
    if (b.confirmed !== a.confirmed) return b.confirmed - a.confirmed
    return a.djName.localeCompare(b.djName)
  })

  const yearRange = buildYearRange(year)
  const bookedDjCount = rows.filter((r) => r.confirmed > 0).length

  return (
    <div className="flex-1 px-4 py-6 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            DJ analytics
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {year} · {bookedDjCount}{' '}
            {bookedDjCount === 1 ? 'DJ' : 'DJs'} booked across{' '}
            {totalConfirmedThisYear}{' '}
            {totalConfirmedThisYear === 1
              ? 'confirmed event'
              : 'confirmed events'}{' '}
            so far
          </p>
        </header>

        <DjAnalyticsToolbar
          year={year}
          sort={sort}
          yearRange={yearRange}
        />

        {rows.length === 0 ? (
          <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-6 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
            No DJs registered yet.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold">DJ</th>
                  <th className="px-4 py-2 text-left font-semibold">Region</th>
                  <th className="px-4 py-2 text-right font-semibold">
                    Confirmed events
                  </th>
                  <th className="px-4 py-2 text-right font-semibold">
                    % of year
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                  >
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/djs/${r.id}`}
                        className="font-medium text-zinc-900 hover:underline dark:text-zinc-100"
                      >
                        {r.djName}
                      </Link>
                      {r.rank ? (
                        <span className="ml-2 rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                          {r.rank}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2.5 text-zinc-600 dark:text-zinc-400">
                      {r.region}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-zinc-900 dark:text-zinc-100">
                      {r.confirmed}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      <PctCell pct={r.pct} hasData={r.confirmed > 0} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type SortKey = 'count' | 'name' | 'pct'

function PctCell({ pct, hasData }: { pct: number; hasData: boolean }) {
  if (!hasData) {
    return <span className="text-zinc-400 dark:text-zinc-600">—</span>
  }
  // Thresholds tuned for "share of the year's confirmed events": ≥30%
  // is a workhorse, ≥10% is a regular, below that is occasional.
  const cls =
    pct >= 30
      ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200'
      : pct >= 10
        ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200'
        : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      {pct}%
    </span>
  )
}

function parseIntInRange(
  raw: string | undefined,
  lo: number,
  hi: number,
  fallback: number
): number {
  if (!raw) return fallback
  const n = parseInt(raw, 10)
  if (!Number.isFinite(n) || n < lo || n > hi) return fallback
  return n
}

function buildYearRange(selected: number) {
  const now = new Date().getFullYear()
  const start = Math.min(now - 1, selected - 1)
  const end = Math.max(now + 2, selected + 1)
  const out: number[] = []
  for (let y = start; y <= end; y++) out.push(y)
  return out
}
