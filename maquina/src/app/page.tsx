import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { RootRedirect } from './_root-redirect'

/**
 * Root landing.
 *
 * If we're already signed in (cookie session present), bounce straight
 * to the role-appropriate landing surface. Otherwise we hand off to the
 * client component RootRedirect, which inspects window.location.hash
 * for a Supabase recovery fragment (#access_token=...&type=recovery)
 * and forwards to /reset-password if found, /login otherwise.
 *
 * Why a client redirect for the unauthed branch: Supabase's recovery
 * email can fall back to Site URL when the redirectTo URL doesn't
 * match the allow-list. The recovery token then arrives at this URL,
 * and a server-side redirect would drop the hash before the client
 * gets a chance to see it.
 */
export default async function Home() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle()
    const role = profile?.role ?? 'dj'
    if (role === 'admin') redirect('/events')
    if (role === 'collab') redirect('/collab/events')
    if (role === 'viewer') redirect('/viewer/year')
    if (role === 'designer') redirect('/designer/view')
    if (role === 'vendor') redirect('/vendor/profile')
    redirect('/dj/profile')
  }
  return <RootRedirect />
}
