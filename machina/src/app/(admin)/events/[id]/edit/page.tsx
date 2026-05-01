import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { EditEventForm } from './edit-event-form'

/**
 * Admin event edit page (Phase 7b).
 *
 * Pre-fetches everything the form needs:
 *   - The event row + its joined venue (for the venue_name field default)
 *   - All stages + slots tied to this event (for diff-aware children)
 *   - DJ roster (for the slot DJ dropdown)
 *   - All venues (for the city-filtered autocomplete)
 *
 * Auth gate: handled by the (admin) layout.
 */
export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()

  const [
    { data: event, error: eventErr },
    { data: stages },
    { data: slots },
    { data: djs },
    { data: venues },
  ] = await Promise.all([
    supabase
      .from('events')
      .select(
        'id, year, date, event_id, weekend_number, weekend_flag, day_of_week, title, type, venue_id, city, state, status, collab, stages, doors_time, end_time, capacity, guarantee, bar_included, rent, split_pct, venue_tix_fee, advance_contact_email, advance_contact_phone, announce_date, begin_art_date, art_due_date, on_sale_date, venues(name)'
      )
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('event_stages')
      .select('id, stage_number, stage_name')
      .eq('event_id', id)
      .order('stage_number', { ascending: true }),
    supabase
      .from('event_dj_slots')
      .select(
        'id, stage_id, slot_order, slot_type, dj_id, rate, start_time, end_time'
      )
      .eq('event_id', id)
      .order('stage_id', { ascending: true })
      .order('slot_order', { ascending: true }),
    supabase
      .from('djs')
      .select('id, dj_name, region')
      .order('dj_name', { ascending: true }),
    supabase
      .from('venues')
      .select('id, name, city, state')
      .order('name', { ascending: true }),
  ])

  if (eventErr || !event) notFound()

  // Supabase types the joined venue as either array or single. Coerce.
  const venueName =
    (Array.isArray(event.venues)
      ? event.venues[0]?.name
      : (event.venues as { name: string } | null)?.name) ?? ''

  // Convert each DB stage into the form's expected shape, mapping
  // stage_id → stage_number for the slots so the form can work in
  // stage-number space (matching how createEvent handles it).
  const stageList = (stages ?? []).map((s) => ({
    id: s.id as string,
    stage_number: s.stage_number as number,
    stage_name: s.stage_name as string,
  }))

  const stageNumberById = new Map<string, number>(
    stageList.map((s) => [s.id, s.stage_number])
  )

  const slotList = (slots ?? []).map((s) => ({
    id: s.id as string,
    stage_number: stageNumberById.get(s.stage_id as string) ?? 1,
    slot_order: s.slot_order as number,
    slot_type: s.slot_type as string,
    dj_id: s.dj_id as string,
    rate: s.rate as number | null,
    start_time: s.start_time as string | null,
    end_time: s.end_time as string | null,
  }))

  // Strip 'HH:MM:SS' tail from time fields — Postgres TIME columns return
  // 'HH:MM:SS' but <input type="time"> wants 'HH:MM'.
  const trimTime = (t: string | null) =>
    t ? t.split(':').slice(0, 2).join(':') : ''

  return (
    <div className="flex-1 px-8 py-10">
      <div className="mx-auto max-w-5xl space-y-8">
        <div>
          <Link
            href="/events"
            className="text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            ← All events
          </Link>
        </div>

        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Edit event
          </h1>
          <p className="font-mono text-xs text-zinc-500 dark:text-zinc-500">
            {event.event_id}
          </p>
        </header>

        <EditEventForm
          djs={djs ?? []}
          venues={venues ?? []}
          initial={{
            id: event.id as string,
            type: event.type as 'club' | 'concert' | 'festival',
            date: event.date as string,
            title: (event.title as string) ?? '',
            city: (event.city as string) ?? '',
            state: (event.state as string) ?? '',
            venue_name: venueName,
            status: event.status as 'tentative' | 'confirmed',
            collab: !!event.collab,
            doors_time: trimTime(event.doors_time as string | null),
            end_time: trimTime(event.end_time as string | null),
            capacity: event.capacity == null ? '' : String(event.capacity),
            guarantee: !!event.guarantee,
            bar_included: !!event.bar_included,
            rent: event.rent == null ? '' : String(event.rent),
            split_pct: event.split_pct == null ? '' : String(event.split_pct),
            venue_tix_fee:
              event.venue_tix_fee == null ? '' : String(event.venue_tix_fee),
            advance_contact_email:
              (event.advance_contact_email as string | null) ?? '',
            advance_contact_phone:
              (event.advance_contact_phone as string | null) ?? '',
            announce_date: event.announce_date as string,
            begin_art_date: event.begin_art_date as string,
            art_due_date: event.art_due_date as string,
            on_sale_date: event.on_sale_date as string,
            stages: stageList,
            slots: slotList.map((s) => ({
              ...s,
              rate: s.rate == null ? '' : String(s.rate),
              start_time: trimTime(s.start_time),
              end_time: trimTime(s.end_time),
            })),
          }}
        />
      </div>
    </div>
  )
}
