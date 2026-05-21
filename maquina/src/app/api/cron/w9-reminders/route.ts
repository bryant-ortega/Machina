/**
 * W-9 reminder cron — Phase 20.
 *
 * GET /api/cron/w9-reminders
 *
 * Scheduled by vercel.json to run every Monday at 09:00 UTC. Walks
 * every DJ and vendor whose w9_status is still 'pending', and emails a
 * reminder — but no more than once per 7 days per recipient (throttled
 * via the w9_reminders table).
 *
 * DORMANT-SAFE on two axes:
 *   1. Auth — if CRON_SECRET isn't configured, the route returns 503
 *      and does nothing. Once set, the caller must present
 *      `Authorization: Bearer <CRON_SECRET>` (Vercel cron sends this
 *      automatically when the env var exists).
 *   2. Email — sendW9Reminder no-ops without RESEND_API_KEY. When a
 *      send is skipped, we do NOT touch the reminder row, so once the
 *      key is added the throttle clock starts fresh.
 *
 * Runs in the Node runtime with the service-role client (bypasses RLS,
 * same pattern as the admin server actions).
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendW9Reminder } from '@/lib/email'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

// The seeded placeholder DJ (migration 0019) is not a real person —
// never email it.
const TBD_DJ_EMAIL = 'tbd@maquina.local'

export async function GET(req: Request) {
  // ---- Auth: require a configured + matching CRON_SECRET ---------------
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: 'cron_not_configured', detail: 'CRON_SECRET is not set' },
      { status: 503 }
    )
  }
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // ---- Load pending recipients ----------------------------------------
  const [{ data: djs }, { data: vendors }, { data: reminders }] =
    await Promise.all([
      admin
        .from('djs')
        .select('id, dj_name, email, w9_status')
        .eq('w9_status', 'pending')
        .neq('email', TBD_DJ_EMAIL),
      admin
        .from('vendors')
        .select('id, company_name, email, w9_status')
        .eq('w9_status', 'pending'),
      admin
        .from('w9_reminders')
        .select('id, dj_id, vendor_id, last_sent_at, reminder_count, stopped_at'),
    ])

  type Reminder = {
    id: string
    dj_id: string | null
    vendor_id: string | null
    last_sent_at: string | null
    reminder_count: number
    stopped_at: string | null
  }
  const byDj = new Map<string, Reminder>()
  const byVendor = new Map<string, Reminder>()
  for (const r of (reminders ?? []) as Reminder[]) {
    if (r.dj_id) byDj.set(r.dj_id, r)
    if (r.vendor_id) byVendor.set(r.vendor_id, r)
  }

  const now = Date.now()
  const nowIso = new Date().toISOString()
  let sent = 0
  let skippedThrottle = 0
  let skippedNoEmail = 0
  let failed = 0

  /** Returns true if a reminder was sent recently enough to skip. */
  function throttled(r: Reminder | undefined): boolean {
    if (!r?.last_sent_at) return false
    return now - new Date(r.last_sent_at).getTime() < SEVEN_DAYS_MS
  }

  /** Persist a successful send: bump count + last_sent_at. */
  async function recordSend(
    existing: Reminder | undefined,
    target: { dj_id?: string; vendor_id?: string }
  ) {
    if (existing) {
      await admin
        .from('w9_reminders')
        .update({
          last_sent_at: nowIso,
          reminder_count: existing.reminder_count + 1,
        })
        .eq('id', existing.id)
    } else {
      await admin.from('w9_reminders').insert({
        ...target,
        last_sent_at: nowIso,
        reminder_count: 1,
      })
    }
  }

  // ---- DJs -------------------------------------------------------------
  for (const dj of (djs ?? []) as {
    id: string
    dj_name: string
    email: string
  }[]) {
    const existing = byDj.get(dj.id)
    if (throttled(existing)) {
      skippedThrottle++
      continue
    }
    const result = await sendW9Reminder({
      to: dj.email,
      name: dj.dj_name,
      kind: 'dj',
    })
    if (result.ok) {
      await recordSend(existing, { dj_id: dj.id })
      sent++
    } else if (result.skipped) {
      skippedNoEmail++
    } else {
      failed++
    }
  }

  // ---- Vendors ---------------------------------------------------------
  for (const v of (vendors ?? []) as {
    id: string
    company_name: string
    email: string
  }[]) {
    const existing = byVendor.get(v.id)
    if (throttled(existing)) {
      skippedThrottle++
      continue
    }
    const result = await sendW9Reminder({
      to: v.email,
      name: v.company_name,
      kind: 'vendor',
    })
    if (result.ok) {
      await recordSend(existing, { vendor_id: v.id })
      sent++
    } else if (result.skipped) {
      skippedNoEmail++
    } else {
      failed++
    }
  }

  return NextResponse.json({
    ok: true,
    ranAt: nowIso,
    pending: { djs: djs?.length ?? 0, vendors: vendors?.length ?? 0 },
    sent,
    skippedThrottle,
    skippedNoEmail,
    failed,
  })
}
