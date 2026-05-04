import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { RootRedirect } from './_root-redirect'

/**
 * Root landing.
 *
 * If we're already signed in (cookie session present), bounce straight
 * to /events server-side. Otherwise we hand off to the client component
 * RootRedirect, which inspects window.location.hash for a Supabase
 * recovery fragment (#access_token=...&type=recovery&...). When
 * Supabase's recovery email falls back to Site URL on a password reset
 * link (because the redirectTo URL didn't match the project's
 * allow-list), the recovery token arrives at this URL — and a
 * server-side redirect would drop the hash before the client gets a
 * chance to see it.
 */
export default async function Home() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect('/events')
  }
  return <RootRedirect />
}
