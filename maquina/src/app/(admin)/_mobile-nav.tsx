'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'

/**
 * Mobile sidebar drawer for the admin shell.
 *
 * Layout strategy:
 *   - On md+ screens: the drawer is irrelevant; the sidebar in
 *     (admin)/layout.tsx renders inline via `md:flex md:w-60`.
 *   - On mobile: the sidebar is hidden by default. A small hamburger
 *     button in the top bar (rendered by this component) opens the
 *     drawer as a fixed overlay.
 *
 * The drawer's open/close state is local — no need for context or a
 * prop chain. Closing on route change is handled by the usePathname
 * effect below: any nav link click changes the path, which fires the
 * effect and dismisses the drawer automatically.
 */

export function MobileNavTrigger() {
  // Stub — the real button + drawer live in MobileNav below. Splitting
  // them keeps the trigger easy to drop into the layout's top bar
  // without pulling in nav children. Trigger and drawer share state via
  // a custom event; simpler than context for this size.
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent('mobile-nav-open'))}
      className="inline-flex items-center justify-center rounded-md border border-zinc-200 bg-white p-2 text-zinc-700 shadow-sm md:hidden dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300"
      aria-label="Open menu"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="3" y1="6" x2="21" y2="6" />
        <line x1="3" y1="12" x2="21" y2="12" />
        <line x1="3" y1="18" x2="21" y2="18" />
      </svg>
    </button>
  )
}

export function MobileNav({
  children,
}: {
  /** The same nav contents the desktop sidebar uses, passed in by the layout. */
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  // Open the drawer when the trigger fires its custom event.
  useEffect(() => {
    const handler = () => setOpen(true)
    window.addEventListener('mobile-nav-open', handler)
    return () => window.removeEventListener('mobile-nav-open', handler)
  }, [])

  // Close on route change. Wrap setState in a microtask so React doesn't
  // flag a cascading render on the same tick.
  useEffect(() => {
    queueMicrotask(() => setOpen(false))
  }, [pathname])

  // Close on escape.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-40 flex md:hidden"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="absolute inset-0 bg-black/40"
        aria-label="Close menu"
      />
      {/* Drawer panel */}
      <div className="relative z-50 flex h-full w-72 max-w-[85vw] flex-col border-r border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <p className="text-sm font-semibold tracking-tight">Maquina</p>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
            aria-label="Close menu"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
