import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'

/**
 * Admin shell. Wraps every (admin) route with a sidebar nav and the
 * signed-in user's display info plus a sign-out button.
 *
 * Auth gate: middleware already 404s unauthenticated visits, but we
 * redundantly verify here so a misconfigured matcher can't expose
 * the shell. Profile + role are loaded for display + future role checks.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, role')
    .eq('user_id', user.id)
    .maybeSingle()

  const displayName = profile?.display_name ?? user.email ?? 'Admin'
  const role = profile?.role ?? 'unknown'

  return (
    <div className="flex min-h-screen flex-1 bg-zinc-50 dark:bg-zinc-950">
      <aside className="flex w-60 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <p className="text-sm font-semibold tracking-tight">Machina</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            LosGothsCo Enterprise
          </p>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          <NavLink href="/events">Events</NavLink>
          <NavLink href="/djs">DJs</NavLink>
          <NavLink href="/settings">Settings</NavLink>
        </nav>

        <div className="border-t border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {displayName}
          </p>
          <p className="text-xs capitalize text-zinc-500 dark:text-zinc-400">
            {role}
          </p>
          <form action="/auth/sign-out" method="post" className="mt-3">
            <button
              type="submit"
              className="w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  )
}

function NavLink({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className="block rounded-md px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
    >
      {children}
    </Link>
  )
}
