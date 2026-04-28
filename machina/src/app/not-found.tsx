import Link from 'next/link'

/**
 * Global 404. Also rendered when middleware rewrites unauthenticated requests
 * to admin/dj routes, so this needs to look like a plain not-found page —
 * never reveal that the URL is real-but-protected.
 */
export default function NotFound() {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="max-w-md space-y-3 text-center">
        <p className="text-sm font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          404
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Page not found
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="pt-2">
          <Link
            href="/"
            className="text-sm font-medium text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-100"
          >
            Return home
          </Link>
        </div>
      </div>
    </div>
  )
}
