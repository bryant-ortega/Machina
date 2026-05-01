'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'

/**
 * Shared toolbar for /views/month and /views/year.
 *
 * Renders selectors that update the page's URL search params; the parent
 * server component re-reads those params and refetches. Each control
 * preserves the OTHER search params, so toggling "confirmed only" doesn't
 * reset the year, etc.
 */

const MONTHS = [
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

export function ViewToolbar({
  showMonth,
  year,
  month,
  confirmedOnly,
  yearRange,
}: {
  showMonth: boolean
  year: number
  month: number // 1..12 (only meaningful when showMonth=true)
  confirmedOnly: boolean
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
      {showMonth && (
        <label className="flex items-center gap-2 text-xs font-medium text-zinc-700 dark:text-zinc-300">
          <span>Month</span>
          <select
            value={month}
            onChange={(e) => setParam({ month: e.target.value })}
            className={selectClass}
          >
            {MONTHS.map((name, i) => (
              <option key={name} value={i + 1}>
                {name}
              </option>
            ))}
          </select>
        </label>
      )}

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

      <label className="ml-auto inline-flex items-center gap-2 text-xs font-medium text-zinc-700 dark:text-zinc-300">
        <input
          type="checkbox"
          checked={confirmedOnly}
          onChange={(e) =>
            setParam({ confirmed_only: e.target.checked ? '1' : null })
          }
          className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-900"
        />
        Confirmed only
      </label>
    </div>
  )
}

const selectClass =
  'rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 shadow-sm outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100'
