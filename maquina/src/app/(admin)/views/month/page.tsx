import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { fetchSlotCounts, DjFractionBadge } from '@/components/dj-fraction'
import { ViewToolbar } from '../_components/view-toolbar'

/**
 * Month View. Lists every event in the selected month, ordered by
 * weekend_number then date so admins can see "what's happening this
 * weekend" at a glance.
 *
 * URL state:
 *   ?year=YYYY (default = current year)
 *   ?month=1..12 (default = current month)
 *   ?confirmed_only=1 (default = off)
 *
 * Each row links to /events/[id]/edit.
 */
export default async function MonthViewPage({
  searchParams,
}: {
  searchParams: Promise<{
    year?: string
    month?: string
    confirmed_only?: string
  }>
}) {
  const sp = await searchParams
  const now = new Date()
  const year = parseIntInRange(sp.year, 2000, 2100, now.getFullYear())
  const month = parseIntInRange(sp.month, 1, 12, now.getMonth() + 1)
  const confirmedOnly = sp.confirmed_only === '1'

  const { firstISO, lastISO } = monthBounds(year, month)

  const supabase = await createServerSupabaseClient()
  let q = supabase
    .from('events')
    .select(
      'id, date, day_of_week, weekend_number, title, type, status, city, state, venues(name)'
    )
    .gte('date', firstISO)
    .lte('date', lastISO)
    .order('weekend_number', { ascending: true })
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

  const monthName = MONTH_NAMES[month - 1]
  const yearRange = buildYearRange(year)

  return (
    <div className="flex-1 px-4 py-6 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Month view</h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {monthName} {year} · {events.length}{' '}
              {events.length === 1 ? 'event' : 'events'}
              {confirmedOnly ? ' (confirmed only)' : ''}
            </p>
          </div>
          <a
            href={`/api/pdf?view=month&year=${year}&month=${month}${
              confirmedOnly ? '&confirmed_only=1' : ''
            }`}
            className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Export PDF
          </a>
        </header>

        <ViewToolbar
          showMonth
          year={year}
          month={month}
          confirmedOnly={confirmedOnly}
          yearRange={yearRange}
        />

        {/* Mobile: card list. Desktop: full table below. */}
        {events.length === 0 ? (
          <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-6 text-sm text-zinc-600 md:hidden dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
            No events in {monthName} {year}.
          </div>
        ) : (
          <ul className="space-y-2 md:hidden">
            {events.map((e) => (
              <li
                key={`m-${e.id}`}
                className="rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
              >
                <Link
                  href={`/events/${e.id}/edit`}
                  className="flex flex-col gap-1.5 px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-zinc-900 dark:text-zinc-100">
                        {e.title || '—'}
                      </p>
                      <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                        {e.venueName ?? '—'} · {e.city}, {e.state}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <StatusBadge status={e.status} />
                      <DjFractionBadge
                        {...(slotCounts.get(e.id) ?? { filled: 0, total: 0 })}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {e.day_of_week} ·{' '}
                    {new Date(`${e.date}T00:00:00`).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <div className="hidden overflow-hidden rounded-xl border border-zinc-200 bg-white md:block dark:border-zinc-800 dark:bg-zinc-950">
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
              {events.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-10 text-center text-zinc-500 dark:text-zinc-400"
                  >
                    No events in {monthName} {year}.
                  </td>
                </tr>
              ) : (
                events.map((e) => (
                  <tr
                    key={e.id}
                    className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-zinc-700 dark:text-zinc-300">
                      <Link href={`/events/${e.id}/edit`} className="block">
                        {new Date(`${e.date}T00:00:00`).toLocaleDateString(
                          undefined,
                          { month: 'short', day: 'numeric' }
                        )}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                      <Link href={`/events/${e.id}/edit`} className="block">
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
                      <Link href={`/events/${e.id}/edit`} className="block">
                        {e.venueName ?? '—'}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                      <Link href={`/events/${e.id}/edit`} className="block">
                        {e.city}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                      <Link href={`/events/${e.id}/edit`} className="block">
                        {e.state}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/events/${e.id}/edit`} className="block">
                        <StatusBadge status={e.status} />
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/events/${e.id}/edit`} className="block">
                        <DjFractionBadge
                          {...(slotCounts.get(e.id) ?? { filled: 0, total: 0 })}
                        />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
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

function monthBounds(year: number, month: number) {
  const pad = (n: number) => String(n).padStart(2, '0')
  // First of month, last calendar day of month — using the JS Date math
  // trick (day=0 of next month = last day of this month). UTC-anchored
  // construction so we never drift across timezones.
  const first = `${year}-${pad(month)}-01`
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const last = `${year}-${pad(month)}-${pad(lastDay)}`
  return { firstISO: first, lastISO: last }
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
