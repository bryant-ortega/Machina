'use server'

import { headers } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

/**
 * Server-side validation + signInWithOtp for /register/dj.
 *
 * Flow:
 *   1. Validate input with zod (matches the DJ table CHECK constraints).
 *   2. Pre-check the djs table for an existing row with this email. If found,
 *      return `already_registered` so the client can show a friendly message.
 *      We use the service-role client because RLS would block an anonymous
 *      reader; we only return a boolean, not row data.
 *   3. Call signInWithOtp with `data` (user_metadata) carrying every form
 *      field. On the magic-link callback we drain those fields into the
 *      djs table — no row is committed until the user proves email
 *      ownership by clicking the link.
 *
 * Why server-side instead of letting the client call signInWithOtp directly:
 *   - The duplicate-email check needs the service role.
 *   - Keeps the redirect URL derivation in one place.
 *   - Validates with zod once, on the trusted side.
 */

const RegisterDjInput = z.object({
  dj_name: z.string().trim().min(1, 'DJ name is required').max(100),
  government_name: z.string().trim().min(1, 'Legal name is required').max(200),
  email: z.string().trim().toLowerCase().email('Invalid email'),
  phone: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  region: z.enum(['SoCal', 'NorCal', 'Chicago', 'Arizona', 'Seattle', 'Other']),
  // Empty <select> values come through as ''. Coerce to undefined first,
  // then narrow to the enum so the output type is clean.
  pay_method: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.enum(['zelle', 'venmo', 'paypal']).optional()
  ),
  pay_handle: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
})

export type RegisterDjResult =
  | { ok: true }
  | { ok: false; reason: 'invalid'; fieldErrors: Record<string, string[]> }
  | { ok: false; reason: 'already_registered' }
  | { ok: false; reason: 'send_failed'; message: string }

export async function registerDj(formData: FormData): Promise<RegisterDjResult> {
  const raw = {
    dj_name: formData.get('dj_name'),
    government_name: formData.get('government_name'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    region: formData.get('region'),
    pay_method: formData.get('pay_method'),
    pay_handle: formData.get('pay_handle'),
  }

  const parsed = RegisterDjInput.safeParse(raw)
  if (!parsed.success) {
    return {
      ok: false,
      reason: 'invalid',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    }
  }

  const input = parsed.data
  const pay_method = input.pay_method ?? undefined

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Duplicate-DJ check. We deliberately don't reveal whether the email exists
  // as an admin/non-DJ — that would leak admin emails. Only an existing DJ row
  // gets the "already registered" message.
  const { data: existing } = await admin
    .from('djs')
    .select('id')
    .eq('email', input.email)
    .maybeSingle()

  if (existing) {
    return { ok: false, reason: 'already_registered' }
  }

  // Build the redirect URL from the request host so it works in dev and prod
  // without hard-coding NEXT_PUBLIC_SITE_URL.
  const h = await headers()
  const proto = h.get('x-forwarded-proto') ?? 'http'
  const host = h.get('host') ?? 'localhost:3000'
  const origin = `${proto}://${host}`

  // signInWithOtp with `data` stores fields in raw_user_meta_data on the new
  // auth.users row. Our handle_new_user trigger reads `role` to set the
  // profile correctly; the auth callback reads the rest to insert the djs
  // row after the link is clicked.
  const { error } = await admin.auth.signInWithOtp({
    email: input.email,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      data: {
        role: 'dj',
        display_name: input.dj_name,
        dj_name: input.dj_name,
        government_name: input.government_name,
        phone: input.phone ?? null,
        region: input.region,
        pay_method: pay_method ?? null,
        pay_handle: input.pay_handle ?? null,
      },
    },
  })

  if (error) {
    return { ok: false, reason: 'send_failed', message: error.message }
  }

  return { ok: true }
}
