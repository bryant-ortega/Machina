import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { EditDjForm } from './edit-form'
import { W9DownloadButton } from './w9-download'
import { W9UploadButton } from './w9-upload'

/**
 * Admin DJ profile. Editable form for every field on the djs row, plus a
 * W-9 download button (when one is on file) and the DJ's booking history
 * pulled from event_dj_slots ⋈ events.
 *
 * Auth gate: handled by the (admin) layout (admin role required).
 */
export default async function AdminDjProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()

  const { data: dj, error } = await supabase
    .from('djs')
    .select(
      'id, dj_name, government_name, email, phone, region, pay_method, pay_handle, rank, w9_status, w9_storage_path, registered_at'
    )
    .eq('id', id)
    .maybeSingle()

  if (error || !dj) notFound()

  // Booking history. event_dj_slots → events join. Sorted upcoming-first.
  const { data: slots } = await supabase
    .from('event_dj_slots')
    .select(
      'id, slot_type, slot_order, rate, start_time, end_time, events(id, title, date, city, state, type, status)'
    )
    .eq('dj_id', id)

  // Supabase types the joined `events` as either an array or a single
  // object depending on FK cardinality. event_dj_slots.event_id is a
  // single FK so we coerce to a singular shape for the table render.
  type RawSlot = {
    id: string
    slot_type: string
    slot_order: number
    rate: number | null
    start_time: string | null
    end_time: string | null
    events:
      | {
          id: string
          title: string
          date: string
          city: string
          state: string
          type: string
          status: string
        }
      | {
          id: string
          title: string
          date: string
          city: string
          state: string
          type: string
          status: string
        }[]
      | null
  }
  const bookings = ((slots ?? []) as RawSlot[])
    .map((s) => ({
      ...s,
      event: Array.isArray(s.events) ? s.events[0] : s.events,
    }))
    .filter((s) => s.event)
    .sort((a, b) => (a.event!.date < b.event!.date ? 1 : -1))

  return (
    <div className="flex-1 px-8 py-10">
      <div className="mx-auto max-w-4xl space-y-8">
        <div>
          <Link
            href="/djs"
            className="text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            ← All DJs
          </Link>
        </div>

        <header className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              {dj.dj_name}
            </h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {dj.government_name} ·{' '}
              {dj.region}
              {dj.rank ? ` · ${dj.rank}` : ''}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-500">
              Registered{' '}
              {new Date(dj.registered_at as string).toLocaleDateString(
                undefined,
                { year: 'numeric', month: 'short', day: 'numeric' }
              )}
            </p>
          </div>

          {dj.w9_status === 'on_file' && dj.w9_storage_path ? (
            <div className="flex flex-col items-end gap-2">
              <W9DownloadButton
                storagePath={dj.w9_storage_path}
                fileName="Download W-9"
              />
              <W9UploadButton djId={dj.id} variant="replace" />
            </div>
          ) : (
            <div className="flex flex-col items-end gap-2">
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
                ⚠ W-9 pending
              </span>
              <W9UploadButton djId={dj.id} variant="upload" />
            </div>
          )}
        </header>

        <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="mb-5 text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Edit profile
          </h2>
          <EditDjForm
            djId={dj.id}
            initial={{
              dj_name: dj.dj_name,
              government_name: dj.government_name,
              email: dj.email,
              phone: dj.phone ?? '',
              region: dj.region as
                | 'SoCal'
                | 'NorCal'
                | 'Chicago'
                | 'Arizona'
                | 'Seattle'
                | 'Other',
              pay_method: (dj.pay_method ?? '') as
                | ''
                | 'zelle'
                | 'venmo'
                | 'paypal',
              pay_handle: dj.pay_handle ?? '',
              rank: dj.rank ?? '',
              w9_status: dj.w9_status as 'pending' | 'on_file',
            }}
          />
        </section>

        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              Booking history
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {bookings.length}{' '}
              {bookings.length === 1 ? 'booking' : 'bookings'}
            </p>
          </div>

          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Date</th>
                  <th className="px-4 py-2.5 font-medium">Event</th>
                  <th className="px-4 py-2.5 font-medium">Slot</th>
                  <th className="px-4 py-2.5 font-medium">Rate</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
                {bookings.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-zinc-500 dark:text-zinc-400"
                    >
                      No bookings yet.
                    </td>
                  </tr>
                ) : (
                  bookings.map((b) => (
                    <tr key={b.id}>
                      <td className="whitespace-nowrap px-4 py-3 text-zinc-700 dark:text-zinc-300">
                        {new Date(b.event!.date).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-zinc-900 dark:text-zinc-100">
                          {b.event!.title}
                        </p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          {b.event!.city}, {b.event!.state} · {b.event!.type}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                        {prettySlot(b.slot_type)}
                      </td>
                      <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                        {b.rate !== null && b.rate !== undefined
                          ? `$${Number(b.rate).toLocaleString()}`
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={b.event!.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}

function prettySlot(slot: string): string {
  switch (slot) {
    case 'open':
      return 'Open'
    case 'support_1':
      return 'Support 1'
    case 'support_2':
      return 'Support 2'
    case 'main_support':
      return 'Main support'
    case 'headline':
      return 'Headline'
    case 'close':
      return 'Close'
    case 'resident':
      return 'Resident'
    default:
      return slot
  }
}

function StatusBadge({ status }: { status: string }) {
  const isConfirmed = status === 'confirmed'
  return (
    <span
      className={
        isConfirmed
          ? 'rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200'
          : 'rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
      }
    >
      {status}
    </span>
  )
}
