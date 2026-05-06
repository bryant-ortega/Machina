import Link from 'next/link'
import { CreateViewForm } from './create-form'

/**
 * /views/new — Phase 17d.
 *
 * Tiny shell that just renders the create form. The form is a client
 * component because we want progressive UX (showing a loading state
 * while the server action runs and surfacing validation errors
 * inline). Auth gate is owned by the (admin) layout.
 */
export default function NewViewPage() {
  return (
    <div className="flex-1 px-4 py-6 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="space-y-1">
          <p className="text-xs">
            <Link
              href="/views"
              className="text-zinc-500 hover:underline dark:text-zinc-400"
            >
              ← Back to views
            </Link>
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            New custom view
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Pick a name and an audience now. You&apos;ll choose which event
            fields appear on the next screen.
          </p>
        </header>

        <CreateViewForm />
      </div>
    </div>
  )
}
