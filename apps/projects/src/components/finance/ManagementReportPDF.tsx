import React from 'react';
import {
  Document, Page, Text, View, StyleSheet,
} from '@react-pdf/renderer';

const ORANGE = '#E05A1C';
const DARK = '#1A1A1A';
const MID = '#555555';
const LIGHT_BG = '#F5F5F5';
const WHITE = '#FFFFFF';
const RED = '#DC2626';
const AMBER = '#D97706';
const GREEN_C = '#16A34A';

const styles = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 9, color: DARK, padding: 40, backgroundColor: WHITE },
  titlePage: { justifyContent: 'center', alignItems: 'center', backgroundColor: WHITE },
  heading1: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: ORANGE, marginBottom: 6 },
  heading2: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: DARK, marginBottom: 4, marginTop: 12, borderBottomWidth: 1, borderBottomColor: ORANGE, paddingBottom: 3 },
  heading3: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: MID, marginBottom: 3, marginTop: 8 },
  subtitle: { fontSize: 11, color: MID, marginBottom: 3 },
  badge: { fontSize: 8, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginTop: 4 },
  badgeDraft: { backgroundColor: '#E4E4E7', color: '#52525B' },
  badgeReview: { backgroundColor: '#FEF3C7', color: '#92400E' },
  badgeFinal: { backgroundColor: '#DCFCE7', color: '#166534' },
  section: { marginBottom: 16 },
  table: { marginTop: 6 },
  tableHeader: { flexDirection: 'row', backgroundColor: ORANGE, color: WHITE, paddingVertical: 4, paddingHorizontal: 4 },
  tableRow: { flexDirection: 'row', paddingVertical: 3, paddingHorizontal: 4 },
  tableRowAlt: { flexDirection: 'row', paddingVertical: 3, paddingHorizontal: 4, backgroundColor: LIGHT_BG },
  tableCell: { flex: 1, fontSize: 8 },
  tableCellNum: { flex: 1, fontSize: 8, textAlign: 'right' },
  tableCellLabel: { flex: 2, fontSize: 8 },
  tableHeaderCell: { flex: 1, fontSize: 8, fontFamily: 'Helvetica-Bold', color: WHITE },
  tableHeaderCellLabel: { flex: 2, fontSize: 8, fontFamily: 'Helvetica-Bold', color: WHITE },
  commentary: { backgroundColor: '#EFF6FF', padding: 8, borderRadius: 4, marginTop: 6, fontSize: 8, lineHeight: 1.5, color: MID },
  pageNumber: { position: 'absolute', bottom: 20, right: 40, fontSize: 8, color: '#9CA3AF' },
  flagGreen: { backgroundColor: '#DCFCE7', color: '#166534', fontSize: 7, padding: 2, borderRadius: 3 },
  flagAmber: { backgroundColor: '#FEF3C7', color: '#92400E', fontSize: 7, padding: 2, borderRadius: 3 },
  flagRed: { backgroundColor: '#FEE2E2', color: '#991B1B', fontSize: 7, padding: 2, borderRadius: 3 },
  flagNone: { backgroundColor: '#F4F4F5', color: '#71717A', fontSize: 7, padding: 2, borderRadius: 3 },
  row: { flexDirection: 'row', gap: 16 },
  col: { flex: 1 },
  kpiCard: { backgroundColor: LIGHT_BG, padding: 8, borderRadius: 4, marginBottom: 6 },
  kpiValue: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: ORANGE },
  kpiLabel: { fontSize: 7, color: MID },
  divider: { borderBottomWidth: 0.5, borderBottomColor: '#E4E4E7', marginVertical: 8 },
  italic: { fontStyle: 'italic' },
  redText: { color: RED },
  greenText: { color: GREEN_C },
});

