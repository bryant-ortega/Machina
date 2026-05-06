'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'

/**
 * Toolbar for /views/dj-analytics. Year selector + sort selector. We
 * deliberately don't reuse the shared ViewToolbar because that one is
 * built around a confirmed-only toggle, which doesn't make sense here
 * (the whole point is to compare confirmed vs tentative within the
 * same year).
 */
export function DjAnalyticsToolbar({
  year,
  sort,
  yearRange,
}: {
  year: number
  sort: 'count' | 'name' | 'pct'
  yearRange: number[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  function setParam(updates: Record<string, string | null>) {
    const next = new URLSearchParams(params?.toString() ?? '')
    for (const [k, v] of Object.entries(updates)) {
      if (v === null) next.delete(k)
      else next.set(k, v)
    }
    const qs = next.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <label className="flex items-center gap-2 text-xs font-medium text-zinc-700 dark:text-zinc-300">
        <span>Year</span>
        <select
          value={year}
          onChange={(e) => setParam({ year: e.target.value })}
          className={selectClass}
        >
          {yearRange.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-2 text-xs font-medium text-zinc-700 dark:text-zinc-300">
        <span>Sort by</span>
        <select
          value={sort}
          onChange={(e) =>
            setParam({ sort: e.target.value === 'count' ? null : e.target.value })
          }
          className={selectClass}
        >
          <option value="count">Most events</option>
          <option value="pct">Largest share of confirmed</option>
          <option value="name">DJ name (A–Z)</option>
        </select>
      </label>
    </div>
  )
}

const selectClass =
  'rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 shadow-sm outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100'
