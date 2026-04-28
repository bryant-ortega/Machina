import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'

/**
 * Root landing. Until we ship a public marketing surface, this just punts:
 * - signed in   → /events (admin) or /dj/profile (dj/partner) — for now, just /events
 * - signed out  → /login
 */
export default async function Home() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect('/events')
  }
  redirect('/login')
}
