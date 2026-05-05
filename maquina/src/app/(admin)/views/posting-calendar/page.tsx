import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ViewToolbar } from '../_components/view-toolbar'

/**
 * Posting calendar — Phase 15.
 *
 * Lists every event's *action dates* (announce, begin art, art due,
 * on sale) flattened into a single chronological list. Useful for the
 * social/design team — "what's due this week" — separate from the
 * month/year operational views.
 *
 * URL state:
 *   ?year=YYYY              (default = current year)
 *   ?month=1..12            (default = current month)
 *   ?confirmed_only=1       (default = off)
 *
 * Filter logic: we pull every event whose date is in the selected
 * year, then keep only those events with at least one *action date*
 * inside the selected month bounds. This way an event happening in
 * December that has its announce date in October will show up under
 * October correctly. Status filter is plain — drop tentative events
 * when set.
 *
 * Auth gate is owned by the (admin) layout.
 */
export default async function PostingCalendarPage({
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
  const yearStart = `${year}-01-01`

  const supabase = await createServerSupabaseClient()
  let q = supabase
    .from('events')
    .select(
      'id, title, status, type, city, state, date, announce_date, begin_art_date, art_due_date, on_sale_date'
    )
    // Include events with their event date in the selected year, but the
    // action dates (which can lead the event by several months) might
    // belong to other years too. We widen the filter to catch lead-time
    // cases by also including events whose announce_date falls in the
    // selected year. In practice this is plenty.
    .or(
      `date.gte.${yearStart},announce_date.gte.${yearStart}`
    )
    .lte('date', `${year + 1}-12-31`)

  if (confirmedOnly) q = q.eq('status', 'confirmed')

  const { data: rawEvents } = await q

  type RawEvent = {
    id: string
    title: string
    status: string
    type: string
    city: string
    state: string
    date: string
    announce_date: string | null
    begin_art_date: string | null
    art_due_date: string | null
    on_sale_date: string | null
  }

  // Flatten action dates into a single list filtered to the month.
  type Action = {
    eventId: string
    eventTitle: string
    eventStatus: string
    eventDate: string
    actionDate: string
    actionType: 'announce' | 'begin_art' | 'art_due' | 'on_sale'
    label: string
  }
  const ACTION_LABELS: Record<Action['actionType'], string> = {
    announce: 'Announce',
    begin_art: 'Begin art',
    art_due: 'Art due',
    on_sale: 'On sale',
  }
  const actions: Action[] = []
  for (const e of (rawEvents ?? []) as RawEvent[]) {
    const fields: Array<{
      type: Action['actionType']
      date: string | null
    }> = [
      { type: 'announce', date: e.announce_date },
      { type: 'begin_art', date: e.begin_art_date },
      { type: 'art_due', date: e.art_due_date },
      { type: 'on_sale', date: e.on_sale_date },
    ]
    for (const f of fields) {
      if (!f.date) continue
      if (f.date < firstISO || f.date > lastISO) continue
      actions.push({
        eventId: e.id,
        eventTitle: e.title,
        eventStatus: e.status,
        eventDate: e.date,
        actionDate: f.date,
        actionType: f.type,
        label: ACTION_LABELS[f.type],
      })
    }
  }
  actions.sort((a, b) => (a.actionDate < b.actionDate ? -1 : 1))

  // Group by date for display.
  const grouped = new Map<string, Action[]>()
  for (const a of actions) {
    const list = grouped.get(a.actionDate) ?? []
    list.push(a)
    grouped.set(a.actionDate, list)
  }

  const monthName = MONTH_NAMES[month - 1]
  const yearRange = buildYearRange(year)

  return (
    <div className="flex-1 px-4 py-6 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Posting calendar
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {monthName} {year} · {actions.length}{' '}
            {actions.length === 1 ? 'action' : 'actions'} due
            {confirmedOnly ? ' (confirmed only)' : ''}
          </p>
        </header>

        <ViewToolbar
          showMonth
          year={year}
          month={month}
          confirmedOnly={confirmedOnly}
          yearRange={yearRange}
        />

        {actions.length === 0 ? (
          <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-6 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
            Nothing scheduled in {monthName} {year}.
          </div>
        ) : (
          <ol className="space-y-4">
            {Array.from(grouped.entries()).map(([date, dayActions]) => (
              <li
                key={date}
                className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
              >
                <header className="border-b border-zinc-200 bg-zinc-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
                  {new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </header>
                <ul className="divide-y divide-zinc-100 dark:divide-zinc-900">
                  {dayActions.map((a, idx) => (
                    <li
                      key={`${a.eventId}-${a.actionType}-${idx}`}
                      className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/events/${a.eventId}/edit`}
                          className="block truncate font-medium text-zinc-900 hover:underline dark:text-zinc-100"
                        >
                          {a.eventTitle}
                        </Link>
                        <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                          Event{' '}
                          {new Date(`${a.eventDate}T00:00:00`).toLocaleDateString(
                            undefined,
                            {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            }
                          )}
                        </p>
                      </div>
                      <ActionBadge type={a.actionType} label={a.label} />
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ActionBadge({
  type,
  label,
}: {
  type: 'announce' | 'begin_art' | 'art_due' | 'on_sale'
  label: string
}) {
  const cls =
    type === 'announce'
      ? 'bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-200'
      : type === 'begin_art'
        ? 'bg-violet-100 text-violet-900 dark:bg-violet-900/40 dark:text-violet-200'
        : type === 'art_due'
          ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200'
          : 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200'
  return (
    <span
      className={`shrink-0 self-start rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      {label}
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

function monthBounds(year: number, month: number) {
  const first = new Date(Date.UTC(year, month - 1, 1))
  const last = new Date(Date.UTC(year, month, 0))
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  return { firstISO: fmt(first), lastISO: fmt(last) }
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

function buildYearRange(selected: number) {
  const now = new Date().getFullYear()
  const start = Math.min(now - 1, selected - 1)
  const end = Math.max(now + 2, selected + 1)
  const out: number[] = []
  for (let y = start; y <= end; y++) out.push(y)
  return out
}
