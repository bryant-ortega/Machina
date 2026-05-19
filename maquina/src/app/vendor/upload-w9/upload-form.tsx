'use client'

import { useRef, useState, useTransition } from 'react'
import { uploadVendorW9, type UploadVendorW9Result } from './actions'

const MAX_BYTES = 10 * 1024 * 1024

/**
 * Vendor W-9 PDF upload form. Mirrors the DJ upload-form.tsx — see
 * /dj/upload-w9/upload-form.tsx for design notes.
 */
export function UploadForm({
  hasExisting,
}: {
  hasExisting: boolean
}) {
  const formRef = useRef<HTMLFormElement>(null)
  const [pending, startTransition] = useTransition()
  const [view, setView] = useState<
    | { kind: 'idle' }
    | { kind: 'sent' }
    | { kind: 'error'; message: string }
  >({ kind: 'idle' })

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const fd = new FormData(form)
    const file = fd.get('w9') as File | null

    if (!file || file.size === 0) {
      setView({ kind: 'error', message: 'Choose a PDF file first.' })
      return
    }
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setView({ kind: 'error', message: 'Only PDF files are accepted.' })
      return
    }
    if (file.size > MAX_BYTES) {
      setView({ kind: 'error', message: 'File must be 10 MB or smaller.' })
      return
    }

    startTransition(async () => {
      const result: UploadVendorW9Result = await uploadVendorW9(fd)
      if (result.ok) {
        setView({ kind: 'sent' })
        formRef.current?.reset()
        return
      }
      setView({ kind: 'error', message: friendlyError(result) })
    })
  }

  if (view.kind === 'sent') {
    return (
      <div className="space-y-3 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200">
        <p>W-9 received. You&apos;re all set.</p>
        <a
          href="/vendor/profile"
          className="inline-block rounded-md bg-emerald-900 px-3 py-1.5 text-xs font-medium text-emerald-50 hover:bg-emerald-800 dark:bg-emerald-200 dark:text-emerald-950 dark:hover:bg-emerald-100"
        >
          View profile
        </a>
      </div>
    )
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label
          htmlFor="w9"
          className="block text-sm font-medium text-zinc-800 dark:text-zinc-200"
        >
          W-9 PDF
        </label>
        <input
          id="w9"
          name="w9"
          type="file"
          accept="application/pdf,.pdf"
          required
          disabled={pending}
          className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-zinc-700 hover:file:bg-zinc-200 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:file:bg-zinc-800 dark:file:text-zinc-300 dark:hover:file:bg-zinc-700"
        />
        <p className="text-xs text-zinc-500 dark:text-zinc-500">
          PDF only, 10 MB max.{' '}
          {hasExisting && 'Uploading a new file replaces the existing W-9.'}
        </p>
      </div>

      {view.kind === 'error' && (
        <p className="text-sm text-red-600 dark:text-red-400">{view.message}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
      >
        {pending ? 'Uploading…' : hasExisting ? 'Replace W-9' : 'Upload W-9'}
      </button>
    </form>
  )
}

function friendlyError(
  result: Exclude<UploadVendorW9Result, { ok: true }>
): string {
  switch (result.reason) {
    case 'unauth':
      return 'Your session expired. Sign in again.'
    case 'wrong_role':
      return 'This page is for vendor accounts only.'
    case 'no_file':
      return 'Choose a PDF file first.'
    case 'wrong_type':
      return 'Only PDF files are accepted.'
    case 'too_large':
      return 'File must be 10 MB or smaller.'
    case 'no_vendor_row':
      return 'Profile setup incomplete. Contact admin.'
    case 'storage_failed':
      return `Upload failed: ${result.message}`
    case 'db_failed':
      return `Saved file but couldn't update profile: ${result.message}`
  }
}
