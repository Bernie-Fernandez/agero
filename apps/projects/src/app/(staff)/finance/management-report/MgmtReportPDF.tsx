import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from '@react-pdf/renderer';
import type { MgmtReportPageData, MgmtSnapshotRecord } from '@/lib/management-report/actions';
import { MONTH_LABELS } from '@/lib/revenue-budget/constants';

// ─── Brand colours ────────────────────────────────────────────────────────────

const ORANGE = '#F5821F';
const DARK = '#2D2D2D';
const GREY = '#6b7280';
const LIGHT = '#f4f4f5';
const WHITE = '#ffffff';

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 9, color: DARK, padding: 36, backgroundColor: WHITE },
  coverPage: { fontFamily: 'Helvetica', fontSize: 10, color: DARK, padding: 36, backgroundColor: WHITE, justifyContent: 'center', alignItems: 'center', display: 'flex' },
  coverTitle: { fontSize: 24, fontFamily: 'Helvetica-Bold', color: ORANGE, marginBottom: 8 },
  coverSub: { fontSize: 14, color: DARK, marginBottom: 4 },
  coverMeta: { fontSize: 9, color: GREY, marginTop: 12 },
  sectionTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: ORANGE, marginBottom: 6, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: ORANGE },
  section: { marginBottom: 16 },
  tableHeader: { flexDirection: 'row', backgroundColor: DARK, color: WHITE, paddingVertical: 3, paddingHorizontal: 4 },
  tableRow: { flexDirection: 'row', paddingVertical: 2, paddingHorizontal: 4, borderBottomWidth: 0.5, borderBottomColor: '#e4e4e7' },
  tableRowAlt: { flexDirection: 'row', paddingVertical: 2, paddingHorizontal: 4, backgroundColor: LIGHT, borderBottomWidth: 0.5, borderBottomColor: '#e4e4e7' },
  cell: { fontSize: 8, color: DARK },
  cellRight: { fontSize: 8, color: DARK, textAlign: 'right' },
  cellBold: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: DARK },
  cellBoldRight: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: DARK, textAlign: 'right' },
  headerCell: { fontSize: 8, color: WHITE, fontFamily: 'Helvetica-Bold' },
  headerCellRight: { fontSize: 8, color: WHITE, fontFamily: 'Helvetica-Bold', textAlign: 'right' },
  note: { fontSize: 8, color: GREY, fontStyle: 'italic', marginTop: 4 },
  badge: { fontSize: 7, padding: '2 4', borderRadius: 3, backgroundColor: ORANGE, color: WHITE },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const AUD = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 });
const fmt = (v: number) => AUD.format(v);
const pct = (v: number) => (v * 100).toFixed(1) + '%';

// ─── PDF Document ─────────────────────────────────────────────────────────────

