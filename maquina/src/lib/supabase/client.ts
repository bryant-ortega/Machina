import { createBrowserClient } from '@supabase/ssr'

/**
 * Browser-side Supabase client.
 * Uses the publishable (anon) key — every query is gated by RLS policies.
 * Never import this in server-only code paths; use server.ts there.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
