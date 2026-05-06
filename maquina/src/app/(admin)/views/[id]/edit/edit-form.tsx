'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import {
  FIELDS,
  FIELD_BY_KEY,
  FIELD_CATEGORIES,
  type FieldCategoryKey,
} from '@/lib/view-fields'
import { saveView, deleteView } from '../../actions'

/**
 * Edit-view client component. State is local: every interaction
 * (toggle, rename, reorder, add, remove) mutates the in-memory
 * `selected` list. The Save button posts the whole list to the
 * saveView server action which diffs and writes.
 *
 * Why one big save instead of per-row server actions: keeps the UX
 * fast (no flicker on every drag) and the server logic simple (one
 * authoritative diff). The form preserves position by ordering
 * `selected` — we re-number to 0..N-1 right before save.
 */
export function EditViewForm({
  view,
  initialFields,
}: {
  view: {
    id: string
    name: string
    description: string
    audience:
      | 'internal'
      | 'designer'
      | 'venue'
      | 'dj'
      | 'partner'
      | 'other'
  }
  initialFields: SelectedField[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [deleting, startDelete] = useTransition()

  const [name, setName] = useState(view.name)
  const [description, setDescription] = useState(view.description)
  const [audience, setAudience] = useState(view.audience)
  const [selected, setSelected] = useState<SelectedField[]>(
    [...initialFields].sort((a, b) => a.position - b.position)
  )
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<Date | null>(null)

  const selectedKeys = useMemo(
    () => new Set(selected.map((f) => f.field_key)),
    [selected]
  )

  // Available = catalog fields not currently in `selected`, grouped
  // by category. Keeps catalog order within each group.
  const available = useMemo(() => {
    const groups = new Map<
      FieldCategoryKey,
      { key: string; label: string }[]
    >()
    for (const c of FIELD_CATEGORIES) groups.set(c.key, [])
    for (const f of FIELDS) {
      if (selectedKeys.has(f.key)) continue
      groups.get(f.category)!.push({ key: f.key, label: f.label })
    }
    return groups
  }, [selectedKeys])

  function addField(key: string) {
    const def = FIELD_BY_KEY.get(key)
    if (!def) return
    setSelected((cur) => [
      ...cur,
      {
        field_key: key,
        label: def.label,
        position: cur.length,
        visible: true,
      },
    ])
  }

  function removeField(key: string) {
    setSelected((cur) => cur.filter((f) => f.field_key !== key))
  }

  function moveField(key: string, dir: -1 | 1) {
    setSelected((cur) => {
      const idx = cur.findIndex((f) => f.field_key === key)
      if (idx === -1) return cur
      const j = idx + dir
      if (j < 0 || j >= cur.length) return cur
      const next = cur.slice()
      ;[next[idx], next[j]] = [next[j], next[idx]]
      return next
    })
  }

  function updateField(key: string, patch: Partial<SelectedField>) {
    setSelected((cur) =>
      cur.map((f) => (f.field_key === key ? { ...f, ...patch } : f))
    )
  }

  function onSave(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const payload = {
      id: view.id,
      name: name.trim(),
      description: description.trim() || null,
      audience,
      // Renumber positions 0..N-1 — the user's reorder operations
      // produce gaps otherwise.
      fields: selected.map((f, i) => ({
        field_key: f.field_key,
        label: f.label.trim() || FIELD_BY_KEY.get(f.field_key)?.label || f.field_key,
        position: i,
        visible: f.visible,
      })),
    }

    startTransition(async () => {
      const result = await saveView(payload)
      if (result.ok) {
        setSavedAt(new Date())
        router.refresh()
      } else {
        setError(messageFor(result))
      }
    })
  }

  function onDelete() {
    if (
      !confirm(
        `Delete "${name}"? This can't be undone. Per-event customizations for this view will also be deleted.`
      )
    ) {
      return
    }
    startDelete(async () => {
      const result = await deleteView(view.id)
      // deleteView calls redirect() on success — control should never
      // return here in the success path. If it does, it's an error.
      if (!result?.ok) {
        setError(messageFor(result))
      }
    })
  }

  return (
    <form onSubmit={onSave} className="space-y-6">
      {/* Metadata block */}
      <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <Field label="Name" htmlFor="view-name">
          <input
            id="view-name"
            type="text"
            required
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            disabled={pending || deleting}
          />
        </Field>

        <Field
          label="Description"
          htmlFor="view-desc"
          hint="Optional. What's this view for?"
        >
          <input
            id="view-desc"
            type="text"
            maxLength={500}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={inputClass}
            disabled={pending || deleting}
          />
        </Field>

        <Field label="Audience" htmlFor="view-aud">
          <select
            id="view-aud"
            value={audience}
            onChange={(e) =>
              setAudience(e.target.value as typeof audience)
            }
            className={inputClass}
            disabled={pending || deleting}
          >
            <option value="internal">Internal</option>
            <option value="designer">Designer</option>
            <option value="venue">Venue</option>
            <option value="dj">DJ</option>
            <option value="partner">Partner</option>
            <option value="other">Other</option>
          </select>
        </Field>
      </section>

      {/* Selected fields */}
      <section className="space-y-3">
        <header className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-700 dark:text-zinc-300">
            Selected fields
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {selected.length} field{selected.length === 1 ? '' : 's'}
          </p>
        </header>

        {selected.length === 0 ? (
          <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-6 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
            No fields yet. Add some from the list below.
          </div>
        ) : (
          <ol className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
            {selected.map((f, i) => {
              const def = FIELD_BY_KEY.get(f.field_key)
              return (
                <li
                  key={f.field_key}
                  className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-zinc-100 px-3 py-2.5 last:border-b-0 dark:border-zinc-900"
                >
                  <label className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300">
                    <input
                      type="checkbox"
                      checked={f.visible}
                      onChange={(e) =>
                        updateField(f.field_key, {
                          visible: e.target.checked,
                        })
                      }
                      className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-900"
                    />
                    Show
                  </label>

                  <div className="min-w-0">
                    <input
                      type="text"
                      value={f.label}
                      onChange={(e) =>
                        updateField(f.field_key, {
                          label: e.target.value,
                        })
                      }
                      maxLength={80}
                      placeholder={def?.label ?? f.field_key}
                      className={`${inputClass} text-sm`}
                    />
                    <p className="mt-0.5 truncate text-[10px] uppercase tracking-wide text-zinc-400 dark:text-zinc-600">
                      {def?.category} · {def?.kind} · {f.field_key}
                    </p>
                  </div>

                  <div className="flex gap-1">
                    <ArrowButton
                      label="Move up"
                      disabled={i === 0}
                      onClick={() => moveField(f.field_key, -1)}
                    >
                      ↑
                    </ArrowButton>
                    <ArrowButton
                      label="Move down"
                      disabled={i === selected.length - 1}
                      onClick={() => moveField(f.field_key, 1)}
                    >
                      ↓
                    </ArrowButton>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeField(f.field_key)}
                    className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-rose-400 dark:hover:bg-rose-950/40"
                  >
                    Remove
                  </button>
                </li>
              )
            })}
          </ol>
        )}
      </section>

      {/* Available fields, grouped by category */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-700 dark:text-zinc-300">
          Add fields
        </h2>
        <div className="space-y-3">
          {FIELD_CATEGORIES.map((c) => {
            const items = available.get(c.key) ?? []
            if (items.length === 0) return null
            return (
              <div
                key={c.key}
                className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
              >
                <header className="border-b border-zinc-200 bg-zinc-50 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                  {c.label}
                </header>
                <ul className="flex flex-wrap gap-2 p-3">
                  {items.map((f) => (
                    <li key={f.key}>
                      <button
                        type="button"
                        onClick={() => addField(f.key)}
                        className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
                      >
                        + {f.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
          {Array.from(available.values()).every((g) => g.length === 0) ? (
            <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-4 text-xs text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
              All catalog fields are already in this view.
            </div>
          ) : null}
        </div>
      </section>

      {/* Footer: status + save / delete */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <div className="text-xs text-zinc-500 dark:text-zinc-400">
          {error ? (
            <span className="font-medium text-rose-700 dark:text-rose-300">
              {error}
            </span>
          ) : savedAt ? (
            <span>Saved {savedAt.toLocaleTimeString()}.</span>
          ) : (
            <span>Unsaved changes won&apos;t persist until you hit Save.</span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onDelete}
            disabled={pending || deleting}
            className="rounded-md border border-rose-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900/60 dark:bg-zinc-950 dark:text-rose-300 dark:hover:bg-rose-950/40"
          >
            {deleting ? 'Deleting…' : 'Delete view'}
          </button>
          <button
            type="submit"
            disabled={pending || deleting || !name.trim()}
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {pending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type SelectedField = {
  field_key: string
  label: string
  position: number
  visible: boolean
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string
  htmlFor: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={htmlFor}
        className="block text-xs font-medium text-zinc-700 dark:text-zinc-300"
      >
        {label}
      </label>
      {children}
      {hint ? (
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{hint}</p>
      ) : null}
    </div>
  )
}

function ArrowButton({
  children,
  disabled,
  onClick,
  label,
}: {
  children: React.ReactNode
  disabled: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="grid h-7 w-7 place-items-center rounded-md border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 disabled:opacity-30 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
    >
      {children}
    </button>
  )
}

const inputClass =
  'block w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 shadow-sm outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-300 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100'

function messageFor(
  result?:
    | { ok: false; reason: string; message?: string }
    | { ok: true; id: string }
): string {
  if (!result) return 'Action failed.'
  if (result.ok) return 'OK'
  switch (result.reason) {
    case 'unauth':
      return 'You must be signed in.'
    case 'forbidden':
      return 'Only admins can edit views (system views are read-only).'
    case 'invalid':
      return result.message ?? 'Invalid input.'
    case 'not_found':
      return 'View not found.'
    case 'db':
      return result.message ?? 'Database error. Try again.'
    default:
      return 'Something went wrong.'
  }
}
