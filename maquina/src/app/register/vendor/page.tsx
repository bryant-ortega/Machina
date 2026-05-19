import { RegistrationForm } from './registration-form'

/**
 * Public vendor self-registration. No auth required. Mirrors
 * /register/dj but writes to the `vendors` table and gives the new
 * profile role = 'vendor'. After successful registration the user
 * lands on /vendor/upload-w9.
 */
export default function VendorRegisterPage() {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-lg space-y-6 rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="space-y-1.5">
          <h1 className="text-xl font-semibold tracking-tight">
            Register as a vendor
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Create your vendor account so LosGothsCo can book your services.
            You&apos;ll upload your W-9 right after.
          </p>
        </div>
        <RegistrationForm />
      </div>
    </div>
  )
}
