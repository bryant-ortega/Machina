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
 * After a successful submit, the success state shows the magic-link
 * confirmation. If the email is already in the djs table, we show a friendly
 * "already registered" message with a link to /login.
 */

const FormSchema = z.object({
  dj_name: z.string().trim().min(1, 'DJ name is required').max(100),
  government_name: z.string().trim().min(1, 'Legal name is required').max(200),
  email: z.string().trim().email('Enter a valid email'),
  phone: z.string().trim().max(40).optional(),
  region: z.enum(['SoCal', 'NorCal', 'Chicago', 'Arizona', 'Seattle', 'Other']),
  pay_method: z.enum(['', 'zelle', 'venmo', 'paypal']).optional(),
  pay_handle: z.string().trim().max(120).optional(),
})

type FormValues = z.infer<typeof FormSchema>

type ViewState =
  | { kind: 'idle' }
  | { kind: 'sent'; email: string }
  | { kind: 'already_registered' }
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
    defaultValues: { region: 'SoCal' },
  })

  function onSubmit(values: FormValues) {
    const fd = new FormData()
    for (const [k, v] of Object.entries(values)) {
      if (v !== undefined && v !== null) fd.set(k, String(v))
    }

    startTransition(async () => {
      const result: RegisterDjResult = await registerDj(fd)
      if (result.ok) {
        setView({ kind: 'sent', email: values.email })
        return
      }
      if (result.reason === 'already_registered') {
        setView({ kind: 'already_registered' })
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

  if (view.kind === 'sent') {
    return (
      <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200">
        Thanks — check <strong>{view.email}</strong> for a magic link to
        finish setting up your DJ profile. You can close this tab.
      </div>
    )
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

      <Field label="Phone (optional)" error={errors.phone?.message}>
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
        <Field label="Pay method (optional)" error={errors.pay_method?.message}>
          <select
            {...register('pay_method')}
            className={inputClass}
            disabled={pending}
          >
            <option value="">—</option>
            <option value="zelle">Zelle</option>
            <option value="venmo">Venmo</option>
            <option value="paypal">PayPal</option>
          </select>
        </Field>

        <Field label="Pay handle (optional)" error={errors.pay_handle?.message}>
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
        {pending ? 'Sending…' : 'Send magic link'}
      </button>

      <p className="text-xs text-zinc-500 dark:text-zinc-500">
        We&apos;ll email you a one-time sign-in link to confirm your account.
        No password needed.
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
