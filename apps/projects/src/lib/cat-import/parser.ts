import * as XLSX from 'xlsx';

export type CatRow = {
  status: string;
  jobNo: string;
  projectName: string;
  practicalCompletion: string | null;
  forecastContract: number;
  forecastFinalCosts: number;
  forecastMargin: number;
  roAdjust: number;
  marginInclRo: number;
  forecastMarginPct: number;
  claimTotal: number;
  claimRetention: number;
  subClaims: number;
  subRetention: number;
  creditors: number;
  labour: number;
  plant: number;
  stock: number;
  totalCost: number;
  billingLessCost: number;
  marginToEarn: number;
  marginRealised: number;
  wip: number;
  overClaim: number;
  nettRetention: number;
  nettCashFlow: number;
};

export type CatImportPreview = {
  rows: CatRow[];
  skippedRows: number;
  unmatchedHeaders: string[];
  parseErrors: string[];
};

// ── Currency / percentage parsers ────────────────────────────────────────────

export function parseCurrency(raw: unknown): number {
  if (raw === null || raw === undefined) return 0;
  const s = String(raw).trim();
  if (!s || s === '-' || s === '—' || s === 'N/A') return 0;
  // Strip currency symbol and spaces
  const stripped = s.replace(/[$\s]/g, '');
  // Parentheses = negative
  const negative = stripped.startsWith('(') && stripped.endsWith(')');
  const digits = stripped.replace(/[()]/g, '').replace(/,/g, '');
  const num = parseFloat(digits);
  if (isNaN(num)) return 0;
  return negative ? -num : num;
}

export function parsePercent(raw: unknown): number {
  if (raw === null || raw === undefined) return 0;
  const s = String(raw).trim();
  if (!s || s === '-' || s === '—') return 0;
  const digits = s.replace(/[%\s]/g, '');
  const num = parseFloat(digits);
  if (isNaN(num)) return 0;
  // If already a fraction (< 1 and wasn't formatted as percentage string) keep it
  if (!s.includes('%') && Math.abs(num) < 1) return num;
  return num / 100;
}

export function parseDate(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (!s || s === '-' || s === '—') return null;
  // Try d/m/yy or d/m/yyyy
  const parts = s.split('/');
  if (parts.length === 3) {
    const d = parts[0].padStart(2, '0');
    const m = parts[1].padStart(2, '0');
    let y = parts[2];
    if (y.length === 2) y = '20' + y;
    return `${y}-${m}-${d}`;
  }
  // Try ISO
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return null;
}

// ── Header normalisation ─────────────────────────────────────────────────────

const HEADER_MAP: Record<string, keyof CatRow> = {
  'status': 'status',
  'jobno': 'jobNo',
  'job no': 'jobNo',
  'job number': 'jobNo',
  'projectname': 'projectName',
  'project name': 'projectName',
  'practcomp': 'practicalCompletion',
  'pract comp': 'practicalCompletion',
  'practical completion': 'practicalCompletion',
  'forecastcontract': 'forecastContract',
  'forecast contract': 'forecastContract',
  'forecastfinalcosts': 'forecastFinalCosts',
  'forecast final costs': 'forecastFinalCosts',
  'forecast final cost': 'forecastFinalCosts',
  'forecastmargin': 'forecastMargin',
  'forecast margin': 'forecastMargin',
  'roadjust': 'roAdjust',
  'ro adjust': 'roAdjust',
  'r&o adjust': 'roAdjust',
  'r&o adjustment': 'roAdjust',
  'margininclro': 'marginInclRo',
  'margin incl ro': 'marginInclRo',
  'margin includ r&o': 'marginInclRo',
  'margin including r&o': 'marginInclRo',
  'forecastmarginpct': 'forecastMarginPct',
  'forecast margin %': 'forecastMarginPct',
  'forecast margin%': 'forecastMarginPct',
  'forecastmargin%': 'forecastMarginPct',
  'claimtotal': 'claimTotal',
  'claim total': 'claimTotal',
  'claimretention': 'claimRetention',
  'claim retention': 'claimRetention',
  'subclaims': 'subClaims',
  'sub claims': 'subClaims',
  'subretention': 'subRetention',
  'sub retention': 'subRetention',
  'creditors': 'creditors',
  'labour': 'labour',
  'plant': 'plant',
  'stock': 'stock',
  'totalcost': 'totalCost',
  'total cost': 'totalCost',
  'billinglesscost': 'billingLessCost',
  'billing less cost': 'billingLessCost',
  'margintolearn': 'marginToEarn',
  'margin to earn': 'marginToEarn',
  'marginrealised': 'marginRealised',
  'margin realised': 'marginRealised',
  'wip': 'wip',
  'overclaim': 'overClaim',
  'over claim': 'overClaim',
  'nettretention': 'nettRetention',
  'nett retention': 'nettRetention',
  'nettcashflow': 'nettCashFlow',
  'nett cash flow': 'nettCashFlow',
};

