'use server'

import { z } from 'zod'
import { Resend } from 'resend'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { renderRunOfShowPdf } from '@/lib/pdf-runofshow'

/**
 * sendRunOfShowEmail — admin emails the Run of Show PDF.
 *
 * Recipients (deduped, lowercased):
 *   - The currently signed-in admin (so they have a copy in their
 *     inbox / can audit the send).
 *   - Every DJ slotted on the event whose `djs.email` is set.
 *   - The event's `advance_contact_email`, if set.
 *
 * Each recipient gets a separate email — no BCC, no shared addressing
 * — so DJs and the venue advance contact never see each other's
 * addresses. The PDF is the same buffer for every send (rendered
 * once, attached as base64).
 *
 * Env required:
 *   RESEND_API_KEY     — Resend API key
 *   RESEND_FROM        — verified sender override.
 *                        Defaults to "Maquina <maquina@losgoths.co>"; the
 *                        losgoths.co domain must be verified in Resend
 *                        (DKIM + SPF + return-path) for sends to land in
 *                        inboxes rather than spam.
 */

const Input = z.object({
  event_id: z.string().uuid(),
  /**
   * If provided, the email is sent ONLY to this address — bypasses the
   * lineup / advance-contact / admin recipient gathering. Useful for
   * sanity-checking a brand-new event's PDF render before broadcasting.
   */
  test_to: z.string().email().optional(),
})

export type SendRosResult =
  | {
      ok: true
      sent: number
      skipped: { reason: string; email: string }[]
      recipients: string[]
    }
  | {
      ok: false
      reason:
        | 'unauth'
        | 'forbidden'
        | 'invalid'
        | 'not_found'
        | 'no_recipients'
        | 'no_api_key'
        | 'send_failed'
      message?: string
    }

export async function sendRunOfShowEmail(
  input: { event_id: string; test_to?: string }
): Promise<SendRosResult> {
  const parsed = Input.safeParse(input)
  if (!parsed.success) {
    return { ok: false, reason: 'invalid', message: parsed.error.message }
  }

  // 1. Auth + admin gate.
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, reason: 'unauth' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('user_id', user.id)
    .maybeSingle()
  if (profile?.role !== 'admin') return { ok: false, reason: 'forbidden' }

  // 2. API key check up front so we fail fast with a clear message
  //    rather than blowing up inside Resend.
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { ok: false, reason: 'no_api_key' }

  // 3. Render PDF + collect labels for the email body.
  const pdf = await renderRunOfShowPdf({
    supabase,
    eventId: parsed.data.event_id,
  })
  if (!pdf.ok) return { ok: false, reason: 'not_found' }

  // 4. Recipient assembly. Test-mode short-circuits to a single
  //    address; production mode unions admin + DJs + advance contact.
  type Recipient = { email: string; label: string }
  const recipients = new Map<string, Recipient>() // key = lowercased email

  function add(email: string | null | undefined, label: string) {
    if (!email) return
    const norm = email.trim().toLowerCase()
    if (!norm.includes('@')) return
    if (recipients.has(norm)) return
    recipients.set(norm, { email: email.trim(), label })
  }

  if (parsed.data.test_to) {
    add(parsed.data.test_to, 'Test recipient')
  } else {
    const { data: ev } = await supabase
      .from('events')
      .select('advance_contact_email')
      .eq('id', parsed.data.event_id)
      .maybeSingle()

    const { data: djSlots } = await supabase
      .from('event_dj_slots')
      .select('djs(email, dj_name)')
      .eq('event_id', parsed.data.event_id)

    type DjRow = { email: string | null; dj_name: string | null } | null
    const djRows: DjRow[] = (djSlots ?? []).map((s) => {
      const d = (s as { djs: DjRow | DjRow[] }).djs
      if (Array.isArray(d)) return d[0] ?? null
      return d ?? null
    })

    add(user.email ?? null, 'You (admin copy)')
    for (const d of djRows) {
      if (!d?.email) continue
      add(d.email, `DJ: ${d.dj_name ?? 'Unknown'}`)
    }
    add(ev?.advance_contact_email ?? null, 'Advance contact')
  }

  if (recipients.size === 0) {
    return { ok: false, reason: 'no_recipients' }
  }

  // 5. Build email body (plaintext + HTML).
  const dateLong = new Date(`${pdf.date}T12:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
  const subject = `${parsed.data.test_to ? '[TEST] ' : ''}Run of Show — ${pdf.title} · ${dateLong}`
  const where = `${pdf.city}${pdf.state ? `, ${pdf.state}` : ''}`
  const text = [
    `Run of Show attached for ${pdf.title}.`,
    ``,
    `When: ${dateLong}`,
    `Where: ${where}`,
    ``,
    `Reply if anything looks off.`,
    ``,
    `— LosGothsCo`,
  ].join('\n')
  const html = [
    `<p>Run of Show attached for <strong>${escapeHtml(pdf.title)}</strong>.</p>`,
    `<p><strong>When:</strong> ${escapeHtml(dateLong)}<br>`,
    `<strong>Where:</strong> ${escapeHtml(where)}</p>`,
    `<p>Reply if anything looks off.</p>`,
    `<p>— LosGothsCo</p>`,
  ].join('\n')

  // 6. Send. One email per recipient — preserves privacy, and lets
  //    bounces fail in isolation.
  const resend = new Resend(apiKey)
  const from = process.env.RESEND_FROM ?? 'Maquina <maquina@losgoths.co>'
  const attachmentBase64 = pdf.buffer.toString('base64')
  const attachments = [
    {
      filename: pdf.filename,
      content: attachmentBase64,
    },
  ]

  const skipped: { reason: string; email: string }[] = []
  let sent = 0
  for (const { email } of recipients.values()) {
    try {
      const { error } = await resend.emails.send({
        from,
        to: [email],
        subject,
        text,
        html,
        attachments,
      })
      if (error) {
        skipped.push({ email, reason: error.message ?? 'resend error' })
      } else {
        sent++
      }
    } catch (e) {
      skipped.push({
        email,
        reason: e instanceof Error ? e.message : 'unknown error',
      })
    }
  }

  if (sent === 0) {
    return {
      ok: false,
      reason: 'send_failed',
      message: skipped[0]?.reason ?? 'all sends failed',
    }
  }

  return {
    ok: true,
    sent,
    skipped,
    recipients: Array.from(recipients.values()).map((r) => r.email),
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
