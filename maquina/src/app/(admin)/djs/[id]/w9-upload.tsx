'use client'

import { useRef, useState, useTransition } from 'react'
import { uploadDjW9, type UploadDjW9Result } from './actions'

/**
 * Admin-side W-9 upload button.
 *
 * Lets an admin drop a PDF in on behalf of a DJ — handy when the DJ
 * sends their W-9 by email/text instead of using the in-app uploader.
 * Hits {@link uploadDjW9}, which writes to the same `w9s/{user_id}/w9.pdf`
 * path the DJ-side uploader uses, then flips `w9_status` to `on_file`.
 *
 * The `variant` prop just tweaks the button label so we can render this
 * in two contexts:
 *   - 'upload' — when no W-9 is on file yet (paired with the pending badge)
 *   - 'replace' — when one IS on file (paired with the download button)
 */
export function W9UploadButton({
  djId,
  variant = 'upload',
}: {
  djId: string
  variant?: 'upload' | 'replace'
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [justUploaded, setJustUploaded] = useState(false)

  function onPick() {
    setError(null)
    fileInputRef.current?.click()
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Reset the input so picking the same file twice re-fires onChange.
    e.target.value = ''

    setError(null)
    setJustUploaded(false)

    const fd = new FormData()
    fd.set('dj_id', djId)
    fd.set('w9', file)

    startTransition(async () => {
      const result = await uploadDjW9(fd)
      if (result.ok) {
        setJustUploaded(true)
      } else {
        setError(messageFor(result))
      }
    })
  }

  const label = pending
    ? 'Uploading…'
    : variant === 'replace'
      ? 'Replace W-9'
      : 'Upload W-9'

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={onFileChange}
        />
        <button
          type="button"
          onClick={onPick}
          disabled={pending}
          className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          {label}
        </button>
      </div>
      {justUploaded && !error && (
        <span className="text-xs text-emerald-700 dark:text-emerald-400">
          W-9 uploaded ✓
        </span>
      )}
      {error && (
        <span className="max-w-xs text-right text-xs text-red-600 dark:text-red-400">
          {error}
        </span>
      )}
    </div>
  )
}

/**
 * Friendly copy for each failure mode the action can return. Keeps the
 * UI free of raw enum names like 'wrong_type' / 'storage_failed'.
 */
function messageFor(result: Exclude<UploadDjW9Result, { ok: true }>): string {
  switch (result.reason) {
    case 'unauth':
      return 'Session expired — please sign in again.'
    case 'forbidden':
      return 'Only admins can upload W-9s.'
    case 'invalid_id':
      return 'Invalid DJ id.'
    case 'no_dj_row':
      return "Couldn't find this DJ."
    case 'no_user_id':
      return result.message
    case 'no_file':
      return 'No file selected.'
    case 'wrong_type':
      return 'Only PDF files are accepted.'
    case 'too_large':
      return 'File is over the 10 MB limit.'
    case 'storage_failed':
      return `Upload failed: ${result.message}`
    case 'db_failed':
      return `Status update failed: ${result.message}`
  }
}
