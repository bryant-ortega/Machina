import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'

/**
 * Admin events index. Lists every event, upcoming first, with the most
 * actionable columns visible inline. Each row links into the edit form
 * (/events/[id]/edit) which is the workhorse page for the rest of the
 * platform.
 *
 * Sort order:
 *   Strict ascending by date — soonest date first, latest date last.
 *   Event status (draft/published/etc.) and past-vs-future have no
 *   effect on order.
 *
 * Calendar/Month/Year views ship in Phase 8.
 *
 * The green "Created event …" flash banner is shown when the URL carries
 * `?created=<event_code>` — emitted by the create form's success redirect.
 *
 * Auth gate: handled by the (admin) layout.
 */
export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string }>
}) {
  const { created } = await searchParams
  const supabase = await createServerSupabaseClient()

  // Pull every column the table needs, plus the joined venue name. The
  // events table is small (one row per event), so an unbounded fetch is
  // fine here — paginate later if/when this grows past a thousand rows.
  const { data: rawEvents } = await supabase
    .from('events')
    .select(
      'id, date, event_id, title, type, status, stages, weekend_flag, city, state, venues(name)'
    )

  type RawEvent = {
    id: string
    date: string
    event_id: string
    title: string
    type: string
    status: string
    stages: number
    weekend_flag: string
    city: string
    state: string
    venues: { name: string } | { name: string }[] | null
  }

  // Strict ascending by ISO date string — soonest first, latest last.
  // Status and past/future have no effect on order.
  const events = ((rawEvents ?? []) as RawEvent[])
    .map((e) => ({
      ...e,
      venueName: Array.isArray(e.venues) ? e.venues[0]?.name : e.venues?.name,
    }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

  return (
    <div className="flex-1 px-4 py-6 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Events</h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {events.length}{' '}
              {events.length === 1 ? 'event' : 'events'} total. Upcoming first.
            </p>
          </div>
          <Link
            href="/events/new"
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            + New event
          </Link>
        </div>

        {created ? (
          <div className="rounded-md border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200">
            ✓ Created event{' '}
            <span className="font-mono font-semibold">{created}</span>
          </div>
        ) : null}

        {/* Mobile: card list. Desktop: full table below. */}
        {events.length === 0 ? (
          <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-6 text-sm text-zinc-600 md:hidden dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
            No events yet.{' '}
            <Link
              href="/events/new"
              className="underline hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              Create the first one.
            </Link>
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
                      <WeekendBadge flag={e.weekend_flag} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                    <span>
                      {new Date(`${e.date}T00:00:00`).toLocaleDateString(
                        undefined,
                        { year: 'numeric', month: 'short', day: 'numeric' }
                      )}
                    </span>
                    <span className="font-mono">{e.event_id}</span>
                  </div>
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
                <th className="px-4 py-2.5 font-medium">Event ID</th>
                <th className="px-4 py-2.5 font-medium">Title</th>
                <th className="px-4 py-2.5 font-medium">Venue</th>
                <th className="px-4 py-2.5 font-medium">City</th>
                <th className="px-4 py-2.5 font-medium">Type</th>
                <th className="px-4 py-2.5 font-medium">Stages</th>
                <th className="px-4 py-2.5 font-medium">Weekend</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
              {events.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-10 text-center text-zinc-500 dark:text-zinc-400"
                  >
                    No events yet.{' '}
                    <Link
                      href="/events/new"
                      className="underline hover:text-zinc-900 dark:hover:text-zinc-100"
                    >
                      Create the first one.
                    </Link>
                  </td>
                </tr>
              ) : (
                events.map((e) => (
                  <tr
                    key={e.id}
                    className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-zinc-700 dark:text-zinc-300">
                      <Link
                        href={`/events/${e.id}/edit`}
                        className="block"
                      >
                        {new Date(`${e.date}T00:00:00`).toLocaleDateString(
                          undefined,
                          {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          }
                        )}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                      <Link href={`/events/${e.id}/edit`} className="block">
                        {e.event_id}
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
                    <td className="whitespace-nowrap px-4 py-3 text-zinc-700 dark:text-zinc-300">
                      <Link
                        href={`/events/${e.id}/edit`}
                        className="block"
                      >
                        {e.city}, {e.state}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                      <Link
                        href={`/events/${e.id}/edit`}
                        className="block capitalize"
                      >
                        {e.type}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                      <Link
                        href={`/events/${e.id}/edit`}
                        className="block"
                      >
                        {e.stages}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/events/${e.id}/edit`}
                        className="block"
                      >
                        <WeekendBadge flag={e.weekend_flag} />
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

function WeekendBadge({ flag }: { flag: string }) {
  const good = flag === 'good'
  return (
    <span
      className={
        good
          ? 'rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200'
          : 'rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
      }
    >
      {flag}
    </span>
  )
}
