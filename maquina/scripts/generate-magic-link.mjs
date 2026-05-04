#!/usr/bin/env node
/**
 * Generate a magic-link URL via the Supabase admin API — without sending an
 * email. Useful when the built-in SMTP rate-limit is hit (4 emails/hour per
 * recipient) and you need to test auth flows locally.
 *
 * Usage:
 *   node scripts/generate-magic-link.mjs                       # defaults to chase@losgoths.co
 *   node scripts/generate-magic-link.mjs you@example.com
 *   node scripts/generate-magic-link.mjs you@example.com /events
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from
 * maquina/.env.local. Service-role key bypasses RLS and Auth gating, so
 * NEVER ship this script's output anywhere or commit any link it prints.
 *
 * The printed URL points at Supabase's verify endpoint. Pasting it into a
 * logged-out browser tab causes Supabase to issue a session and redirect
 * through /auth/callback, just like clicking a real magic-link email.
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = join(__dirname, '..', '.env.local')

// Tiny .env loader. We don't want a dotenv dependency just for a dev script.
function loadEnv(path) {
  const text = readFileSync(path, 'utf8')
  const out = {}
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq < 0) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    out[key] = value
  }
  return out
}

const env = loadEnv(envPath)
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceKey) {
  console.error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local'
  )
  process.exit(1)
}

const email = process.argv[2] ?? 'chase@losgoths.co'
const next = process.argv[3] ?? '/events'
const siteUrl = env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
const redirectTo = `${siteUrl}/auth/callback?next=${encodeURIComponent(next)}`

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const { data, error } = await supabase.auth.admin.generateLink({
  type: 'magiclink',
  email,
  options: { redirectTo },
})

if (error) {
  console.error('generateLink failed:', error.message)
  process.exit(1)
}

const link = data?.properties?.action_link
if (!link) {
  console.error('No action_link returned. Full response:', JSON.stringify(data, null, 2))
  process.exit(1)
}

console.log()
console.log(`Magic link for ${email}:`)
console.log()
console.log(link)
console.log()
console.log(`After clicking, you'll land on ${siteUrl}${next}`)
console.log()
