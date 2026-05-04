'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Magic-link login.
 * No password field — Supabase emails a one-time link that, when clicked,
 * lands on /auth/callback to exchange the code for a session.
 */
export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>(
    'idle'
  )
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!email) return
    setStatus('sending')
    setErrorMessage(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setStatus('error')
      setErrorMessage(error.message)
      return
    }
    setStatus('sent')
  }

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="space-y-1.5">
          <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Enter your email and we&apos;ll send you a magic link.
          </p>
        </div>

        {status === 'sent' ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200">
            Check <strong>{email}</strong> for a sign-in link. You can close
            this tab.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="block text-sm font-medium text-zinc-800 dark:text-zinc-200"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                disabled={status === 'sending'}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-300 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-400 dark:focus:ring-zinc-700"
              />
            </div>

            {errorMessage && (
              <p className="text-sm text-red-600 dark:text-red-400">
                {errorMessage}
              </p>
            )}

            <button
              type="submit"
              disabled={status === 'sending' || !email}
              className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              {status === 'sending' ? 'Sending…' : 'Send magic link'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
