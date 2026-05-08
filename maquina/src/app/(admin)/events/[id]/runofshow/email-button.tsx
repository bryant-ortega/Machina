'use client'

import { useState, useTransition } from 'react'
import { sendRunOfShowEmail } from './actions'

/**
 * Email Run of Show button — Phase ROS-email.
 *
 * Lives next to the "Download PDF" link on the run-of-show page.
 * Pops a confirm dialog before sending so the admin doesn't fire it
 * by mistake. Inline status banner reports send count and any
 * recipients that bounced.
 */
export function EmailRunOfShowButton({ eventId }: { eventId: string }) {
  const [pending, startTransition] = useTransition()
  const [status, setStatus] = useState<{
    kind: 'ok' | 'err'
    message: string
  } | null>(null)

  function onClick() {
    if (
      !confirm(
        'Email this Run of Show PDF to every DJ on the lineup, the advance contact, and yourself?'
      )
    ) {
      return
    }
    setStatus(null)
    startTransition(async () => {
      const result = await sendRunOfShowEmail({ event_id: eventId })
      if (result.ok) {
        const skipped = result.skipped.length
        setStatus({
          kind: 'ok',
          message:
            `Sent to ${result.sent} ${result.sent === 1 ? 'recipient' : 'recipients'}.` +
            (skipped > 0
              ? ` ${skipped} skipped: ${result.skipped
                  .map((s) => `${s.email} (${s.reason})`)
                  .join('; ')}`
              : ''),
        })
      } else {
        setStatus({ kind: 'err', message: messageFor(result) })
      }
    })
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
      >
        {pending ? 'Sending…' : 'Email PDF to lineup'}
      </button>
      {status ? (
        <p
          className={`text-[11px] ${
            status.kind === 'ok'
              ? 'text-emerald-700 dark:text-emerald-400'
              : 'text-rose-700 dark:text-rose-300'
          }`}
        >
          {status.message}
        </p>
      ) : null}
    </div>
  )
}

function messageFor(
  r: { ok: false; reason: string; message?: string }
): string {
  switch (r.reason) {
    case 'unauth':
      return 'You must be signed in.'
    case 'forbidden':
      return 'Only admins can send this.'
    case 'invalid':
      return r.message ?? 'Invalid input.'
    case 'not_found':
      return 'Event not found.'
    case 'no_recipients':
      return 'No recipients — the lineup has no DJ emails on file and no advance contact.'
    case 'no_api_key':
      return 'Email is not configured. RESEND_API_KEY is missing on the server.'
    case 'send_failed':
      return r.message ?? 'Send failed.'
    default:
      return 'Something went wrong.'
  }
}