export function MgmtReportPDF({
  data,
  snapshot,
  monthLabel,
}: {
  data: MgmtReportPageData;
  snapshot: MgmtSnapshotRecord;
  monthLabel: string;
}) {
  const fy27Keys = data.fy27MonthKeys.filter((k) => k in MONTH_LABELS);
  const genDate = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <Document title={`Agero Management Report — ${monthLabel}`} author="Agero Group">
      {/* Cover page */}
      <Page size="A4" style={s.coverPage}>
        <View style={{ alignItems: 'center' }}>
          <Text style={s.coverTitle}>AGERO GROUP</Text>
          <Text style={s.coverSub}>Management Report</Text>
          <Text style={{ fontSize: 18, color: DARK, marginBottom: 16 }}>{monthLabel}</Text>
          <View style={{ width: 60, height: 3, backgroundColor: ORANGE, marginBottom: 16 }} />
          <Text style={{ fontSize: 9, color: GREY }}>Status: {snapshot.status}</Text>
          {snapshot.status === 'LOCKED' && snapshot.lockedAt && (
            <Text style={{ fontSize: 9, color: GREY }}>Locked: {snapshot.lockedAt}</Text>
          )}
          <Text style={{ fontSize: 9, color: GREY, marginTop: 8 }}>Generated: {genDate}</Text>
          <Text style={[s.note, { marginTop: 24, textAlign: 'center' }]}>
            CONFIDENTIAL — For internal use only
          </Text>
        </View>
      </Page>

      {/* Revenue */}
      <Page size="A4" style={s.page}>
        <View style={s.section}>
          <Text style={s.sectionTitle}>1. Revenue Overview</Text>
          {/* Table */}
          <View style={s.tableHeader}>
            <Text style={[s.headerCell, { width: 60 }]}>Row</Text>
            {fy27Keys.map((k) => (
              <Text key={k} style={[s.headerCellRight, { flex: 1 }]}>
                {MONTH_LABELS[k as keyof typeof MONTH_LABELS]}
              </Text>
            ))}
            <Text style={[s.headerCellRight, { width: 60 }]}>Total</Text>
          </View>
          {[
            { label: 'Budget', values: data.revenue.budget },
            { label: 'Secured', values: data.revenue.secured },
            { label: 'Unsecured', values: data.revenue.unsecured },
            { label: 'Actual', values: data.revenue.actual },
          ].map((row, ri) => {
            const total = fy27Keys.reduce((s, k) => s + (row.values[k] ?? 0), 0);
            return (
              <View key={row.label} style={ri % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                <Text style={[s.cellBold, { width: 60 }]}>{row.label}</Text>
                {fy27Keys.map((k) => {
                  const v = row.values[k] ?? 0;
                  return <Text key={k} style={[s.cellRight, { flex: 1 }]}>{v ? fmt(v) : '—'}</Text>;
                })}
                <Text style={[s.cellBoldRight, { width: 60 }]}>{fmt(total)}</Text>
              </View>
            );
          })}
        </View>
      </Page>

      {/* P&L */}
      <Page size="A4" style={s.page}>
        <View style={s.section}>
          <Text style={s.sectionTitle}>2. P&L — Actual vs Budget ({monthLabel})</Text>
          <View style={s.tableHeader}>
            <Text style={[s.headerCell, { flex: 2 }]}>Line Item</Text>
            <Text style={[s.headerCellRight, { flex: 1 }]}>Budget</Text>
            <Text style={[s.headerCellRight, { flex: 1 }]}>Actual</Text>
            <Text style={[s.headerCellRight, { flex: 1 }]}>Variance</Text>
          </View>
          {[
            { label: 'Revenue', b: data.pnl.budgetRevenue, a: data.pnl.actualRevenue },
            { label: 'Direct Costs', b: data.pnl.budgetDirectCosts, a: data.pnl.actualDirectCosts },
            { label: 'Gross Margin', b: data.pnl.budgetGrossMargin, a: data.pnl.actualGrossProfit, bold: true },
            { label: 'Gross Margin %', bP: data.pnl.budgetGrossMarginPct, aP: data.pnl.actualGrossMarginPct, isPct: true },
            { label: 'Overheads', b: data.pnl.budgetOverheads, a: data.pnl.actualOverheads },
            { label: 'Net Profit', b: data.pnl.budgetNetProfit, a: data.pnl.actualNetProfit, bold: true },
            { label: 'Net Profit %', bP: data.pnl.budgetNetProfitPct, aP: data.pnl.actualNetProfitPct, isPct: true },
          ].map((r, i) => (
            <View key={r.label} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
              <Text style={[r.bold ? s.cellBold : s.cell, { flex: 2 }]}>{r.label}</Text>
              {r.isPct ? (
                <>
                  <Text style={[s.cellRight, { flex: 1 }]}>{pct(r.bP ?? 0)}</Text>
                  <Text style={[s.cellRight, { flex: 1 }]}>{pct(r.aP ?? 0)}</Text>
                  <Text style={[s.cellRight, { flex: 1 }]}>{(((r.aP ?? 0) - (r.bP ?? 0)) * 100).toFixed(1)}pp</Text>
                </>
              ) : (
                <>
                  <Text style={[s.cellRight, { flex: 1 }]}>{fmt(r.b ?? 0)}</Text>
                  <Text style={[r.bold ? s.cellBoldRight : s.cellRight, { flex: 1 }]}>{fmt(r.a ?? 0)}</Text>
                  <Text style={[s.cellRight, { flex: 1 }]}>{(r.a ?? 0) - (r.b ?? 0) >= 0 ? '+' : ''}{fmt((r.a ?? 0) - (r.b ?? 0))}</Text>
                </>
              )}
            </View>
          ))}
        </View>

        {/* CVR Summary */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>3. Project CVR Summary</Text>
          <View style={s.tableHeader}>
            <Text style={[s.headerCell, { width: 40 }]}>Job</Text>
            <Text style={[s.headerCell, { flex: 3 }]}>Project</Text>
            <Text style={[s.headerCellRight, { flex: 1 }]}>Contract</Text>
            <Text style={[s.headerCellRight, { flex: 1 }]}>Margin %</Text>
            <Text style={[s.headerCellRight, { flex: 1 }]}>WIP</Text>
            <Text style={[s.headerCellRight, { width: 30 }]}>Status</Text>
          </View>
          {data.cvrRows.map((r, i) => (
            <View key={r.projectId} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
              <Text style={[s.cell, { width: 40 }]}>{r.jobNo}</Text>
              <Text style={[s.cell, { flex: 3 }]}>{r.projectName.length > 40 ? r.projectName.slice(0, 40) + '…' : r.projectName}</Text>
              <Text style={[s.cellRight, { flex: 1 }]}>{r.health !== 'GREY' ? fmt(r.forecastContract) : '—'}</Text>
              <Text style={[s.cellRight, { flex: 1 }]}>{r.health !== 'GREY' ? pct(r.forecastMarginPct) : '—'}</Text>
              <Text style={[s.cellRight, { flex: 1 }]}>{r.wip ? fmt(r.wip) : '—'}</Text>
              <Text style={[s.cellRight, { width: 30 }]}>{r.health === 'GREEN' ? 'OK' : r.health === 'AMBER' ? 'WARN' : r.health === 'RED' ? 'RISK' : '—'}</Text>
            </View>
          ))}
        </View>
      </Page>

      {/* Cash + WIP + Forecast */}
      <Page size="A4" style={s.page}>
        {/* Cash Position */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>4. Cash Position</Text>
          {data.cashPosition.current ? (
            <>
              <View style={s.tableHeader}>
                <Text style={[s.headerCell, { flex: 2 }]}>Item</Text>
                <Text style={[s.headerCellRight, { flex: 1 }]}>This Month</Text>
                <Text style={[s.headerCellRight, { flex: 1 }]}>Prior Month</Text>
                <Text style={[s.headerCellRight, { flex: 1 }]}>Movement</Text>
              </View>
              {[
                { label: 'Cash and Bank', c: data.cashPosition.current.cash, p: data.cashPosition.prior?.cash ?? 0 },
                { label: 'Accounts Receivable', c: data.cashPosition.current.ar, p: data.cashPosition.prior?.ar ?? 0 },
                { label: 'Accounts Payable', c: data.cashPosition.current.ap, p: data.cashPosition.prior?.ap ?? 0 },
                { label: 'Retentions Held', c: data.cashPosition.current.retentions, p: data.cashPosition.prior?.retentions ?? 0 },
              ].map((r, i) => (
                <View key={r.label} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                  <Text style={[s.cell, { flex: 2 }]}>{r.label}</Text>
                  <Text style={[s.cellRight, { flex: 1 }]}>{fmt(r.c)}</Text>
                  <Text style={[s.cellRight, { flex: 1 }]}>{data.cashPosition.prior ? fmt(r.p) : '—'}</Text>
                  <Text style={[s.cellRight, { flex: 1 }]}>{data.cashPosition.prior ? (r.c - r.p >= 0 ? '+' : '') + fmt(r.c - r.p) : '—'}</Text>
                </View>
              ))}
            </>
          ) : (
            <Text style={s.note}>No Balance Sheet data available.</Text>
          )}
        </View>

        {/* WIP Summary */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>5. WIP Summary</Text>
          {data.wipSummary ? (
            <>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                {[
                  { l: 'Prior WIP', v: fmt(data.wipSummary.priorMonthWip) },
                  { l: 'Current WIP', v: fmt(data.wipSummary.currentMonthWip) },
                  { l: 'Movement', v: (data.wipSummary.movement >= 0 ? '+' : '') + fmt(data.wipSummary.movement) },
                  { l: 'Journal', v: data.wipSummary.journalPosted ? 'Posted' : 'Pending' },
                ].map((c) => (
                  <View key={c.l} style={{ flex: 1, backgroundColor: LIGHT, padding: 6, borderRadius: 4 }}>
                    <Text style={{ fontSize: 7, color: GREY }}>{c.l}</Text>
                    <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold' }}>{c.v}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : (
            <Text style={s.note}>No locked WIP data available.</Text>
          )}
        </View>

        {/* Notes */}
        {snapshot.notes && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>6. Notes &amp; Commentary</Text>
            <Text style={{ fontSize: 9, color: DARK, lineHeight: 1.5 }}>{snapshot.notes}</Text>
          </View>
        )}
      </Page>
    </Document>
  );
}
