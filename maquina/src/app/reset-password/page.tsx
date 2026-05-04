'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * Set a new password after clicking the link in the recovery email.
 *
 * The recovery email lands here directly. Supabase's JS client auto-
 * detects the recovery token from the URL on mount — whether it arrives
 * as a `?code=...` query param (PKCE flow) or as a `#access_token=...`
 * URL fragment (implicit flow). We don't need to know which is in use;
 * we just listen for the PASSWORD_RECOVERY auth event and unlock the
 * form when it fires.
 *
 * If we don't see a recovery event within a short grace period and the
 * user has no existing session, bounce to /login — the user probably
 * hit this URL directly, not via a recovery email.
 */
export default function ResetPasswordPage() {
  const router = useRouter()
  const supabase = createClient()
  const [ready, setReady] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    let cancelled = false

    // Subscribe to auth state changes. Supabase fires PASSWORD_RECOVERY
    // when a recovery URL is detected.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event) => {
        if (cancelled) return
        if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
          setReady(true)
        }
      }
    )

    // Also handle the case where the recovery code was processed before
    // we subscribed: check for an existing session after a tick.
    const checkTimer = setTimeout(async () => {
      if (cancelled) return
      const { data: { session } } = await supabase.auth.getSession()
      if (session) setReady(true)
    }, 200)

    // Fallback: if neither the event nor a session shows up after 2s,
    // the user probably arrived without a recovery code.
    const bailTimer = setTimeout(async () => {
      if (cancelled) return
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) router.replace('/login?error=no_recovery_session')
    }, 2000)

    return () => {
      cancelled = true
      subscription.unsubscribe()
      clearTimeout(checkTimer)
      clearTimeout(bailTimer)
    }
  }, [router, supabase])

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
    // Drop them on /login after a beat so the messaging lands.
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
        ) : !ready ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-500">Loading…</p>
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
