import Link from 'next/link'
import { isPastDate } from '@/lib/utils'
import { createServerSupabaseClient } from '@/lib/supabase/server'

/**
 * Collab events list — Phase 13.
 *
 * Shows every event the collab is attached to via event_collaborators.
 * The filtering is enforced by RLS (events_select_collab policy), so
 * this query reads the events table directly without an explicit join —
 * RLS only returns rows the user is allowed to see.
 *
 * Defense-in-depth: even though the (collab) layout already gates on
 * role, an admin or DJ accessing /collab/events would still see
 * whatever events RLS lets them see (admins see everything; DJs see
 * none from this route since djs aren't in event_collaborators). So
 * the worst case for a misrouted user is a list that doesn't match
 * their role expectations, never a leak.
 */
export default async function CollabEventsPage() {
  const supabase = await createServerSupabaseClient()

  const { data: rawEvents } = await supabase
    .from('events')
    .select(
      'id, event_id, title, date, day_of_week, status, type, city, state, doors_time, venues(name)'
    )
    .order('date', { ascending: true })

  type RawEvent = {
    id: string
    event_id: string
    title: string
    date: string
    day_of_week: string
    status: string
    type: string
    city: string
    state: string
    doors_time: string | null
    venues: { name: string } | { name: string }[] | null
  }

  const events = ((rawEvents ?? []) as RawEvent[]).map((e) => ({
    ...e,
    venueName: Array.isArray(e.venues) ? e.venues[0]?.name : e.venues?.name,
  }))

  return (
    <div className="flex-1 px-4 py-6 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Your events</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {events.length === 0
              ? 'No events attached yet. Check back later, or contact LosGothsCo if you expected something here.'
              : `${events.length} ${events.length === 1 ? 'event' : 'events'} you're collaborating on.`}
          </p>
        </header>

        {/* Mobile: card list. Desktop: full table below. */}
        {events.length > 0 && (
          <ul className="space-y-2 md:hidden">
            {events.map((e) => (
              <li
                key={`m-${e.id}`}
                className={`rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950 ${
                  isPastDate(e.date) ? 'opacity-45' : ''
                }`}
              >
                <Link
                  href={`/collab/events/${e.id}`}
                  className="flex flex-col gap-1.5 px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 flex-1 truncate font-medium text-zinc-900 dark:text-zinc-100">
                      {e.title || '—'}
                    </p>
                    <span
                      className={
                        e.status === 'confirmed'
                          ? 'shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200'
                          : 'shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                      }
                    >
                      {e.status}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {new Date(`${e.date}T00:00:00`).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                    {' · '}
                    {e.venueName ?? '—'}
                    {' · '}
                    {e.city}
                    {e.state ? `, ${e.state}` : ''}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {events.length > 0 && (
          <div className="hidden overflow-hidden rounded-xl border border-zinc-200 bg-white md:block dark:border-zinc-800 dark:bg-zinc-950">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Date</th>
                  <th className="px-4 py-2.5 font-medium">Title</th>
                  <th className="px-4 py-2.5 font-medium">Venue</th>
                  <th className="px-4 py-2.5 font-medium">Location</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
                {events.map((e) => (
                  <tr
                    key={e.id}
                    className={`hover:bg-zinc-50 dark:hover:bg-zinc-900 ${
                      isPastDate(e.date) ? 'opacity-45' : ''
                    }`}
                  >
                    <td className="px-4 py-3 font-mono text-xs tabular-nums text-zinc-700 dark:text-zinc-300">
                      <Link
                        href={`/collab/events/${e.id}`}
                        className="hover:underline"
                      >
                        {new Date(`${e.date}T00:00:00`).toLocaleDateString(
                          undefined,
                          {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          }
                        )}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                      <Link
                        href={`/collab/events/${e.id}`}
                        className="hover:underline"
                      >
                        {e.title || '—'}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                      {e.venueName ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                      {e.city}
                      {e.state ? `, ${e.state}` : ''}
                    </td>
                    <td
                      className={
                        e.status === 'confirmed'
                          ? 'px-4 py-3 text-xs font-medium text-emerald-700 dark:text-emerald-400'
                          : 'px-4 py-3 text-xs font-medium text-zinc-500 dark:text-zinc-400'
                      }
                    >
                      {e.status}
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