function normaliseHeader(h: string): string {
  return h
    .toLowerCase()
    .replace(/\n/g, ' ')
    .replace(/\r/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const SUBTOTAL_PATTERNS = [
  /total:/i,
  /subtotal/i,
  /grand total/i,
  /^\s*(industrial|office|awarded|backlog|awarded total|backlog total|lfr|commercial|industrial \/ lfr)\s*(total)?:?\s*$/i,
];

function isSubtotalRow(cells: string[]): boolean {
  const first = (cells[0] ?? '').trim();
  const second = (cells[1] ?? '').trim();
  return SUBTOTAL_PATTERNS.some((p) => p.test(first) || p.test(second));
}

// ── Main parser ───────────────────────────────────────────────────────────────

export function parseCatExport(buffer: Buffer, filename: string): CatImportPreview {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  const workbook = XLSX.read(buffer, {
    type: 'buffer',
    cellDates: false,
    raw: false,
  });

  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const raw: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  if (raw.length < 2) {
    return { rows: [], skippedRows: 0, unmatchedHeaders: [], parseErrors: ['File appears to be empty.'] };
  }

  // Find the header row — first row with ≥3 CAT column matches
  let headerRowIdx = -1;
  let colMap: Map<keyof CatRow, number> | null = null;

  for (let i = 0; i < Math.min(10, raw.length); i++) {
    const candidate = raw[i] as string[];
    const map = new Map<keyof CatRow, number>();
    const unmatched: string[] = [];
    for (let c = 0; c < candidate.length; c++) {
      const norm = normaliseHeader(String(candidate[c] ?? ''));
      if (!norm) continue;
      const field = HEADER_MAP[norm];
      if (field) {
        if (!map.has(field)) map.set(field, c);
      } else if (norm.length > 2) {
        unmatched.push(norm);
      }
    }
    if (map.size >= 3) {
      headerRowIdx = i;
      colMap = map;
      break;
    }
  }

  if (headerRowIdx === -1 || !colMap) {
    return {
      rows: [],
      skippedRows: 0,
      unmatchedHeaders: [],
      parseErrors: [
        'This file does not appear to be a CAT Project Financial Summary report. ' +
          'Headers expected: Status, Job No, Project Name, Forecast Contract, ...',
      ],
    };
  }

  const headerRow = raw[headerRowIdx] as string[];
  const allNorms = headerRow.map((h) => normaliseHeader(String(h)));
  const unmatchedHeaders = allNorms.filter((n) => n && n.length > 2 && !HEADER_MAP[n]);

  // Resolve column indices
  const col = (field: keyof CatRow): number => colMap!.get(field) ?? -1;

  function getCell(row: unknown[], field: keyof CatRow): string {
    const idx = col(field);
    if (idx === -1) return '';
    return String((row as unknown[])[idx] ?? '').trim();
  }

  const rows: CatRow[] = [];
  let skippedRows = 0;
  let currentStatus = '';

  for (let i = headerRowIdx + 1; i < raw.length; i++) {
    const row = raw[i] as string[];
    const allEmpty = row.every((c) => String(c ?? '').trim() === '');
    if (allEmpty) continue;

    if (isSubtotalRow(row)) {
      skippedRows++;
      // Capture section status if no per-row status col
      if (col('status') === -1) {
        const sectionLabel = String(row[0] ?? '').trim();
        if (/awarded/i.test(sectionLabel)) currentStatus = 'Awarded';
        else if (/backlog/i.test(sectionLabel)) currentStatus = 'Backlog';
      }
      continue;
    }

    const jobNo = getCell(row, 'jobNo');
    if (!jobNo) { skippedRows++; continue; }

    const rawStatus = getCell(row, 'status') || currentStatus;
    // Normalise status: anything with "awarded" → "Awarded", else "Backlog"
    let status = 'Backlog';
    if (/awarded/i.test(rawStatus) || /industrial/i.test(rawStatus) || /office/i.test(rawStatus) || /commercial/i.test(rawStatus) || /lfr/i.test(rawStatus)) {
      status = 'Awarded';
    } else if (/backlog/i.test(rawStatus)) {
      status = 'Backlog';
    } else if (rawStatus) {
      status = rawStatus;
    }

    const forecastMarginPctRaw = getCell(row, 'forecastMarginPct');
    const isPctString = forecastMarginPctRaw.includes('%');

    rows.push({
      status,
      jobNo,
      projectName: getCell(row, 'projectName'),
      practicalCompletion: parseDate(getCell(row, 'practicalCompletion')),
      forecastContract: parseCurrency(getCell(row, 'forecastContract')),
      forecastFinalCosts: parseCurrency(getCell(row, 'forecastFinalCosts')),
      forecastMargin: parseCurrency(getCell(row, 'forecastMargin')),
      roAdjust: parseCurrency(getCell(row, 'roAdjust')),
      marginInclRo: parseCurrency(getCell(row, 'marginInclRo')),
      forecastMarginPct: isPctString
        ? parsePercent(forecastMarginPctRaw)
        : parseCurrency(forecastMarginPctRaw) / 100,
      claimTotal: parseCurrency(getCell(row, 'claimTotal')),
      claimRetention: parseCurrency(getCell(row, 'claimRetention')),
      subClaims: parseCurrency(getCell(row, 'subClaims')),
      subRetention: parseCurrency(getCell(row, 'subRetention')),
      creditors: parseCurrency(getCell(row, 'creditors')),
      labour: parseCurrency(getCell(row, 'labour')),
      plant: parseCurrency(getCell(row, 'plant')),
      stock: parseCurrency(getCell(row, 'stock')),
      totalCost: parseCurrency(getCell(row, 'totalCost')),
      billingLessCost: parseCurrency(getCell(row, 'billingLessCost')),
      marginToEarn: parseCurrency(getCell(row, 'marginToEarn')),
      marginRealised: parseCurrency(getCell(row, 'marginRealised')),
      wip: parseCurrency(getCell(row, 'wip')),
      overClaim: parseCurrency(getCell(row, 'overClaim')),
      nettRetention: parseCurrency(getCell(row, 'nettRetention')),
      nettCashFlow: parseCurrency(getCell(row, 'nettCashFlow')),
    });
  }

  return { rows, skippedRows, unmatchedHeaders, parseErrors: [] };
}