function fmt(n: number) {
  if (isNaN(n)) return '—';
  const abs = Math.abs(n);
  const formatted = new Intl.NumberFormat('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(abs);
  return (n < 0 ? '-' : '') + '$' + formatted;
}
function fmtPct(n: number) { return isNaN(n) ? '—' : (n * 100).toFixed(1) + '%'; }
function fmtNum(n: number, dp = 2) { return isNaN(n) ? '—' : n.toFixed(dp); }

function flagStyle(flag: string) {
  if (flag === 'GREEN') return styles.flagGreen;
  if (flag === 'AMBER') return styles.flagAmber;
  if (flag === 'RED') return styles.flagRed;
  return styles.flagNone;
}

function SectionCommentary({ content }: { content?: string | null }) {
  if (!content) return null;
  return <Text style={styles.commentary}>{content}</Text>;
}

function PageNumber() {
  return (
    <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function ManagementReportPDF({ data }: { data: any }) {
  const { report, calculations } = data;
  const { busUnit, pnl, wipSchedule, projectSummary, unsecured } = calculations;

  const reportMonthLabel = new Date(report.reportMonth).toLocaleDateString('en-AU', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const generatedDate = new Date(report.generatedAt).toLocaleDateString('en-AU', { day: '2-digit', month: 'long', year: 'numeric' });

  function getSection(key: string) {
    const s = report.sections?.find((sec: { sectionKey: string }) => sec.sectionKey === key);
    return s?.editedContent || s?.aiDraft || null;
  }

  const statusStyle = report.status === 'FINAL' ? styles.badgeFinal : report.status === 'REVIEW' ? styles.badgeReview : styles.badgeDraft;

  // Group projects by status
  const awarded = projectSummary.filter((p: { status: string }) => p.status === 'AWARDED');
  const backlog = projectSummary.filter((p: { status: string }) => p.status === 'BACKLOG');
  const dlp = projectSummary.filter((p: { status: string }) => p.status === 'DLP');
  const groups = [{ label: 'AWARDED', rows: awarded }, { label: 'BACKLOG', rows: backlog }, { label: 'DLP', rows: dlp }];

  const MONTHS = ['jul', 'aug', 'sep', 'oct', 'nov', 'dec', 'jan', 'feb', 'mar', 'apr', 'may', 'jun'];
  const MONTH_LABELS = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];

  return (
    <Document title={`Agero Management Report — ${reportMonthLabel}`}>
      {/* Page 1 — Title */}
      <Page size="A4" style={[styles.page, styles.titlePage]}>
        <PageNumber />
        <Text style={styles.heading1}>AGERO GROUP PTY LTD</Text>
        <Text style={{ fontSize: 16, fontFamily: 'Helvetica-Bold', color: DARK, marginBottom: 6 }}>Monthly Management Report</Text>
        <Text style={styles.subtitle}>{reportMonthLabel}</Text>
        <Text style={[styles.badge, statusStyle]}>{report.status}</Text>
        <View style={styles.divider} />
        <Text style={{ fontSize: 8, color: MID }}>Prepared by: {report.preparedBy?.firstName} {report.preparedBy?.lastName}</Text>
        <Text style={{ fontSize: 8, color: MID }}>Generated: {generatedDate}</Text>
        {report.finalisedAt && (
          <Text style={{ fontSize: 8, color: MID }}>Finalised: {new Date(report.finalisedAt).toLocaleDateString('en-AU')}</Text>
        )}
      </Page>

      {/* Page 2 — Business Unit Summary */}
      <Page size="A4" style={styles.page} orientation="landscape">
        <PageNumber />
        <Text style={styles.heading2}>Business Unit Summary — {reportMonthLabel}</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCellLabel, { flex: 1.4 }]}>Business Unit</Text>
            <Text style={styles.tableHeaderCell}>YTD Actual $</Text>
            <Text style={styles.tableHeaderCell}>YTD Budget $</Text>
            <Text style={styles.tableHeaderCell}>Variance $</Text>
            <Text style={styles.tableHeaderCell}>Variance %</Text>
            <Text style={styles.tableHeaderCell}>Margin %</Text>
            <Text style={styles.tableHeaderCell}>FY Forecast $</Text>
            <Text style={styles.tableHeaderCell}>FY Budget $</Text>
            <Text style={styles.tableHeaderCell}>FY Var $</Text>
            <Text style={styles.tableHeaderCell}>FY Var %</Text>
          </View>
          {([
            { label: 'Awarded Projects', data: busUnit.awarded },
            { label: 'Backlog Projects', data: busUnit.backlog },
          ] as { label: string; data: { ytdActualMargin: number | null; ytdBudgetMargin: number; ytdVarianceDollars: number | null; ytdVariancePct: number | null; ytdMarginPct: number | null; fyForecastMargin: number; fyBudgetMargin: number | null; fyVarianceDollars: number | null; fyVariancePct: number | null } }[]).map(({ label, data }, i) => (
            <View key={label} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
              <Text style={[styles.tableCellLabel, { flex: 1.4, fontFamily: 'Helvetica-Bold' }]}>{label}</Text>
              <Text style={[styles.tableCellNum, { fontFamily: 'Helvetica-Bold' }]}>{data.ytdActualMargin != null ? fmt(data.ytdActualMargin) : '—'}</Text>
              <Text style={styles.tableCellNum}>{fmt(data.ytdBudgetMargin)}</Text>
              <Text style={[styles.tableCellNum, data.ytdVarianceDollars != null && data.ytdVarianceDollars < 0 ? styles.redText : styles.greenText]}>
                {data.ytdVarianceDollars != null ? fmt(data.ytdVarianceDollars) : '—'}
              </Text>
              <Text style={[styles.tableCellNum, data.ytdVariancePct != null && data.ytdVariancePct < -0.05 ? styles.redText : {}]}>
                {data.ytdVariancePct != null ? fmtPct(data.ytdVariancePct) : '—'}
              </Text>
              <Text style={styles.tableCellNum}>{data.ytdMarginPct != null ? fmtPct(data.ytdMarginPct) : '—'}</Text>
              <Text style={[styles.tableCellNum, { fontFamily: 'Helvetica-Bold' }]}>{fmt(data.fyForecastMargin)}</Text>
              <Text style={styles.tableCellNum}>{data.fyBudgetMargin != null ? fmt(data.fyBudgetMargin) : '—'}</Text>
              <Text style={[styles.tableCellNum, data.fyVarianceDollars != null && data.fyVarianceDollars < 0 ? styles.redText : styles.greenText]}>
                {data.fyVarianceDollars != null ? fmt(data.fyVarianceDollars) : '—'}
              </Text>
              <Text style={[styles.tableCellNum, data.fyVariancePct != null && data.fyVariancePct < -0.05 ? styles.redText : {}]}>
                {data.fyVariancePct != null ? fmtPct(data.fyVariancePct) : '—'}
              </Text>
            </View>
          ))}
        </View>

        <View style={[styles.row, { marginTop: 12 }]}>
          <View style={styles.col}>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiValue}>{busUnit.netProjectCashFlow != null ? fmt(busUnit.netProjectCashFlow) : '—'}</Text>
              <Text style={styles.kpiLabel}>Net Project Cash Flow</Text>
            </View>
          </View>
          <View style={styles.col}>
            <View style={[styles.kpiCard, { backgroundColor: busUnit.netCashVsGrossMargin != null && busUnit.netCashVsGrossMargin < 0 ? '#FEE2E2' : '#DCFCE7' }]}>
              <Text style={[styles.kpiValue, { color: busUnit.netCashVsGrossMargin != null && busUnit.netCashVsGrossMargin < 0 ? RED : GREEN_C }]}>
                {busUnit.netCashVsGrossMargin != null ? fmt(busUnit.netCashVsGrossMargin) : '—'}
              </Text>
              <Text style={styles.kpiLabel}>Net Cash Flow vs Gross Margin</Text>
            </View>
          </View>
          <View style={styles.col} />
        </View>

        <SectionCommentary content={getSection('business_unit_summary')} />
      </Page>

      {/* Page 3 — Consolidated P&L */}
      <Page size="A4" style={styles.page} orientation="landscape">
        <PageNumber />
        <Text style={styles.heading2}>Consolidated P&L — {reportMonthLabel}</Text>
        <View style={styles.table}>
          {/* Group header row */}
          <View style={{ flexDirection: 'row', backgroundColor: '#E4E4E7', paddingVertical: 3, paddingHorizontal: 4 }}>
            <Text style={[styles.tableCellLabel, { flex: 1.6, fontSize: 7 }]} />
            <Text style={{ flex: 3, fontSize: 7, fontFamily: 'Helvetica-Bold', textAlign: 'center', color: DARK }}>Month</Text>
            <Text style={{ flex: 3, fontSize: 7, fontFamily: 'Helvetica-Bold', textAlign: 'center', color: DARK }}>Year to Date</Text>
            <Text style={{ flex: 2, fontSize: 7, fontFamily: 'Helvetica-Bold', textAlign: 'center', color: DARK }}>Full Year 2025–26</Text>
          </View>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCellLabel, { flex: 1.6 }]}>Line Item</Text>
            <Text style={styles.tableHeaderCell}>Actual</Text>
            <Text style={styles.tableHeaderCell}>Budget</Text>
            <Text style={styles.tableHeaderCell}>Variance $</Text>
            <Text style={styles.tableHeaderCell}>Actual</Text>
            <Text style={styles.tableHeaderCell}>Budget</Text>
            <Text style={styles.tableHeaderCell}>Variance $</Text>
            <Text style={styles.tableHeaderCell}>Budget</Text>
            <Text style={styles.tableHeaderCell}>Forecast</Text>
          </View>
          {([
            { label: 'Revenue',             bold: false, isPct: false, isCost: false,
              tmA: pnl.thisMonth.actual.revenue,           tmB: pnl.thisMonth.budget.revenue,           tmV: pnl.thisMonth.variance.revenue,
              ytdA: pnl.ytd.actual.revenue,                ytdB: pnl.ytd.budget.revenue,                ytdV: pnl.ytd.variance.revenue,
              fyB: pnl.fullYear.budget.revenue,            fyF: pnl.fullYear.forecast.revenue },
            { label: 'Cost of Sales',       bold: false, isPct: false, isCost: true,
              tmA: pnl.thisMonth.actual.costOfSales,       tmB: pnl.thisMonth.budget.costOfSales,       tmV: pnl.thisMonth.variance.costOfSales,
              ytdA: pnl.ytd.actual.costOfSales,            ytdB: pnl.ytd.budget.costOfSales,            ytdV: pnl.ytd.variance.costOfSales,
              fyB: pnl.fullYear.budget.costOfSales,        fyF: pnl.fullYear.forecast.costOfSales },
            { label: 'Direct Labour',       bold: false, isPct: false, isCost: true,
              tmA: pnl.thisMonth.actual.directLabour,      tmB: pnl.thisMonth.budget.directLabour,      tmV: pnl.thisMonth.variance.directLabour,
              ytdA: pnl.ytd.actual.directLabour,           ytdB: pnl.ytd.budget.directLabour,           ytdV: pnl.ytd.variance.directLabour,
              fyB: pnl.fullYear.budget.directLabour,       fyF: pnl.fullYear.forecast.directLabour },
            { label: 'Gross Profit',        bold: true,  isPct: false, isCost: false,
              tmA: pnl.thisMonth.actual.grossProfit,       tmB: pnl.thisMonth.budget.grossProfit,       tmV: pnl.thisMonth.variance.grossProfit,
              ytdA: pnl.ytd.actual.grossProfit,            ytdB: pnl.ytd.budget.grossProfit,            ytdV: pnl.ytd.variance.grossProfit,
              fyB: pnl.fullYear.budget.grossProfit,        fyF: pnl.fullYear.forecast.grossProfit },
            { label: 'Gross Margin %',      bold: false, isPct: true,  isCost: false, noVar: true,
              tmA: pnl.thisMonth.actual.grossMarginPct,    tmB: null, tmV: null,
              ytdA: pnl.ytd.actual.grossMarginPct,         ytdB: null, ytdV: null,
              fyB: null,                                   fyF: pnl.fullYear.forecast.grossMarginPct },
            { label: 'Indirect Expenses',   bold: false, isPct: false, isCost: true,
              tmA: pnl.thisMonth.actual.indirectExpenses,  tmB: pnl.thisMonth.budget.indirectExpenses,  tmV: pnl.thisMonth.variance.indirectExpenses,
              ytdA: pnl.ytd.actual.indirectExpenses,       ytdB: pnl.ytd.budget.indirectExpenses,       ytdV: pnl.ytd.variance.indirectExpenses,
              fyB: pnl.fullYear.budget.indirectExpenses,   fyF: pnl.fullYear.forecast.indirectExpenses },
            { label: 'Indirect Labour',     bold: false, isPct: false, isCost: true,
              tmA: pnl.thisMonth.actual.indirectLabour,    tmB: pnl.thisMonth.budget.indirectLabour,    tmV: pnl.thisMonth.variance.indirectLabour,
              ytdA: pnl.ytd.actual.indirectLabour,         ytdB: pnl.ytd.budget.indirectLabour,         ytdV: pnl.ytd.variance.indirectLabour,
              fyB: pnl.fullYear.budget.indirectLabour,     fyF: pnl.fullYear.forecast.indirectLabour },
            { label: 'Marketing Expenses',  bold: false, isPct: false, isCost: true,
              tmA: pnl.thisMonth.actual.marketingExpenses, tmB: pnl.thisMonth.budget.marketingExpenses, tmV: pnl.thisMonth.variance.marketingExpenses,
              ytdA: pnl.ytd.actual.marketingExpenses,      ytdB: pnl.ytd.budget.marketingExpenses,      ytdV: pnl.ytd.variance.marketingExpenses,
              fyB: pnl.fullYear.budget.marketingExpenses,  fyF: pnl.fullYear.forecast.marketingExpenses },
            { label: 'Net Profit Before Tax', bold: true, isPct: false, isCost: false,
              tmA: pnl.thisMonth.actual.netProfitBeforeTax,  tmB: pnl.thisMonth.budget.netProfitBeforeTax,  tmV: pnl.thisMonth.variance.netProfitBeforeTax,
              ytdA: pnl.ytd.actual.netProfitBeforeTax,       ytdB: pnl.ytd.budget.netProfitBeforeTax,       ytdV: pnl.ytd.variance.netProfitBeforeTax,
              fyB: pnl.fullYear.budget.netProfitBeforeTax,   fyF: pnl.fullYear.forecast.netProfitBeforeTax },
            { label: 'Net Profit Rate %',   bold: false, isPct: true,  isCost: false, noVar: true,
              tmA: pnl.thisMonth.actual.netProfitRate,     tmB: null, tmV: null,
              ytdA: pnl.ytd.actual.netProfitRate,          ytdB: null, ytdV: null,
              fyB: null,                                   fyF: pnl.fullYear.forecast.netProfitRate },
          ] as { label: string; bold: boolean; isPct: boolean; isCost: boolean; noVar?: boolean; tmA: number; tmB: number | null; tmV: number | null; ytdA: number; ytdB: number | null; ytdV: number | null; fyB: number | null; fyF: number | null }[]).map((row, i) => {
            const d = (v: number | null) => row.isPct ? (v != null ? fmtPct(v) : '—') : (v != null ? fmt(v) : '—');
            const vStyle = (v: number | null) => {
              if (v == null || v === 0 || row.noVar) return {};
              const fav = row.isCost ? v < 0 : v > 0;
              return fav ? styles.greenText : styles.redText;
            };
            const labelStyle = row.bold ? { fontFamily: 'Helvetica-Bold' } : {};
            return (
              <View key={row.label} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                <Text style={[styles.tableCellLabel, { flex: 1.6 }, labelStyle]}>{row.label}</Text>
                <Text style={[styles.tableCellNum, labelStyle]}>{d(row.tmA)}</Text>
                <Text style={styles.tableCellNum}>{d(row.tmB)}</Text>
                <Text style={[styles.tableCellNum, vStyle(row.tmV)]}>{row.noVar ? '—' : d(row.tmV)}</Text>
                <Text style={[styles.tableCellNum, labelStyle]}>{d(row.ytdA)}</Text>
                <Text style={styles.tableCellNum}>{d(row.ytdB)}</Text>
                <Text style={[styles.tableCellNum, vStyle(row.ytdV)]}>{row.noVar ? '—' : d(row.ytdV)}</Text>
                <Text style={styles.tableCellNum}>{d(row.fyB)}</Text>
                <Text style={[styles.tableCellNum, labelStyle]}>{d(row.fyF)}</Text>
              </View>
            );
          })}
        </View>
        <SectionCommentary content={getSection('consolidated_pl')} />
      </Page>

      {/* Page 4 — Project Financial Summary Table 1 (Revenue) */}
      <Page size="A4" style={styles.page} orientation="landscape">
        <PageNumber />
        <Text style={styles.heading2}>Project Financial Summary — Revenue Side — {reportMonthLabel}</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, { flex: 0.6 }]}>Job No</Text>
            <Text style={[styles.tableHeaderCellLabel, { flex: 2 }]}>Project</Text>
            <Text style={[styles.tableHeaderCell, { flex: 0.7 }]}>Status</Text>
            <Text style={styles.tableHeaderCell}>Forecast CV</Text>
            <Text style={styles.tableHeaderCell}>Forecast Costs</Text>
            <Text style={styles.tableHeaderCell}>Margin $</Text>
            <Text style={styles.tableHeaderCell}>Margin %</Text>
            <Text style={styles.tableHeaderCell}>Target %</Text>
            <Text style={styles.tableHeaderCell}>Claim Total</Text>
            <Text style={styles.tableHeaderCell}>Retention</Text>
            <Text style={[styles.tableHeaderCell, { flex: 0.6 }]}>Flag</Text>
          </View>
          {groups.map((g) => {
            if (g.rows.length === 0) return null;
            const subtotalCV = g.rows.reduce((s: number, p: { forecastContractValue: number }) => s + p.forecastContractValue, 0);
            const subtotalMargin = g.rows.reduce((s: number, p: { forecastMarginDollars: number }) => s + p.forecastMarginDollars, 0);
            const subtotalClaim = g.rows.reduce((s: number, p: { claimTotal: number }) => s + p.claimTotal, 0);
            return (
              <React.Fragment key={g.label}>
                {g.rows.map((p: { jobNumber: string; projectName: string; status: string; forecastContractValue: number; forecastFinalCosts: number; forecastMarginDollars: number; forecastMarginPercent: number; targetExitMarginPercent: number | null; claimTotal: number; claimRetention: number; flag: string }, i: number) => (
                  <View key={p.jobNumber} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                    <Text style={[styles.tableCell, { flex: 0.6 }]}>{p.jobNumber}</Text>
                    <Text style={[styles.tableCell, { flex: 2 }]}>{p.projectName}</Text>
                    <Text style={[styles.tableCell, { flex: 0.7 }]}>{p.status}</Text>
                    <Text style={styles.tableCellNum}>{fmt(p.forecastContractValue)}</Text>
                    <Text style={styles.tableCellNum}>{fmt(p.forecastFinalCosts)}</Text>
                    <Text style={styles.tableCellNum}>{fmt(p.forecastMarginDollars)}</Text>
                    <Text style={styles.tableCellNum}>{fmtPct(p.forecastMarginPercent)}</Text>
                    <Text style={styles.tableCellNum}>{p.targetExitMarginPercent ? fmtPct(p.targetExitMarginPercent) : '—'}</Text>
                    <Text style={styles.tableCellNum}>{fmt(p.claimTotal)}</Text>
                    <Text style={styles.tableCellNum}>{fmt(p.claimRetention)}</Text>
                    <Text style={[styles.tableCell, { flex: 0.6 }]}><Text style={flagStyle(p.flag)}>{p.flag}</Text></Text>
                  </View>
                ))}
                <View style={[styles.tableRow, { backgroundColor: '#FFF7ED' }]}>
                  <Text style={[styles.tableCell, { flex: 0.6 }]} />
                  <Text style={[styles.tableCellLabel, { flex: 2, fontFamily: 'Helvetica-Bold' }]}>{g.label} SUBTOTAL</Text>
                  <Text style={[styles.tableCell, { flex: 0.7 }]} />
                  <Text style={[styles.tableCellNum, { fontFamily: 'Helvetica-Bold' }]}>{fmt(subtotalCV)}</Text>
                  <Text style={styles.tableCellNum} />
                  <Text style={[styles.tableCellNum, { fontFamily: 'Helvetica-Bold' }]}>{fmt(subtotalMargin)}</Text>
                  <Text style={[styles.tableCellNum, { fontFamily: 'Helvetica-Bold' }]}>{subtotalCV > 0 ? fmtPct(subtotalMargin / subtotalCV) : '—'}</Text>
                  <Text style={styles.tableCellNum} />
                  <Text style={[styles.tableCellNum, { fontFamily: 'Helvetica-Bold' }]}>{fmt(subtotalClaim)}</Text>
                  <Text style={styles.tableCellNum} />
                  <Text style={[styles.tableCell, { flex: 0.6 }]} />
                </View>
              </React.Fragment>
            );
          })}
        </View>
        <SectionCommentary content={getSection('project_financial')} />
      </Page>

      {/* Page 5 — Project Financial Summary Table 2 (Costs) */}
      <Page size="A4" style={styles.page} orientation="landscape">
        <PageNumber />
        <Text style={styles.heading2}>Project Financial Summary — Cost Side — {reportMonthLabel}</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, { flex: 0.6 }]}>Job No</Text>
            <Text style={[styles.tableHeaderCellLabel, { flex: 2 }]}>Project</Text>
            <Text style={styles.tableHeaderCell}>Sub Claims</Text>
            <Text style={styles.tableHeaderCell}>Creditors</Text>
            <Text style={styles.tableHeaderCell}>Labour</Text>
            <Text style={styles.tableHeaderCell}>Labour Bench (4.5%)</Text>
            <Text style={styles.tableHeaderCell}>Labour Var</Text>
            <Text style={styles.tableHeaderCell}>Sub Bench (70.5%)</Text>
            <Text style={styles.tableHeaderCell}>Sub Var</Text>
            <Text style={styles.tableHeaderCell}>Total Cost</Text>
          </View>
          {projectSummary.map((p: { jobNumber: string; projectName: string; subClaims: number; creditors: number; labour: number; labourBenchmark: number; labourVariance: number; subBenchmark: number; subVariance: number; totalCost: number }, i: number) => (
            <View key={p.jobNumber} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
              <Text style={[styles.tableCell, { flex: 0.6 }]}>{p.jobNumber}</Text>
              <Text style={[styles.tableCell, { flex: 2 }]}>{p.projectName}</Text>
              <Text style={styles.tableCellNum}>{fmt(p.subClaims)}</Text>
              <Text style={styles.tableCellNum}>{fmt(p.creditors)}</Text>
              <Text style={styles.tableCellNum}>{fmt(p.labour)}</Text>
              <Text style={styles.tableCellNum}>{fmt(p.labourBenchmark)}</Text>
              <Text style={[styles.tableCellNum, p.labourVariance > 0 ? styles.redText : styles.greenText]}>{fmt(p.labourVariance)}</Text>
              <Text style={styles.tableCellNum}>{fmt(p.subBenchmark)}</Text>
              <Text style={[styles.tableCellNum, p.subVariance > 0 ? styles.redText : styles.greenText]}>{fmt(p.subVariance)}</Text>
              <Text style={[styles.tableCellNum, { fontFamily: 'Helvetica-Bold' }]}>{fmt(p.totalCost)}</Text>
            </View>
          ))}
        </View>
      </Page>

      {/* Page 6 — WIP Schedule */}
      <Page size="A4" style={styles.page} orientation="landscape">
        <PageNumber />
        <Text style={styles.heading2}>WIP Schedule — {reportMonthLabel}</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCellLabel, { flex: 2 }]}>Project</Text>
            <Text style={styles.tableHeaderCell}>Contract Value</Text>
            <Text style={styles.tableHeaderCell}>Est. Total Cost</Text>
            <Text style={styles.tableHeaderCell}>Costs to Date</Text>
            <Text style={styles.tableHeaderCell}>% Complete</Text>
            <Text style={styles.tableHeaderCell}>Earned Revenue</Text>
            <Text style={styles.tableHeaderCell}>Billed to Date</Text>
            <Text style={styles.tableHeaderCell}>Over/Underbilled</Text>
            <Text style={styles.tableHeaderCell}>Est. GP</Text>
            <Text style={styles.tableHeaderCell}>Est. GP %</Text>
            <Text style={[styles.tableHeaderCell, { flex: 0.7 }]}>Flag</Text>
          </View>
          {wipSchedule.map((w: { projectName: string; contractValue: number; estimatedTotalCost: number; costsToDate: number; pctComplete: number; earnedRevenue: number; billedToDate: number; overbilledUnderbilled: number; estimatedGrossProfit: number; estimatedGpPct: number; flag: string; costToCompleteEstimated: boolean }, i: number) => (
            <View key={w.projectName} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
              <Text style={[styles.tableCell, { flex: 2 }]}>{w.projectName}</Text>
              <Text style={styles.tableCellNum}>{fmt(w.contractValue)}</Text>
              <Text style={styles.tableCellNum}>{fmt(w.estimatedTotalCost)}</Text>
              <Text style={styles.tableCellNum}>{fmt(w.costsToDate)}</Text>
              <Text style={styles.tableCellNum}>{fmtPct(w.pctComplete)}</Text>
              <Text style={styles.tableCellNum}>{fmt(w.earnedRevenue)}</Text>
              <Text style={styles.tableCellNum}>{fmt(w.billedToDate)}</Text>
              <Text style={[styles.tableCellNum, w.overbilledUnderbilled < 0 ? styles.redText : styles.greenText]}>{fmt(w.overbilledUnderbilled)}</Text>
              <Text style={styles.tableCellNum}>{fmt(w.estimatedGrossProfit)}</Text>
              <Text style={styles.tableCellNum}>{fmtPct(w.estimatedGpPct)}</Text>
              <Text style={[styles.tableCell, { flex: 0.7 }]}>
                <Text style={w.costToCompleteEstimated ? styles.flagNone : flagStyle(w.flag)}>
                  {w.costToCompleteEstimated ? 'EST' : w.flag}
                </Text>
              </Text>
            </View>
          ))}
        </View>
        <SectionCommentary content={getSection('wip_schedule')} />
      </Page>

      {/* Page 7 — Unsecured Forecast */}
      <Page size="A4" style={styles.page} orientation="landscape">
        <PageNumber />
        <Text style={styles.heading2}>Unsecured Forecast — FY{unsecured.financialYear}/{unsecured.financialYear + 1}</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCellLabel, { flex: 1.5 }]}>Row</Text>
            {MONTH_LABELS.map((m) => <Text key={m} style={[styles.tableHeaderCell, { flex: 0.7 }]}>{m}</Text>)}
            <Text style={[styles.tableHeaderCell, { flex: 0.8 }]}>Next Yr</Text>
          </View>
          {[
            { label: '100% Revenue', data: unsecured.fullRevenue, nextYear: unsecured.nextYearFull },
            { label: 'Weighted Revenue', data: unsecured.weightedRevenue, nextYear: unsecured.nextYearWeighted },
            { label: 'Weighted Margin', data: unsecured.weightedMargin, nextYear: unsecured.nextYearMargin },
          ].map((row, i) => (
            <View key={row.label} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
              <Text style={[styles.tableCellLabel, { flex: 1.5 }]}>{row.label}</Text>
              {MONTHS.map((m) => (
                <Text key={m} style={[styles.tableCellNum, { flex: 0.7 }]}>{fmt(row.data[m] ?? 0)}</Text>
              ))}
              <Text style={[styles.tableCellNum, { flex: 0.8 }]}>{fmt(row.nextYear)}</Text>
            </View>
          ))}
        </View>
      </Page>

      {/* Page 8 — Month Ahead Commentary */}
      <Page size="A4" style={styles.page}>
        <PageNumber />
        <Text style={styles.heading2}>Month Ahead Commentary</Text>
        <SectionCommentary content={getSection('month_ahead')} />
      </Page>
    </Document>
  );
}
