/**
 * View Builder — canonical field catalog.
 *
 * Every field that can be added to a custom view is declared here.
 * The Field Picker (Phase 17d) reads this list to show categorized
 * available fields, and the renderer (Phase 17f) reads it to know how
 * to extract a value from an event row for a given field_key.
 *
 * Field keys are the source of truth. They're written to
 * `view_fields.field_key` and `event_view_customizations.field_key`,
 * and they live independent of column names — so we can rename a
 * database column later without breaking saved views as long as we
 * update the `accessor` here.
 *
 * Adding a new field:
 *   1. Pick a stable key (snake_case). Don't change keys later — that
 *      would break every saved view that references it.
 *   2. Decide which category it belongs in.
 *   3. Choose a `kind` so the renderer knows how to format it.
 *   4. Write a one-line `accessor` that extracts the value from the
 *      event row. The row shape is the union of the event row plus
 *      any joined data the renderer pulls (venues, primary stage's
 *      slot count, etc.) — keep accessors defensive about nulls.
 */

// ---------------------------------------------------------------------------
// Categories — order matters: this is the order the Field Picker
// renders them.
// ---------------------------------------------------------------------------
export const FIELD_CATEGORIES = [
  { key: 'basics', label: 'Basics' },
  { key: 'dates', label: 'Dates' },
  { key: 'schedule', label: 'Schedule' },
  { key: 'venue', label: 'Venue & deal' },
  { key: 'lineup', label: 'Lineup' },
  { key: 'financial', label: 'Financials' },
] as const

export type FieldCategoryKey = (typeof FIELD_CATEGORIES)[number]['key']

// ---------------------------------------------------------------------------
// Field shape
// ---------------------------------------------------------------------------

/**
 * `kind` controls how the renderer formats a value:
 *   text      — plain string, no formatting
 *   number    — number formatted with locale grouping
 *   currency  — `$` prefix, two decimals, locale grouping
 *   percent   — `%` suffix
 *   date      — short date ("Mar 15, 2026")
 *   time      — clock time ("9:00 PM")
 *   bool      — checkmark / dash
 *   enum      — text, but signals the renderer to pretty-print known values
 *   link      — text + clickable, used for the title column
 */
export type FieldKind =
  | 'text'
  | 'number'
  | 'currency'
  | 'percent'
  | 'date'
  | 'time'
  | 'bool'
  | 'enum'
  | 'link'

/** Row shape passed to accessors. Loose by design — accessors should
 *  null-coalesce. */
export type EventViewRow = {
  id: string
  event_id?: string | null
  title?: string | null
  type?: string | null
  status?: string | null
  collab?: boolean | null
  date?: string | null
  day_of_week?: string | null
  weekend_number?: number | null
  weekend_flag?: string | null
  year?: number | null
  city?: string | null
  state?: string | null
  capacity?: number | null
  doors_time?: string | null
  end_time?: string | null
  stages?: number | null
  rent?: number | null
  split_pct?: number | null
  venue_tix_fee?: number | null
  guarantee?: boolean | null
  bar_included?: boolean | null
  announce_date?: string | null
  begin_art_date?: string | null
  art_due_date?: string | null
  on_sale_date?: string | null
  advance_contact_email?: string | null
  advance_contact_phone?: string | null
  // Joined / computed extras the renderer may attach:
  venue_name?: string | null
  venue_address?: string | null
  dj_count?: number | null
  headliner_name?: string | null
}

export type FieldDef = {
  key: string
  label: string
  category: FieldCategoryKey
  kind: FieldKind
  accessor: (row: EventViewRow) => unknown
  /** True for fields that should be on by default when seeding a new
   *  custom view. */
  defaultOn?: boolean
}

