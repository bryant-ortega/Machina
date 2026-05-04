'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * Set a new password after clicking the link in the recovery email.
 *
 * The recovery email lands here directly (or is forwarded here from /
 * via _root-redirect.tsx, which preserves the URL hash). Supabase's JS
 * client auto-detects the recovery token from the URL on mount —
 * whether it arrives as `?code=...` query (PKCE) or `#access_token=...`
 * fragment (implicit flow). We don't need to know which is in use; we
 * just listen for the PASSWORD_RECOVERY auth event and unlock the form.
 *
 * UX: render explicit loading / ready / not-recovery states. No silent
 * timer-based bouncing — that's confusing for the user. If the user
 * arrived without a recovery code we just say so and link to /login.
 */
export default function ResetPasswordPage() {
  const router = useRouter()
  // Memoize the client so re-renders don't churn the auth listener.
  const supabase = useMemo(() => createClient(), [])

  type Phase = 'checking' | 'ready' | 'no_recovery'
  const [phase, setPhase] = useState<Phase>('checking')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    let cancelled = false
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (cancelled) return
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setPhase('ready')
      }
    })

    ;(async () => {
      // Two formats Supabase recovery emails can use:
      //   1. PKCE (newer):     ?code=xxx                 in the query string
      //   2. Implicit (older): #access_token=...&refresh_token=...&type=recovery
      // @supabase/ssr's browser client does NOT auto-detect either by
      // default, so we explicitly handle both here.
      const params = new URLSearchParams(window.location.search)
      const code = params.get('code')
      if (code) {
        // Errors fall through to the no_recovery state via the session
        // poll below — surfacing the raw exchange error here doesn't
        // help the user, and successful exchange triggers an auth event
        // that flips the page to ready.
        await supabase.auth.exchangeCodeForSession(code)
        return
      }

      // Parse the hash for an implicit-flow recovery payload.
      const rawHash = window.location.hash.startsWith('#')
        ? window.location.hash.slice(1)
        : window.location.hash
      const hashParams = new URLSearchParams(rawHash)
      const access_token = hashParams.get('access_token')
      const refresh_token = hashParams.get('refresh_token')
      if (access_token && refresh_token) {
        await supabase.auth.setSession({ access_token, refresh_token })
      }
    })()

    const checks = [200, 500, 1500, 3500].map((ms) =>
      setTimeout(async () => {
        if (cancelled) return
        const { data: { session } } = await supabase.auth.getSession()
        if (cancelled) return
        if (session) {
          setPhase('ready')
        } else if (ms === 3500) {
          setPhase((prev) => (prev === 'checking' ? 'no_recovery' : prev))
        }
      }, ms)
    )

    return () => {
      cancelled = true
      subscription.unsubscribe()
      checks.forEach(clearTimeout)
    }
  }, [supabase])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setPending(true)
    const { error: updateErr } = await supabase.auth.updateUser({
      password,
    })
    setPending(false)
    if (updateErr) {
      setError(updateErr.message)
      return
    }
    setDone(true)
    setTimeout(() => router.replace('/login'), 1500)
  }

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="space-y-1.5">
          <h1 className="text-xl font-semibold tracking-tight">
            Set a new password
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Choose a new password for your account.
          </p>
        </div>

        {done ? (
          <div className="space-y-4">
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200">
              Password updated. Redirecting you to sign in…
            </div>
            <Link
              href="/login"
              className="inline-block text-xs text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Go to sign in
            </Link>
          </div>
        ) : phase === 'checking' ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-500">
            Verifying recovery link…
          </p>
        ) : phase === 'no_recovery' ? (
          <div className="space-y-4">
            <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
              We couldn&apos;t find a valid recovery link in this URL. Recovery
              links work only once and expire — request a fresh one if needed.
            </div>
            <div className="flex items-center gap-3 text-xs">
              <Link
                href="/forgot-password"
                className="rounded-md bg-zinc-900 px-3 py-1.5 font-medium text-zinc-50 hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
              >
                Send a new link
              </Link>
              <Link
                href="/login"
                className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                Back to sign in
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-zinc-800 dark:text-zinc-200"
              >
                New password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                disabled={pending}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="confirm"
                className="block text-sm font-medium text-zinc-800 dark:text-zinc-200"
              >
                Confirm new password
              </label>
              <input
                id="confirm"
                type="password"
                autoComplete="new-password"
                required
                disabled={pending}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={inputClass}
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}

            <button
              type="submit"
              disabled={pending || !password || !confirm}
              className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              {pending ? 'Updating…' : 'Update password'}
            </button>
          </form>
        )}

      </div>
    </div>
  )
}

const inputClass =
  'block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-300 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-400 dark:focus:ring-zinc-700'
