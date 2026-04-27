import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Cookie-bound server Supabase client.
 * Uses the publishable (anon) key with the user's session cookies, so RLS still
 * applies based on the authenticated user. Use this in Server Components,
 * Server Actions, and Route Handlers when you want the request-scoped user.
 *
 * For privileged work that needs to bypass RLS (admin tasks, cron jobs),
 * create a separate client with SUPABASE_SERVICE_ROLE_KEY inside a server
 * route — never import that client into a path that can run in the browser.
 */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` call may fail in Server Components where cookies are
            // read-only. That's fine — middleware refreshes the session.
          }
        },
      },
    }
  )
}
