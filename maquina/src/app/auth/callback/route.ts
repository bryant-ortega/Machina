import { NextResponse, type NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

/**
 * Auth callback. Now used only for password-recovery links — magic-link
 * sign-in was retired in favor of email + password (see /login).
 *
 * Supabase appends `?code=...&type=recovery` to the recovery link in the
 * email it sends from `resetPasswordForEmail`. We exchange the code for
 * a recovery session (which lets the user call `updateUser({ password })`
 * once), then redirect to /reset-password where the form lives.
 *
 * Anything else with a `code` we still try to exchange — gracefully
 * dropping into a sane fallback — but the only first-class flow today is
 * recovery.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const type = url.searchParams.get('type')

  if (!code) {
    return NextResponse.redirect(
      new URL('/login?error=missing_code', request.url)
    )
  }

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent(error.message)}`,
        request.url
      )
    )
  }

  if (type === 'recovery') {
    return NextResponse.redirect(new URL('/reset-password', request.url))
  }

  // Any other authenticated landing — drop the user on the home redirect
  // path so the role gates can route them.
  return NextResponse.redirect(new URL('/events', request.url))
}
