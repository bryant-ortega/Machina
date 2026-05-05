import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'

/**
 * Admin DJ roster.
 *
 * Sorted A–Z by dj_name. W-9 status pill on every row. Region filter via
 * URL query param (?region=SoCal). An alert banner surfaces at the top
 * whenever any DJ in the result set has w9_status='pending', so the admin
 * sees outstanding paperwork the second they hit the page.
 *
 * Auth: the (admin) layout already enforces role===admin, so this page
 * doesn't repeat that check.
 *
 * Filtering happens server-side. We fetch all DJs once (the roster is
 * small in MVP) and filter in JS, which keeps the count + filter chips
 * accurate even when a region is active.
 */

const REGIONS = [
  'SoCal',
  'NorCal',
  'Chicago',
  'Arizona',
  'Seattle',
  'Other',
] as const
type Region = (typeof REGIONS)[number]

function isRegion(value: string | undefined | null): value is Region {
  return !!value && (REGIONS as readonly string[]).includes(value)
}

export default async function DjRosterPage({
  searchParams,
}: {
  searchParams: Promise<{ region?: string }>
}) {
  const params = await searchParams
  const activeRegion: Region | null = isRegion(params.region)
    ? params.region
    : null

  const supabase = await createServerSupabaseClient()
  const { data: djs, error } = await supabase
    .from('djs')
    .select(
      'id, dj_name, government_name, email, region, w9_status, w9_storage_path, rank'
    )
    .order('dj_name', { ascending: true })

  if (error) {
    return (
      <div className="flex-1 px-4 py-6 sm:px-8 sm:py-10">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-2xl font-semibold tracking-tight">DJs</h1>
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">
            Failed to load roster: {error.message}
          </p>
        </div>
      </div>
    )
  }

  const rows = djs ?? []
  const visible = activeRegion
    ? rows.filter((d) => d.region === activeRegion)
    : rows
  const pendingCount = rows.filter((d) => d.w9_status === 'pending').length

  // Region counts come from the unfiltered set so chip labels are stable.
  const regionCounts = REGIONS.reduce<Record<Region, number>>(
    (acc, r) => {
      acc[r] = rows.filter((d) => d.region === r).length
      return acc
    },
    { SoCal: 0, NorCal: 0, Chicago: 0, Arizona: 0, Seattle: 0, Other: 0 }
  )

  return (
    <div className="flex-1 px-4 py-6 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex items-end justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">DJs</h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {rows.length} {rows.length === 1 ? 'DJ' : 'DJs'} on roster
              {activeRegion && (
                <>
                  {' · '}
                  showing {visible.length} in {activeRegion}
                </>
              )}
            </p>
          </div>
        </header>

        {pendingCount > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
            <strong className="font-semibold">
              {pendingCount} {pendingCount === 1 ? 'DJ has' : 'DJs have'}
            </strong>{' '}
            no W-9 on file yet. They can&apos;t be paid until the form is
            submitted.
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-zinc-500 dark:text-zinc-400">Region:</span>
          <FilterChip href="/djs" active={!activeRegion}>
            All ({rows.length})
          </FilterChip>
          {REGIONS.map((r) => (
            <FilterChip
              key={r}
              href={`/djs?region=${r}`}
              active={activeRegion === r}
            >
              {r} ({regionCounts[r]})
            </FilterChip>
          ))}
        </div>

        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-2.5 font-medium">DJ name</th>
                <th className="px-4 py-2.5 font-medium">Region</th>
                <th className="px-4 py-2.5 font-medium">Rank</th>
                <th className="px-4 py-2.5 font-medium">W-9</th>
                <th className="px-4 py-2.5 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
              {visible.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-10 text-center text-zinc-500 dark:text-zinc-400"
                  >
                    {activeRegion
                      ? `No DJs in ${activeRegion} yet.`
                      : 'No DJs on roster yet.'}
                  </td>
                </tr>
              ) : (
                visible.map((dj) => (
                  <tr
                    key={dj.id}
                    className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/djs/${dj.id}`}
                        className="font-medium text-zinc-900 hover:underline dark:text-zinc-100"
                      >
                        {dj.dj_name}
                      </Link>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {dj.government_name}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                      {dj.region}
                    </td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                      {dj.rank ?? (
                        <span className="text-zinc-400 dark:text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <W9Badge status={dj.w9_status as 'pending' | 'on_file'} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/djs/${dj.id}`}
                        className="text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                      >
                        View →
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

function FilterChip({
  href,
  active,
  children,
}: {
  href: string
  active: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? 'rounded-full bg-zinc-900 px-3 py-1 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900'
          : 'rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900'
      }
    >
      {children}
    </Link>
  )
}

function W9Badge({ status }: { status: 'pending' | 'on_file' }) {
  if (status === 'on_file') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200">
        <span aria-hidden>✓</span>
        On file
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
      <span aria-hidden>⚠</span>
      Pending
    </span>
  )
}
