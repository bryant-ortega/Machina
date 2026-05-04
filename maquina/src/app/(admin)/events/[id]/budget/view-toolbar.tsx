'use client'

import { useTransition, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { actualizeEvent } from './actions'

/**
 * Top-of-page toolbar for the budget view.
 *
 *   - When the event has only an estimated budget: shows the Estimated tab
 *     and a primary "Actualize event" button. Clicking the button calls
 *     the actualizeEvent server action, which clones the estimated budget
 *     into a new budget_type='final' row and pre-populates expenses + tiers.
 *     We then redirect to ?view=final so the admin lands on the new row,
 *     ready to edit actuals.
 *
 *   - When a final budget exists: shows three tabs (Estimated / Final /
 *     Compare). No Actualize button — Phase 14's override system will
 *     eventually own "reset to estimated"; for now, manually delete the
 *     final row to redo.
 *
 * The component is client-only because the tab links want a router push
 * (no full nav on toggle) and the Actualize action needs a transition
 * spinner. The tabs are rendered as <Link> so middle-click / cmd-click
 * still open in a new tab.
 */
export function ViewToolbar({
  eventId,
  currentView,
  hasFinal,
}: {
  eventId: string
  currentView: 'estimated' | 'final' | 'compare'
  hasFinal: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function actualize() {
    setError(null)
    if (
      !confirm(
        'Actualize this event? This creates a Final budget pre-populated from the Estimated budget. You can edit actuals on the Final tab afterward.'
      )
    ) {
      return
    }
    startTransition(async () => {
      const result = await actualizeEvent({ event_id: eventId })
      if (!result.ok) {
        setError(result.message)
        return
      }
      router.push(`/events/${eventId}/budget?view=final`)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <nav
        className="inline-flex rounded-lg border border-zinc-200 bg-zinc-50 p-1 text-sm dark:border-zinc-800 dark:bg-zinc-900"
        aria-label="Budget view"
      >
        <Tab
          eventId={eventId}
          view="estimated"
          label="Estimated"
          active={currentView === 'estimated'}
          enabled={true}
        />
        <Tab
          eventId={eventId}
          view="final"
          label="Final"
          active={currentView === 'final'}
          enabled={hasFinal}
        />
        <Tab
          eventId={eventId}
          view="compare"
          label="Compare"
          active={currentView === 'compare'}
          enabled={hasFinal}
        />
      </nav>

      <div className="flex items-center gap-3">
        {error ? (
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        ) : null}
        {hasFinal ? null : (
          <button
            type="button"
            onClick={actualize}
            disabled={pending}
            className="inline-flex items-center rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-zinc-50 transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {pending ? 'Actualizing…' : 'Actualize event'}
          </button>
        )}
      </div>
    </div>
  )
}

function Tab({
  eventId,
  view,
  label,
  active,
  enabled,
}: {
  eventId: string
  view: 'estimated' | 'final' | 'compare'
  label: string
  active: boolean
  enabled: boolean
}) {
  const base =
    'rounded-md px-3 py-1.5 text-sm font-medium transition select-none'
  if (!enabled) {
    return (
      <span
        className={`${base} cursor-not-allowed text-zinc-400 dark:text-zinc-600`}
        aria-disabled="true"
        title="Actualize the event to enable this view"
      >
        {label}
      </span>
    )
  }
  if (active) {
    return (
      <span
        className={`${base} bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-50`}
      >
        {label}
      </span>
    )
  }
  return (
    <Link
      href={`/events/${eventId}/budget?view=${view}`}
      className={`${base} text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50`}
    >
      {label}
    </Link>
  )
}
