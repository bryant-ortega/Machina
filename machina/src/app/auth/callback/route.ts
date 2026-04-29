import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase/server'

/**
 * Magic-link callback. Supabase redirects the user here with a `code` query
 * param. We exchange it for a session (sets the auth cookies) and then route
 * the user to the right surface based on their role.
 *
 * Behaviour:
 *   1. Exchange code → session.
 *   2. If `user_metadata.role === 'dj'` and no `djs` row exists yet, create
 *      one from the metadata captured at /register/dj. This is how DJ
 *      self-registration commits to the database — the form itself only
 *      kicks off a magic-link, no row is written until the user proves
 *      ownership of the email by clicking the link.
 *   3. Look up profile.role and route:
 *      - admin            → /events (or ?next=)
 *      - dj, no W-9       → /dj/upload-w9
 *      - dj, on file      → /dj/profile
 *
 * The `next` query param is honoured for admins. For DJs we ignore it,
 * because the only safe DJ destinations are determined by w9_status.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const next = url.searchParams.get('next')

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=missing_code', request.url))
  }

  const supabase = await createServerSupabaseClient()
  const { data: exchange, error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code)

  if (exchangeError) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(exchangeError.message)}`, request.url)
    )
  }

  const user = exchange.user
  if (!user) {
    return NextResponse.redirect(new URL('/login?error=no_user', request.url))
  }

  // Persist the djs row on first login after self-registration. Idempotent.
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>
  const intendedRole = typeof meta.role === 'string' ? meta.role : null
  if (intendedRole === 'dj') {
    await ensureDjRow(user.id, user.email ?? '', meta)
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle()

  const role = profile?.role ?? intendedRole ?? 'dj'

  if (role === 'admin') {
    const dest = next && next.startsWith('/') ? next : '/events'
    return NextResponse.redirect(new URL(dest, request.url))
  }

  // DJ: destination depends on W-9 state.
  const { data: dj } = await supabase
    .from('djs')
    .select('w9_status')
    .eq('user_id', user.id)
    .maybeSingle()

  const dest = dj?.w9_status === 'on_file' ? '/dj/profile' : '/dj/upload-w9'
  return NextResponse.redirect(new URL(dest, request.url))
}

/**
 * Create the djs row for a freshly-registered DJ if it doesn't exist yet.
 * Skips if the required fields aren't present (admins, legacy users).
 *
 * Service-role client is used because it's the cleanest way to do this from
 * the callback route — the request-scoped session is fresh, but writing via
 * service role lets us avoid any RLS / trigger ordering subtleties.
 */
async function ensureDjRow(
  userId: string,
  email: string,
  meta: Record<string, unknown>
) {
  const dj_name = typeof meta.dj_name === 'string' ? meta.dj_name : null
  const government_name =
    typeof meta.government_name === 'string' ? meta.government_name : null
  const region = typeof meta.region === 'string' ? meta.region : null
  if (!dj_name || !government_name || !region) return

  const phone =
    typeof meta.phone === 'string' && meta.phone.length > 0 ? meta.phone : null
  const pay_method =
    typeof meta.pay_method === 'string' &&
    ['zelle', 'venmo', 'paypal'].includes(meta.pay_method)
      ? meta.pay_method
      : null
  const pay_handle =
    typeof meta.pay_handle === 'string' && meta.pay_handle.length > 0
      ? meta.pay_handle
      : null

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: existing } = await admin
    .from('djs')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()
  if (existing) return

  await admin.from('djs').insert({
    user_id: userId,
    dj_name,
    government_name,
    email,
    phone,
    pay_method,
    pay_handle,
    region,
    // w9_storage_path / w9_status default — pending until the DJ uploads.
  })
}
