import { RegistrationForm } from './registration-form'

/**
 * Public DJ self-registration. No auth required. The form posts to a server
 * action that pre-checks for duplicates, then sends a magic-link email. No
 * row is committed to `djs` until the link is clicked — the auth callback
 * drains the form fields out of user_metadata into the djs table.
 */
export default function DjRegisterPage() {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-lg space-y-6 rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="space-y-1.5">
          <h1 className="text-xl font-semibold tracking-tight">Register as a DJ</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Create your account to get added to the LosGothsCo roster.
            You&apos;ll upload your W-9 right after.
          </p>
        </div>
        <RegistrationForm />
      </div>
    </div>
  )
}
