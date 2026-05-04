'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Client-side router for the unauthenticated root URL.
 *
 * Recovery emails sometimes land here (instead of /reset-password) when
 * the redirectTo URL doesn't match Supabase's allow-list and Supabase
 * falls back to Site URL. The recovery token can arrive in two forms:
 *
 *   - Hash fragment:  /#access_token=...&type=recovery&...   (implicit flow)
 *   - Query string:   /?code=xxx                              (PKCE flow)
 *
 * Either way we forward the whole URL tail to /reset-password so the
 * page there can hand it to the supabase client and unlock the form.
 */
export function RootRedirect() {
  const router = useRouter()

  useEffect(() => {
    const search = window.location.search || ''
    const hash = window.location.hash || ''

    const hasRecoveryHash =
      hash.includes('type=recovery') && hash.includes('access_token=')
    // PKCE-flow recovery emails land with `?code=...`. There's no
    // `type=recovery` in the query — the only signal is the code itself.
    const hasRecoveryCode = /[?&]code=/.test(search)

    if (hasRecoveryHash || hasRecoveryCode) {
      // Hard navigation so the URL tail (search + hash) is preserved.
      window.location.replace(`/reset-password${search}${hash}`)
      return
    }
    router.replace('/login')
  }, [router])

  return null
}
