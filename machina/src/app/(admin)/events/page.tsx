import Link from 'next/link'

/**
 * Placeholder events index. Phase 7b replaces this with the real list view.
 *
 * For now we expose a "+ New event" link so the create form is reachable,
 * and we render a green flash banner when the URL carries `?created=<code>`
 * — the create form redirects here on success since /events/[id] is still
 * stubbed (lands in Phase 7b).
 */
export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string }>
}) {
  const { created } = await searchParams

  return (
    <div className="flex-1 px-8 py-10">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">Events</h1>
          <Link
            href="/events/new"
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            + New event
          </Link>
        </div>

        {created ? (
          <div className="rounded-md border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200">
            ✓ Created event <span className="font-mono font-semibold">{created}</span>
          </div>
        ) : null}

        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          The events list view ships in Phase 7b. For now, use &ldquo;New
          event&rdquo; to create one.
        </p>
      </div>
    </div>
  )
}
