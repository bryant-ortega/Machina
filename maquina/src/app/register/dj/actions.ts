'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase/server'

/**
 * Server action for /register/dj.
 *
 * Flow (Phase Auth — email + password):
 *   1. Validate input (matches DJ table CHECK constraints).
 *   2. Refuse if a djs row already exists for this email — friendly
 *      message + link to /login.
 *   3. Create the auth user via the admin client with email_confirm:true,
 *      password set, and `role: 'dj'` in user_metadata so the
 *      handle_new_user trigger marks the profile as a DJ.
 *   4. Insert the djs row directly via the admin client. We're past the
 *      magic-link callback dance — once the password is on file, the
 *      account is real.
 *   5. Sign the new user in via the SSR client (sets auth cookies on
 *      this response), then redirect to /dj/upload-w9 so they can finish
 *      onboarding. No email round-trip.
 */

const RegisterDjInput = z.object({
  dj_name: z.string().trim().min(1, 'DJ name is required').max(100),
  government_name: z.string().trim().min(1, 'Legal name is required').max(200),
  email: z.string().trim().toLowerCase().email('Invalid email'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be 128 characters or fewer'),
  phone: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  region: z.enum(['SoCal', 'NorCal', 'Chicago', 'Arizona', 'Seattle', 'Other']),
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
  | { ok: false; reason: 'invalid'; fieldErrors: Record<string, string[]> }
  | { ok: false; reason: 'already_registered' }
  | { ok: false; reason: 'create_failed'; message: string }
// On success the action redirects, so the form never sees an `ok: true`.

export async function registerDj(
  formData: FormData
): Promise<RegisterDjResult | never> {
  const raw = {
    dj_name: formData.get('dj_name'),
    government_name: formData.get('government_name'),
    email: formData.get('email'),
    password: formData.get('password'),
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

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Refuse duplicate DJ registration. We don't reveal whether a non-DJ
  // (admin/partner) exists with this email — that would leak the admin
  // roster.
  const { data: existing } = await admin
    .from('djs')
    .select('id')
    .eq('email', input.email)
    .maybeSingle()
  if (existing) {
    return { ok: false, reason: 'already_registered' }
  }

  // Create the auth user. email_confirm:true skips the verification email —
  // we trust the registration form because the immediately-following
  // password proves intent. (Email verification could be added later as a
  // soft "please confirm" UX, but it's not a hard auth requirement.)
  const { data: created, error: createErr } =
    await admin.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: {
        role: 'dj',
        display_name: input.dj_name,
      },
    })
  if (createErr || !created.user) {
    return {
      ok: false,
      reason: 'create_failed',
      message:
        createErr?.message ??
        'Could not create account. Try a different email.',
    }
  }

  // Insert the djs row. handle_new_user already wrote the profile row;
  // this writes the DJ-specific columns. RLS doesn't apply to the admin
  // client, so we don't need a policy here.
  const { error: djErr } = await admin.from('djs').insert({
    user_id: created.user.id,
    dj_name: input.dj_name,
    government_name: input.government_name,
    email: input.email,
    phone: input.phone ?? null,
    pay_method: input.pay_method ?? null,
    pay_handle: input.pay_handle ?? null,
    region: input.region,
  })
  if (djErr) {
    // Best-effort cleanup of the half-created auth user so the same email
    // can be retried. Ignore the cleanup error — surfacing the original
    // failure is more useful.
    await admin.auth.admin.deleteUser(created.user.id)
    return {
      ok: false,
      reason: 'create_failed',
      message: djErr.message,
    }
  }

  // Sign in via the SSR client so the response sets the session cookies.
  const supabase = await createServerSupabaseClient()
  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  })
  if (signInErr) {
    // Account is created — fall back to the login page rather than
    // surfacing this as a failure.
    redirect('/login')
  }

  redirect('/dj/upload-w9')
}
