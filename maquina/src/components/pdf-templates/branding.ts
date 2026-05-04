/**
 * Brand asset paths for the PDF templates.
 *
 * react-pdf's <Image> can take an absolute filesystem path on the Node
 * runtime — much faster than refetching the public URL over HTTP. The
 * route handler runs from the project root (`process.cwd()`), so we
 * resolve relative to that.
 *
 * Two layers of brand:
 *
 *   1. **Page chrome** — every PDF gets the LosGothsCo wordmark + the
 *      skull-in-triangle mark in the top brand band. Always shown.
 *
 *   2. **Event title artwork** — recurring event series have their own
 *      wordmarks. When an event's title (case-insensitive, trimmed)
 *      matches one of the keys below, the template renders the artwork
 *      in place of plain title text. Falls back to plain text otherwise.
 *
 * Add new series by dropping the PNG into `/public/brand/` and adding
 * an entry to TITLE_ARTWORK with the right aspect ratio (width/height).
 */

import * as path from 'node:path'

const BRAND_DIR = path.join(process.cwd(), 'public', 'brand')

/** LosGothsCo wordmark — black gothic letters on transparent. ~3.96:1. */
export const LOGO_LOSGOTHS_WORDMARK = path.join(
  BRAND_DIR,
  'losgoths-wordmark-nowhite.png'
)

/** Skull-in-triangle mark — black on transparent. ~1.06:1 (near square). */
export const LOGO_LOSGOTHS_TRIANGLE = path.join(
  BRAND_DIR,
  'inverted-losgoths-logo.png'
)

/** Gothicumbia event-series wordmark. ~2.47:1. */
export const LOGO_GOTHICUMBIA = path.join(BRAND_DIR, 'gothicumbia-logo.png')

export type TitleArtwork = {
  src: string
  /** width / height. Used by templates to compute width from a target height. */
  aspect: number
}

/**
 * Map of normalized event titles → wordmark artwork. Lookup key is the
 * title lowercased + trimmed, so "gothicumbia", "Gothicumbia", and
 * "  Gothicumbia  " all hit the same entry.
 */
const TITLE_ARTWORK: Record<string, TitleArtwork> = {
  gothicumbia: { src: LOGO_GOTHICUMBIA, aspect: 2056 / 832 },
}

export function resolveTitleArtwork(title: string): TitleArtwork | null {
  if (!title) return null
  return TITLE_ARTWORK[title.trim().toLowerCase()] ?? null
}
