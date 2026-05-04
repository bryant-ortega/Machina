/**
 * Shared @react-pdf/renderer styles + brand tokens for every PDF template.
 *
 * react-pdf doesn't read Tailwind — it has its own subset-of-CSS StyleSheet
 * API that runs through its own layout engine. So we redeclare a small
 * design system here in code instead of in tokens. Keep it tiny: header
 * wordmark, body type, table rows, and a couple of accent variants.
 *
 * All measurements are in points (1pt = 1/72in). Letter page is 612×792pt.
 */

import { StyleSheet } from '@react-pdf/renderer'

// Brand palette. Mirrors the on-screen Tailwind zinc-* + a single accent.
export const COLORS = {
  ink: '#18181b', // zinc-900 — primary text
  body: '#3f3f46', // zinc-700 — secondary text
  muted: '#71717a', // zinc-500 — meta / captions
  rule: '#d4d4d8', // zinc-300 — dividers
  band: '#f4f4f5', // zinc-100 — table-row alt / doors row band
  accent: '#000000', // wordmark / strong rule
  good: '#15803d', // green-700 — under budget / positive variance
  bad: '#b91c1c', // red-700 — over budget / negative variance
}

export const styles = StyleSheet.create({
  // ---------------- Page chrome ----------------
  page: {
    paddingTop: 48,
    paddingBottom: 56,
    paddingHorizontal: 48,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: COLORS.ink,
  },
  brandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingBottom: 8,
    borderBottom: `1pt solid ${COLORS.accent}`,
  },
  wordmark: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 14,
    letterSpacing: 2,
    color: COLORS.accent,
  },
  brandRight: {
    fontSize: 9,
    color: COLORS.muted,
  },
  pageFooter: {
    position: 'absolute',
    left: 48,
    right: 48,
    bottom: 32,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8,
    color: COLORS.muted,
  },

  // ---------------- Headings ----------------
  title: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 20,
    marginTop: 18,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10,
    color: COLORS.body,
    marginBottom: 2,
  },
  meta: {
    fontSize: 9,
    color: COLORS.muted,
    marginBottom: 16,
  },
  sectionTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
    marginTop: 14,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: COLORS.body,
  },
  sectionRule: {
    borderBottom: `0.5pt solid ${COLORS.rule}`,
    marginBottom: 6,
  },

  // ---------------- Tables ----------------
  table: {
    width: '100%',
    marginBottom: 4,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: `0.5pt solid ${COLORS.rule}`,
    paddingTop: 4,
    paddingBottom: 4,
  },
  tableHeadRow: {
    flexDirection: 'row',
    borderBottom: `0.5pt solid ${COLORS.ink}`,
    paddingTop: 4,
    paddingBottom: 4,
  },
  tableHead: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: COLORS.muted,
  },
  tableCell: {
    fontSize: 10,
    color: COLORS.ink,
  },
  tableCellMuted: {
    fontSize: 10,
    color: COLORS.body,
  },
  numCell: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    textAlign: 'right',
  },
  numCellBold: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    textAlign: 'right',
  },
  monoCell: {
    fontFamily: 'Courier',
    fontSize: 9,
  },

  // ---------------- Run-of-show specific ----------------
  doorsRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.band,
    paddingTop: 5,
    paddingBottom: 5,
    paddingLeft: 4,
    paddingRight: 4,
    borderBottom: `0.5pt solid ${COLORS.rule}`,
  },
  doorsCellTime: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    color: COLORS.ink,
  },
  doorsCellLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    color: COLORS.ink,
  },

  // ---------------- Variance colors ----------------
  good: { color: COLORS.good },
  bad: { color: COLORS.bad },

  // ---------------- Misc ----------------
  smallMuted: { fontSize: 9, color: COLORS.muted },
  totalRow: {
    flexDirection: 'row',
    borderTop: `1pt solid ${COLORS.ink}`,
    paddingTop: 4,
    paddingBottom: 4,
    marginTop: 4,
  },
})