// ---------------------------------------------------------------------------
// The catalog. Order within a category is the default Field Picker
// order. `defaultOn: true` means a fresh custom view starts with this
// field visible.
// ---------------------------------------------------------------------------
export const FIELDS: readonly FieldDef[] = [
  // -------- Basics --------
  { key: 'title',          label: 'Title',         category: 'basics',    kind: 'link',    accessor: (r) => r.title ?? '',          defaultOn: true },
  { key: 'event_id',       label: 'Event ID',      category: 'basics',    kind: 'text',    accessor: (r) => r.event_id ?? '' },
  { key: 'type',           label: 'Type',          category: 'basics',    kind: 'enum',    accessor: (r) => r.type ?? '' },
  { key: 'status',         label: 'Status',        category: 'basics',    kind: 'enum',    accessor: (r) => r.status ?? '',         defaultOn: true },
  { key: 'collab',         label: 'Collab',        category: 'basics',    kind: 'bool',    accessor: (r) => !!r.collab },
  { key: 'city',           label: 'City',          category: 'basics',    kind: 'text',    accessor: (r) => r.city ?? '',           defaultOn: true },
  { key: 'state',          label: 'State',         category: 'basics',    kind: 'text',    accessor: (r) => r.state ?? '' },

  // -------- Dates --------
  { key: 'date',           label: 'Date',          category: 'dates',     kind: 'date',    accessor: (r) => r.date ?? '',           defaultOn: true },
  { key: 'day_of_week',    label: 'Day',           category: 'dates',     kind: 'text',    accessor: (r) => r.day_of_week ?? '' },
  { key: 'weekend_number', label: 'Weekend #',     category: 'dates',     kind: 'number',  accessor: (r) => r.weekend_number ?? 0 },
  { key: 'weekend_flag',   label: 'Weekend flag',  category: 'dates',     kind: 'enum',    accessor: (r) => r.weekend_flag ?? '' },
  { key: 'announce_date',  label: 'Announce',      category: 'dates',     kind: 'date',    accessor: (r) => r.announce_date ?? '' },
  { key: 'begin_art_date', label: 'Begin art',     category: 'dates',     kind: 'date',    accessor: (r) => r.begin_art_date ?? '' },
  { key: 'art_due_date',   label: 'Art due',       category: 'dates',     kind: 'date',    accessor: (r) => r.art_due_date ?? '' },
  { key: 'on_sale_date',   label: 'On sale',       category: 'dates',     kind: 'date',    accessor: (r) => r.on_sale_date ?? '' },

  // -------- Schedule --------
  { key: 'doors_time',     label: 'Doors',         category: 'schedule',  kind: 'time',    accessor: (r) => r.doors_time ?? '' },
  { key: 'end_time',       label: 'End',           category: 'schedule',  kind: 'time',    accessor: (r) => r.end_time ?? '' },
  { key: 'stages',         label: 'Stages',        category: 'schedule',  kind: 'number',  accessor: (r) => r.stages ?? 1 },

  // -------- Venue & deal --------
  { key: 'venue_name',     label: 'Venue',         category: 'venue',     kind: 'text',    accessor: (r) => r.venue_name ?? '',     defaultOn: true },
  { key: 'venue_address',  label: 'Venue address', category: 'venue',     kind: 'text',    accessor: (r) => r.venue_address ?? '' },
  { key: 'capacity',       label: 'Capacity',      category: 'venue',     kind: 'number',  accessor: (r) => r.capacity ?? 0 },
  { key: 'guarantee',      label: 'Guarantee',     category: 'venue',     kind: 'bool',    accessor: (r) => !!r.guarantee },
  { key: 'bar_included',   label: 'Bar included',  category: 'venue',     kind: 'bool',    accessor: (r) => !!r.bar_included },
  { key: 'rent',           label: 'Rent',          category: 'venue',     kind: 'currency',accessor: (r) => r.rent ?? 0 },
  { key: 'venue_tix_fee',  label: 'Venue tix fee', category: 'venue',     kind: 'currency',accessor: (r) => r.venue_tix_fee ?? 0 },
  { key: 'advance_contact_email', label: 'Advance email', category: 'venue', kind: 'text', accessor: (r) => r.advance_contact_email ?? '' },
  { key: 'advance_contact_phone', label: 'Advance phone', category: 'venue', kind: 'text', accessor: (r) => r.advance_contact_phone ?? '' },

  // -------- Lineup --------
  { key: 'dj_count',       label: 'DJ count',      category: 'lineup',    kind: 'number',  accessor: (r) => r.dj_count ?? 0 },
  { key: 'headliner_name', label: 'Headliner',     category: 'lineup',    kind: 'text',    accessor: (r) => r.headliner_name ?? '' },

  // -------- Financials --------
  { key: 'split_pct',      label: 'Split %',       category: 'financial', kind: 'percent', accessor: (r) => r.split_pct ?? 0 },
] as const

// ---------------------------------------------------------------------------
// Quick lookups
// ---------------------------------------------------------------------------
export const FIELD_BY_KEY: ReadonlyMap<string, FieldDef> = new Map(
  FIELDS.map((f) => [f.key, f])
)

export function fieldsByCategory(): Map<FieldCategoryKey, FieldDef[]> {
  const out = new Map<FieldCategoryKey, FieldDef[]>()
  for (const c of FIELD_CATEGORIES) out.set(c.key, [])
  for (const f of FIELDS) out.get(f.category)!.push(f)
  return out
}

/** Default field set used when seeding a freshly-created custom view.
 *  Keys returned in the order they appear in FIELDS — that becomes
 *  the initial position. */
export function defaultFieldSeed(): {
  field_key: string
  label: string
  position: number
  visible: boolean
}[] {
  return FIELDS.filter((f) => f.defaultOn).map((f, i) => ({
    field_key: f.key,
    label: f.label,
    position: i,
    visible: true,
  }))
}
