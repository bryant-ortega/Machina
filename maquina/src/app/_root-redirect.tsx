'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Client-side router for the unauthenticated root URL.
 *
 * Inspects window.location.hash. If we see a Supabase recovery token
 * fragment (`#access_token=xxx&type=recovery&...`), forward that whole
 * fragment to /reset-password — the page there listens for the
 * PASSWORD_RECOVERY auth event and unlocks the form. Otherwise, just
 * send the user to /login.
 *
 * Why preserve the hash: the supabase-js browser client reads the hash
 * on init to detect the session. If we drop it during the redirect, the
 * recovery flow breaks.
 */
export function RootRedirect() {
  const router = useRouter()

  useEffect(() => {
    const hash = window.location.hash || ''
    const isRecovery =
      hash.includes('type=recovery') && hash.includes('access_token=')
    if (isRecovery) {
      // Use a hard navigation so the hash is preserved on the new URL.
      window.location.replace(`/reset-password${hash}`)
      return
    }
    router.replace('/login')
  }, [router])

  // Render nothing — this is purely a redirect shim.
  return null
}
