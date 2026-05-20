import Link from 'next/link'
import { isPastDate } from '@/lib/utils'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { fetchSlotCounts, DjFractionBadge } from '@/components/dj-fraction'
import { ViewToolbar } from '../_components/view-toolbar'

/**
 * Year View. Lists every event in the selected year, grouped by month
 * so admins can see the full annual cadence at a glance.
 *
 * URL state:
 *   ?year=YYYY (default = current year)
 *   ?confirmed_only=1 (default = off)
 *
 * Each row links to /events/[id]/edit.
 */
export default async function YearViewPage({
  searchParams,
}: {
  searchParams: Promise<{
    year?: string
    confirmed_only?: string
  }>
}) {
  const sp = await searchParams
  const now = new Date()
  const year = parseIntInRange(sp.year, 2000, 2100, now.getFullYear())
  const confirmedOnly = sp.confirmed_only === '1'

  const firstISO = `${year}-01-01`
  const lastISO = `${year}-12-31`

  const supabase = await createServerSupabaseClient()
  let q = supabase
    .from('events')
    .select(
      'id, date, day_of_week, weekend_number, title, type, status, city, state, venues(name)'
    )
    .gte('date', firstISO)
    .lte('date', lastISO)
    .order('date', { ascending: true })

  if (confirmedOnly) q = q.eq('status', 'confirmed')

  const { data: rawEvents } = await q

  type RawEvent = {
    id: string
    date: string
    day_of_week: string
    weekend_number: number
    title: string
    type: string
    status: string
    city: string
    state: string
    venues: { name: string } | { name: string }[] | null
  }

  const events = ((rawEvents ?? []) as RawEvent[]).map((e) => ({
    ...e,
    venueName: Array.isArray(e.venues) ? e.venues[0]?.name : e.venues?.name,
  }))

  const slotCounts = await fetchSlotCounts(supabase, events.map((e) => e.id))

  // Group events by month index (0..11). Months with no events are kept
  // out of the render path entirely.
  const byMonth = new Map<number, typeof events>()
  for (const e of events) {
    const m = Number(e.date.slice(5, 7)) - 1
    const arr = byMonth.get(m)
    if (arr) arr.push(e)
    else byMonth.set(m, [e])
  }
  const monthsWithEvents = [...byMonth.keys()].sort((a, b) => a - b)

  const yearRange = buildYearRange(year)

  return (
    <div className="flex-1 px-4 py-6 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Year view</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {year} · {events.length}{' '}
            {events.length === 1 ? 'event' : 'events'}
            {confirmedOnly ? ' (confirmed only)' : ''}
          </p>
        </header>

        <ViewToolbar
          showMonth={false}
          year={year}
          month={1}
          confirmedOnly={confirmedOnly}
          yearRange={yearRange}
        />

        {events.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-10 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
            No events in {year}
            {confirmedOnly ? ' (confirmed only)' : ''}.
          </div>
        ) : (
          <div className="space-y-8">
            {monthsWithEvents.map((m) => {
              const monthEvents = byMonth.get(m)!
              return (
                <section key={m} className="space-y-3">
                  <h2 className="flex items-baseline gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    <span>{MONTH_NAMES[m]}</span>
                    <span className="text-xs font-normal text-zinc-500 dark:text-zinc-500">
                      {monthEvents.length}{' '}
                      {monthEvents.length === 1 ? 'event' : 'events'}
                    </span>
                  </h2>

                  <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
                    <table className="w-full text-sm">
                      <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                        <tr>
                          <th className="px-4 py-2.5 font-medium">Date</th>
                          <th className="px-4 py-2.5 font-medium">Day</th>
                          <th className="px-4 py-2.5 font-medium">Title</th>
                          <th className="px-4 py-2.5 font-medium">Venue</th>
                          <th className="px-4 py-2.5 font-medium">City</th>
                          <th className="px-4 py-2.5 font-medium">State</th>
                          <th className="px-4 py-2.5 font-medium">Status</th>
                          <th className="px-4 py-2.5 font-medium text-right">DJs</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
                        {monthEvents.map((e) => (
                          <tr
                            key={e.id}
                            className={`hover:bg-zinc-50 dark:hover:bg-zinc-900/50 ${
                              isPastDate(e.date) ? 'opacity-45' : ''
                            }`}
                          >
                            <td className="whitespace-nowrap px-4 py-3 text-zinc-700 dark:text-zinc-300">
                              <Link
                                href={`/events/${e.id}/edit`}
                                className="block"
                              >
                                {new Date(
                                  `${e.date}T00:00:00`
                                ).toLocaleDateString(undefined, {
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </Link>
                            </td>
                            <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                              <Link
                                href={`/events/${e.id}/edit`}
                                className="block"
                              >
                                {e.day_of_week}
                              </Link>
                            </td>
                            <td className="px-4 py-3">
                              <Link
                                href={`/events/${e.id}/edit`}
                                className="font-medium text-zinc-900 hover:underline dark:text-zinc-100"
                              >
                                {e.title}
                              </Link>
                            </td>
                            <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                              <Link
                                href={`/events/${e.id}/edit`}
                                className="block"
                              >
                                {e.venueName ?? '—'}
                              </Link>
                            </td>
                            <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                              <Link
                                href={`/events/${e.id}/edit`}
                                className="block"
                              >
                                {e.city}
                              </Link>
                            </td>
                            <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                              <Link
                                href={`/events/${e.id}/edit`}
                                className="block"
                              >
                                {e.state}
                              </Link>
                            </td>
                            <td className="px-4 py-3">
                              <Link
                                href={`/events/${e.id}/edit`}
                                className="block"
                              >
                                <StatusBadge status={e.status} />
                              </Link>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Link
                                href={`/events/${e.id}/edit`}
                                className="block"
                              >
                                <DjFractionBadge
                                  {...(slotCounts.get(e.id) ?? { filled: 0, total: 0 })}
                                />
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseIntInRange(
  raw: string | undefined,
  lo: number,
  hi: number,
  fallback: number
): number {
  if (!raw) return fallback
  const n = Number(raw)
  if (!Number.isInteger(n) || n < lo || n > hi) return fallback
  return n
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

/** ±5 years around the selected year, capped at the current year + 3. */
function buildYearRange(selected: number) {
  const now = new Date().getFullYear()
  const lo = Math.min(selected, now) - 5
  const hi = Math.max(selected, now) + 3
  const out: number[] = []
  for (let y = lo; y <= hi; y++) out.push(y)
  return out
}

function StatusBadge({ status }: { status: string }) {
  const isConfirmed = status === 'confirmed'
  return (
    <span
      className={
        isConfirmed
          ? 'rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200'
          : 'rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-200'
      }
    >
      {status}
    </span>
  )
}
