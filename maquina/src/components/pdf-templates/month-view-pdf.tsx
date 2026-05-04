/* eslint-disable jsx-a11y/alt-text -- react-pdf <Image> is not an HTML <img>; the rule does not apply. */
/**
 * MonthViewPDF — Phase 12 export of the /views/month list.
 *
 * Mirrors the on-screen month view. Header band + month/year header,
 * then one table grouped by weekend (matching how the page sorts).
 * Confirmed-only flag mirrors the page's filter state.
 */

import { Document, Page, View, Text, Image } from '@react-pdf/renderer'
import { styles } from './styles'
import {
  LOGO_LOSGOTHS_TRIANGLE,
  LOGO_LOSGOTHS_WORDMARK,
} from './branding'

const TRIANGLE_HEIGHT = 32
const TRIANGLE_WIDTH = TRIANGLE_HEIGHT * (2820 / 2661)
const WORDMARK_HEIGHT = 22
const WORDMARK_WIDTH = WORDMARK_HEIGHT * (2732 / 690)

export type MonthViewPDFEvent = {
  date: string // 'YYYY-MM-DD'
  day_of_week: string
  weekend_number: number
  title: string
  type: string
  status: string
  city: string
  state: string
  venueName: string | undefined
}

export type MonthViewPDFProps = {
  monthName: string
  year: number
  confirmedOnly: boolean
  events: MonthViewPDFEvent[]
  generatedAt: string
}

function formatDateShort(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

export function MonthViewPDF({
  monthName,
  year,
  confirmedOnly,
  events,
  generatedAt,
}: MonthViewPDFProps) {
  return (
    <Document
      title={`Month — ${monthName} ${year}`}
      author="LosGothsCo"
      creator="Maquina"
    >
      <Page size="LETTER" style={styles.page}>
        {/* Brand band — triangle + wordmark on left, page caption on right. */}
        <View style={styles.brandRow}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <Image
              src={LOGO_LOSGOTHS_TRIANGLE}
              style={{ height: TRIANGLE_HEIGHT, width: TRIANGLE_WIDTH }}
            />
            <Image
              src={LOGO_LOSGOTHS_WORDMARK}
              style={{ height: WORDMARK_HEIGHT, width: WORDMARK_WIDTH }}
            />
          </View>
          <Text style={styles.brandRight}>Month view</Text>
        </View>

        <Text style={styles.title}>
          {monthName} {year}
        </Text>
        <Text style={styles.subtitle}>
          {events.length} {events.length === 1 ? 'event' : 'events'}
          {confirmedOnly ? ' (confirmed only)' : ''}
        </Text>
        <View style={{ marginBottom: 12 }} />

        {/* Header */}
        <View style={styles.tableHeadRow}>
          <Text style={[styles.tableHead, { width: 60 }]}>Date</Text>
          <Text style={[styles.tableHead, { width: 50 }]}>Day</Text>
          <Text style={[styles.tableHead, { flex: 2 }]}>Title</Text>
          <Text style={[styles.tableHead, { flex: 2 }]}>Venue</Text>
          <Text style={[styles.tableHead, { flex: 1 }]}>Location</Text>
          <Text style={[styles.tableHead, { width: 64 }]}>Status</Text>
        </View>

        {events.length === 0 ? (
          <View style={styles.tableRow}>
            <Text style={[styles.smallMuted, { flex: 1 }]}>
              No events match this filter.
            </Text>
          </View>
        ) : (
          events.map((e, idx) => (
            <View
              key={`evt-${idx}-${e.date}-${e.title}`}
              style={styles.tableRow}
              wrap={false}
            >
              <Text style={[styles.monoCell, { width: 60 }]}>
                {formatDateShort(e.date)}
              </Text>
              <Text style={[styles.tableCellMuted, { width: 50 }]}>
                {e.day_of_week}
              </Text>
              <Text style={[styles.tableCell, { flex: 2 }]}>
                {e.title || '—'}
              </Text>
              <Text style={[styles.tableCellMuted, { flex: 2 }]}>
                {e.venueName ?? '—'}
              </Text>
              <Text style={[styles.tableCellMuted, { flex: 1 }]}>
                {e.city}
                {e.state ? `, ${e.state}` : ''}
              </Text>
              <Text
                style={
                  e.status === 'confirmed'
                    ? [styles.tableCellMuted, { width: 64 }, styles.good]
                    : [styles.tableCellMuted, { width: 64 }]
                }
              >
                {e.status}
              </Text>
            </View>
          ))
        )}

        {/* Footer */}
        <View style={styles.pageFooter} fixed>
          <Text>
            Generated{' '}
            {new Date(generatedAt).toLocaleString('en-US', {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `${pageNumber} / ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  )
}
