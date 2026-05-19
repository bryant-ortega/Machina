'use client'

import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { registerDj, type RegisterDjResult } from './actions'

/**
 * DJ self-registration form. Mirrors the server-side zod schema in actions.ts
 * so the client gets immediate validation feedback before submitting.
 *
 * On success the server action redirects to /dj/upload-w9 — no magic-link
 * round-trip; the password establishes account ownership immediately.
 * If the email is already on a DJ record, we show a friendly "already
 * registered" message with a link to /login.
 */

const FormSchema = z.object({
  dj_name: z.string().trim().min(1, 'DJ name is required').max(100),
  government_name: z.string().trim().min(1, 'Legal name is required').max(200),
  email: z.string().trim().email('Enter a valid email'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be 128 characters or fewer'),
  phone: z.string().trim().min(1, 'Phone is required').max(40),
  region: z.enum(['SoCal', 'NorCal', 'Chicago', 'Arizona', 'Seattle', 'Other']),
  pay_method: z.enum(['zelle', 'venmo', 'paypal'], { message: 'Pay method is required' }),
  pay_handle: z.string().trim().min(1, 'Pay handle is required').max(120),
})

type FormValues = z.infer<typeof FormSchema>

type ViewState =
  | { kind: 'idle' }
  | { kind: 'already_registered' }
  | { kind: 'orphan_wrong_password' }
  | { kind: 'orphan_wrong_role' }
  | { kind: 'error'; message: string }

const REGIONS = [
  'SoCal',
  'NorCal',
  'Chicago',
  'Arizona',
  'Seattle',
  'Other',
] as const

export function RegistrationForm() {
  const [view, setView] = useState<ViewState>({ kind: 'idle' })
  const [pending, startTransition] = useTransition()
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: { region: 'SoCal', pay_method: 'zelle' },
  })

  function onSubmit(values: FormValues) {
    const fd = new FormData()
    for (const [k, v] of Object.entries(values)) {
      if (v !== undefined && v !== null) fd.set(k, String(v))
    }

    startTransition(async () => {
      // On success the server action redirects (never returns). Anything
      // we get back here is an error.
      const result = (await registerDj(fd)) as RegisterDjResult | undefined
      if (!result) return
      if (result.reason === 'already_registered') {
        setView({ kind: 'already_registered' })
        return
      }
      if (result.reason === 'orphan_wrong_password') {
        setView({ kind: 'orphan_wrong_password' })
        return
      }
      if (result.reason === 'orphan_wrong_role') {
        setView({ kind: 'orphan_wrong_role' })
        return
      }
      if (result.reason === 'invalid') {
        for (const [field, msgs] of Object.entries(result.fieldErrors)) {
          if (msgs && msgs.length) {
            setError(field as keyof FormValues, { message: msgs[0] })
          }
        }
        setView({ kind: 'error', message: 'Please fix the highlighted fields.' })
        return
      }
      setView({ kind: 'error', message: result.message })
    })
  }

  if (view.kind === 'already_registered') {
    return (
      <div className="space-y-3 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
        <p>
          That email is already registered. Sign in instead to access your
          profile.
        </p>
        <a
          href="/login"
          className="inline-block rounded-md bg-amber-900 px-3 py-1.5 text-xs font-medium text-amber-50 hover:bg-amber-800 dark:bg-amber-200 dark:text-amber-950 dark:hover:bg-amber-100"
        >
          Go to sign in
        </a>
      </div>
    )
  }

  if (view.kind === 'orphan_wrong_password') {
    return (
      <div className="space-y-3 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
        <p>
          An account already exists for this email, but the password you
          entered doesn&apos;t match. You can:
        </p>
        <ul className="ml-5 list-disc space-y-1 text-xs">
          <li>Re-submit the form with your existing password to reclaim the profile.</li>
          <li>Reset your password if you don&apos;t remember it.</li>
          <li>Use a different email address.</li>
        </ul>
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            onClick={() => setView({ kind: 'idle' })}
            className="rounded-md bg-amber-900 px-3 py-1.5 text-xs font-medium text-amber-50 hover:bg-amber-800 dark:bg-amber-200 dark:text-amber-950 dark:hover:bg-amber-100"
          >
            Try again
          </button>
          <a
            href="/forgot-password"
            className="rounded-md border border-amber-300 px-3 py-1.5 text-xs font-medium hover:bg-amber-100 dark:border-amber-800 dark:hover:bg-amber-900/40"
          >
            Reset password
          </a>
        </div>
      </div>
    )
  }

  if (view.kind === 'orphan_wrong_role') {
    return (
      <div className="space-y-3 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
        <p>
          This email is already registered with a different role and
          can&apos;t be used to register as a DJ. Please use a different
          email, or contact an admin if you think this is a mistake.
        </p>
        <button
          type="button"
          onClick={() => setView({ kind: 'idle' })}
          className="rounded-md bg-red-900 px-3 py-1.5 text-xs font-medium text-red-50 hover:bg-red-800 dark:bg-red-200 dark:text-red-950 dark:hover:bg-red-100"
        >
          Use a different email
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <Field
        label="DJ name"
        hint="Stage name as it should appear on lineups."
        error={errors.dj_name?.message}
      >
        <input
          type="text"
          autoComplete="off"
          {...register('dj_name')}
          className={inputClass}
          disabled={pending}
        />
      </Field>

      <Field
        label="Legal name"
        hint="For W-9 / payment paperwork. Stays private."
        error={errors.government_name?.message}
      >
        <input
          type="text"
          autoComplete="name"
          {...register('government_name')}
          className={inputClass}
          disabled={pending}
        />
      </Field>

      <Field label="Email" error={errors.email?.message}>
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          {...register('email')}
          className={inputClass}
          disabled={pending}
        />
      </Field>

      <Field
        label="Password"
        hint="At least 8 characters. You'll use this to sign in."
        error={errors.password?.message}
      >
        <input
          type="password"
          autoComplete="new-password"
          {...register('password')}
          className={inputClass}
          disabled={pending}
        />
      </Field>

      <Field label="Phone" error={errors.phone?.message}>
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          {...register('phone')}
          className={inputClass}
          disabled={pending}
        />
      </Field>

      <Field label="Region" error={errors.region?.message}>
        <select
          {...register('region')}
          className={inputClass}
          disabled={pending}
        >
          {REGIONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Pay method" error={errors.pay_method?.message}>
          <select
            {...register('pay_method')}
            className={inputClass}
            disabled={pending}
          >
            <option value="zelle">Zelle</option>
            <option value="venmo">Venmo</option>
            <option value="paypal">PayPal</option>
          </select>
        </Field>

        <Field label="Pay handle (@name, or phone number)" error={errors.pay_handle?.message}>
          <input
            type="text"
            autoComplete="off"
            placeholder="@you / email / phone"
            {...register('pay_handle')}
            className={inputClass}
            disabled={pending}
          />
        </Field>
      </div>

      {view.kind === 'error' && (
        <p className="text-sm text-red-600 dark:text-red-400">{view.message}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
      >
        {pending ? 'Creating account…' : 'Create account'}
      </button>

      <p className="text-xs text-zinc-500 dark:text-zinc-500">
        Your account is created instantly. Next, we&apos;ll ask you to upload
        your W-9 so we can pay you.
      </p>
    </form>
  )
}

const inputClass =
  'block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-300 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-400 dark:focus:ring-zinc-700'

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string
  hint?: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p className="text-xs text-zinc-500 dark:text-zinc-500">{hint}</p>
      )}
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}
