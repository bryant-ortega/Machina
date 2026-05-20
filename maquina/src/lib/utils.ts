import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Combine Tailwind class names, deduplicating conflicts. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Returns true if a YYYY-MM-DD date string is strictly before today
 * in the user's local time. Today returns false (today is not "past").
 *
 * Used to fade past-event rows in list views so upcoming/today events
 * stand out visually. Works in both light and dark mode (the caller
 * applies an opacity class — no color is hard-coded here).
 *
 * Null/undefined/empty input returns false (we don't fade rows that
 * have no date).
 */
export function isPastDate(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false
  const now = new Date()
  const today =
    `${now.getFullYear()}-` +
    `${String(now.getMonth() + 1).padStart(2, '0')}-` +
    `${String(now.getDate()).padStart(2, '0')}`
  return dateStr < today
}
