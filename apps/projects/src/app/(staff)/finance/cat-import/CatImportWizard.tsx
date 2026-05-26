'use client';

import { useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  parseCatImport,
  prepareCommit,
  commitCatImport,
  cancelCatImport,
  ParseResult,
  PrepareResult,
  SerializableValidatedRow,
} from './actions';

// ── Step indicator ────────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: 1 | 2 | 3 | 4 }) {
  const steps = ['Upload', 'Validate', 'Confirm', 'Done'];
  return (
    <div className="flex items-center gap-2 mb-8">
      {steps.map((label, i) => {
        const n = (i + 1) as 1 | 2 | 3 | 4;
        const done = n < current;
        const active = n === current;
        return (
          <div key={label} className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <div
                className={`w-6 h-6 rounded-full text-xs font-semibold flex items-center justify-center ${
                  done ? 'bg-green-500 text-white' : active ? 'bg-brand text-white' : 'bg-zinc-200 text-zinc-500'
                }`}
              >
                {done ? '✓' : n}
              </div>
              <span className={`text-sm ${active ? 'text-zinc-900 font-medium' : 'text-zinc-400'}`}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && <div className="w-8 h-px bg-zinc-200 mx-1" />}
          </div>
        );
      })}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function StatusBadge({ status }: { status: 'ok' | 'warning' | 'error' }) {
  if (status === 'ok') return <span className="text-green-600">✅</span>;
  if (status === 'warning') return <span className="text-amber-500">⚠</span>;
  return <span className="text-red-600">❌</span>;
}

// ── Step 1: Upload ────────────────────────────────────────────────────────────

function Step1Upload({ onNext }: { onNext: (file: File) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  }, []);

  return (
    <div className="space-y-6">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
          dragging ? 'border-brand bg-brand/5' : 'border-zinc-300 hover:border-zinc-400'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xls,.xlsx,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) setFile(f); }}
        />
        {file ? (
          <div className="space-y-1">
            <p className="text-sm font-medium text-zinc-900">{file.name}</p>
            <p className="text-xs text-zinc-500">{formatBytes(file.size)}</p>
            <button
              onClick={(e) => { e.stopPropagation(); setFile(null); }}
              className="text-xs text-red-500 hover:text-red-700 mt-1"
            >
              Remove
            </button>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-sm text-zinc-600">Drag and drop a CAT export here</p>
            <p className="text-xs text-zinc-400">or click to browse</p>
            <p className="text-xs text-zinc-400 mt-2">XLS · XLSX · CSV · Max 10 MB</p>
          </div>
        )}
      </div>

      <button
        onClick={() => file && onNext(file)}
        disabled={!file}
        className="px-5 py-2.5 text-sm font-medium rounded-lg bg-brand text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-brand/90 transition-colors"
      >
        Continue →
      </button>
    </div>
  );
}

// ── Step 2: Parse & Validate ──────────────────────────────────────────────────
// Runs parseCatImport on mount. Shows the detected as-at date (editable)
// above the validation table. User confirms date before proceeding.

function Step2Validate({
  file,
  onNext,
  onBack,
}: {
  file: File;
  onNext: (result: ParseResult, asAtDate: string) => void;
  onBack: () => void;
}) {
  const [parseState, setParseState] = useState<'parsing' | 'done' | 'error'>('parsing');
  const [result, setResult] = useState<ParseResult | null>(null);
  const [asAtDate, setAsAtDate] = useState('');
  const [dateSource, setDateSource] = useState<'detected' | 'manual' | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [prepareError, setPrepareError] = useState<string | null>(null);
  const [ranOnce, setRanOnce] = useState(false);

  const runParse = useCallback(async () => {
    const fd = new FormData();
    fd.append('file', file);
    const r = await parseCatImport(fd);
    setResult(r);
    if (r.ok && r.detectedAsAtDate) {
      setAsAtDate(r.detectedAsAtDate);
      setDateSource('detected');
    }
    setParseState(r.ok ? 'done' : 'error');
  }, [file]);

  if (!ranOnce) {
    setRanOnce(true);
    runParse();
  }

  if (parseState === 'parsing') {
    return (
      <div className="flex items-center gap-3 py-10">
        <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-zinc-600">Parsing file…</span>
      </div>
    );
  }

  if (parseState === 'error' || !result?.ok) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          {result?.error ?? 'Unknown error'}
        </div>
        <button onClick={onBack} className="px-4 py-2 text-sm border border-zinc-200 rounded-lg hover:bg-zinc-50">
          ← Back
        </button>
      </div>
    );
  }

  const rows = result.validatedRows ?? [];
  const errors = result.errors ?? [];
  const warnings = result.warnings ?? [];

  async function handleContinue() {
    if (!result?.previewId || !asAtDate) return;
    setPreparing(true);
    setPrepareError(null);
    const prep = await prepareCommit(result.previewId, asAtDate);
    setPreparing(false);
    if (!prep.ok) {
      setPrepareError(prep.error ?? 'Unknown error');
      return;
    }
    onNext({ ...result, existingImport: prep.existingImport }, asAtDate);
  }

  const dateWarn = asAtDate && new Date(asAtDate) < new Date(Date.now() - 18 * 30 * 24 * 60 * 60 * 1000);

  return (
    <div className="space-y-5">
      {/* As-at date — detected or manual */}
      <div className="rounded-xl border border-zinc-200 p-4 space-y-3">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">
            As-at date <span className="text-zinc-400 font-normal">(the snapshot date in CAT)</span>
          </label>
          <div className="flex items-center gap-3">
            <input
              type="date"
              value={asAtDate}
              max={new Date().toISOString().split('T')[0]}
              onChange={(e) => { setAsAtDate(e.target.value); setDateSource('manual'); }}
              className="w-48 px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
            {dateSource === 'detected' && asAtDate && (
              <span className="text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded">
                Detected from file: {formatDate(asAtDate)} — edit if needed
              </span>
            )}
          </div>
          {dateWarn && (
            <p className="text-xs text-amber-600 mt-1">
              This date is more than 18 months ago — ensure this is correct.
            </p>
          )}
          {!asAtDate && (
            <p className="text-xs text-red-600 mt-1">
              As-at date could not be detected from the file — please enter it manually.
            </p>
          )}
        </div>
      </div>

      {/* Parse summary */}
      <div className="flex flex-wrap gap-4 text-sm">
        <span className="text-zinc-700"><strong>{result.rowCount}</strong> project rows found</span>
        <span className="text-zinc-500">{result.skippedRows} subtotal/totals rows skipped</span>
        {errors.length > 0 && <span className="text-red-600 font-medium">{errors.length} blocking errors</span>}
        {warnings.length > 0 && <span className="text-amber-600">{warnings.length} warnings</span>}
      </div>

      {errors.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 space-y-1.5">
          <p className="text-xs font-semibold text-red-700 uppercase tracking-wide">Blocking Errors</p>
          {errors.map((e, i) => (
            <p key={i} className="text-sm text-red-600">Row {e.rowIndex}: {e.message}</p>
          ))}
        </div>
      )}

      {warnings.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-1.5">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Warnings (import will proceed)</p>
          {warnings.map((w, i) => (
            <p key={i} className="text-sm text-amber-700">Row {w.rowIndex} — {w.jobNo}: {w.message}</p>
          ))}
        </div>
      )}

      {(result.unmatchedHeaders?.length ?? 0) > 0 && (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
          <p className="text-xs text-zinc-500">
            Unrecognised columns (ignored): {result.unmatchedHeaders!.join(', ')}
          </p>
        </div>
      )}

      {prepareError && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {prepareError}
        </div>
      )}

      {/* Row table */}
      <div className="border border-zinc-200 rounded-xl overflow-auto max-h-96">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-zinc-50 border-b border-zinc-200 sticky top-0">
              <th className="px-3 py-2 text-left font-medium text-zinc-500">#</th>
              <th className="px-3 py-2 text-left font-medium text-zinc-500">Job No</th>
              <th className="px-3 py-2 text-left font-medium text-zinc-500 max-w-xs">Project</th>
              <th className="px-3 py-2 text-right font-medium text-zinc-500">Contract</th>
              <th className="px-3 py-2 text-right font-medium text-zinc-500">Margin</th>
              <th className="px-3 py-2 text-center font-medium text-zinc-500">Valid</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.map((vr: SerializableValidatedRow, i: number) => (
              <tr key={i} className={
                vr.status === 'error' ? 'bg-red-50/50' : vr.status === 'warning' ? 'bg-amber-50/30' : ''
              }>
                <td className="px-3 py-2 text-zinc-400">{i + 1}</td>
                <td className="px-3 py-2 font-mono text-zinc-700">{vr.row.jobNo}</td>
                <td className="px-3 py-2 text-zinc-600 max-w-xs truncate">{vr.row.projectName}</td>
                <td className="px-3 py-2 text-right text-zinc-700">
                  {vr.row.forecastContract.toLocaleString('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 })}
                </td>
                <td className="px-3 py-2 text-right text-zinc-700">
                  {(vr.row.forecastMarginPct * 100).toFixed(1)}%
                </td>
                <td className="px-3 py-2 text-center"><StatusBadge status={vr.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex gap-3">
        <button onClick={onBack} className="px-4 py-2 text-sm border border-zinc-200 rounded-lg hover:bg-zinc-50">
          ← Back
        </button>
        <button
          onClick={handleContinue}
          disabled={result.hasBlockingErrors || !asAtDate || preparing}
          className="px-5 py-2.5 text-sm font-medium rounded-lg bg-brand text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-brand/90 transition-colors flex items-center gap-2"
        >
          {preparing && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
          Continue →
        </button>
      </div>
    </div>
  );
}

// ── Step 3: Confirm ───────────────────────────────────────────────────────────

function Step3Confirm({
  parseResult,
  asAtDate,
  onCommit,
  onCancel,
}: {
  parseResult: ParseResult & { existingImport?: { id: string; uploadedAt: string; uploadedBy: string; sourceFilename: string } | null };
  asAtDate: string;
  onCommit: (confirmOverwrite: boolean) => Promise<void>;
  onCancel: () => void;
}) {
  const [overwriteText, setOverwriteText] = useState('');
  const [committing, setCommitting] = useState(false);
  const existing = parseResult.existingImport;
  const needsOverwrite = !!existing;
  const canCommit = !needsOverwrite || overwriteText.toUpperCase() === 'OVERWRITE';
  const goodRowCount = (parseResult.validatedRows ?? []).filter((r) => r.status !== 'error').length;

  async function handleCommit() {
    setCommitting(true);
    await onCommit(needsOverwrite);
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-zinc-200 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-zinc-900">Import Summary</h2>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <span className="text-zinc-500">As-at date</span>
          <span className="text-zinc-900 font-medium">{formatDate(asAtDate)}</span>
          <span className="text-zinc-500">Rows to save</span>
          <span className="text-zinc-900 font-medium">{goodRowCount}</span>
          {(parseResult.warnings?.length ?? 0) > 0 && (
            <>
              <span className="text-zinc-500">Warnings</span>
              <span className="text-amber-600">{parseResult.warnings?.length}</span>
            </>
          )}
        </div>
      </div>

      {needsOverwrite ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 space-y-3">
          <p className="text-sm font-semibold text-red-800">⚠ Overwrite warning</p>
          <p className="text-sm text-red-700">
            An import already exists for {formatDate(asAtDate)}, uploaded by{' '}
            <strong>{existing!.uploadedBy}</strong>. Continuing will overwrite all existing
            snapshots for this date.
          </p>
          <div>
            <label className="block text-xs font-medium text-red-700 mb-1">Type OVERWRITE to confirm</label>
            <input
              type="text"
              value={overwriteText}
              onChange={(e) => setOverwriteText(e.target.value)}
              placeholder="OVERWRITE"
              className="px-3 py-2 border border-red-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-300 w-48"
            />
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          Continuing will save {goodRowCount} snapshots to the database for {formatDate(asAtDate)}.
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={onCancel}
          disabled={committing}
          className="px-4 py-2 text-sm border border-zinc-200 rounded-lg hover:bg-zinc-50 disabled:opacity-40"
        >
          Cancel
        </button>
        <button
          onClick={handleCommit}
          disabled={!canCommit || committing}
          className="px-5 py-2.5 text-sm font-medium rounded-lg bg-brand text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-brand/90 transition-colors flex items-center gap-2"
        >
          {committing && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
          Commit Import
        </button>
      </div>
    </div>
  );
}

// ── Step 4: Success ───────────────────────────────────────────────────────────

function Step4Success({
  importId, isOverwrite, rowsInserted, rowsUpdated, rowsSkipped, asAtDate, onStartOver,
}: {
  importId: string; isOverwrite: boolean; rowsInserted: number; rowsUpdated: number;
  rowsSkipped: number; asAtDate: string; onStartOver: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-green-200 bg-green-50 p-6 space-y-3">
        <p className="text-lg font-semibold text-green-800">Import complete</p>
        <p className="text-sm text-green-700">
          {isOverwrite
            ? `Snapshots for ${formatDate(asAtDate)} were overwritten.`
            : `${rowsInserted} snapshots saved for ${formatDate(asAtDate)}.`}
          {rowsSkipped > 0 && ` ${rowsSkipped} rows skipped (projects not in Finance table).`}
        </p>
        <p className="text-xs text-green-600">Import ID: {importId}</p>
      </div>
      <div className="flex gap-3">
        <Link
          href={`/finance/cat-data?asAt=${asAtDate}`}
          className="px-5 py-2.5 text-sm font-medium rounded-lg bg-brand text-white hover:bg-brand/90 transition-colors"
        >
          View imported data →
        </Link>
        <button
          onClick={onStartOver}
          className="px-4 py-2 text-sm border border-zinc-200 rounded-lg hover:bg-zinc-50"
        >
          Import another
        </button>
      </div>
    </div>
  );
}

// ── Main wizard ───────────────────────────────────────────────────────────────

type ParseResultWithExisting = ParseResult & {
  existingImport?: { id: string; uploadedAt: string; uploadedBy: string; sourceFilename: string } | null;
};

export default function CatImportWizard() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [file, setFile] = useState<File | null>(null);
  const [asAtDate, setAsAtDate] = useState('');
  const [parseResult, setParseResult] = useState<ParseResultWithExisting | null>(null);
  const [commitResult, setCommitResult] = useState<{
    importId: string; isOverwrite: boolean; rowsInserted: number; rowsUpdated: number; rowsSkipped: number;
  } | null>(null);
  const [commitError, setCommitError] = useState<string | null>(null);

  function reset() {
    setStep(1); setFile(null); setAsAtDate('');
    setParseResult(null); setCommitResult(null); setCommitError(null);
  }

  async function handleCommit(confirmOverwrite: boolean) {
    if (!parseResult?.previewId) return;
    const result = await commitCatImport(parseResult.previewId, confirmOverwrite);
    if (result.ok && result.importId) {
      setCommitResult({
        importId: result.importId,
        isOverwrite: result.isOverwrite ?? false,
        rowsInserted: result.rowsInserted ?? 0,
        rowsUpdated: result.rowsUpdated ?? 0,
        rowsSkipped: result.rowsSkipped ?? 0,
      });
      setStep(4);
    } else {
      setCommitError(result.error ?? 'Unknown error');
    }
  }

  async function handleCancel() {
    if (parseResult?.previewId) await cancelCatImport(parseResult.previewId);
    reset();
  }

  return (
    <div>
      <StepIndicator current={step} />

      {step === 1 && (
        <Step1Upload
          onNext={(f) => { setFile(f); setStep(2); }}
        />
      )}

      {step === 2 && file && (
        <Step2Validate
          file={file}
          onNext={(r, date) => {
            setParseResult(r as ParseResultWithExisting);
            setAsAtDate(date);
            setStep(3);
          }}
          onBack={() => setStep(1)}
        />
      )}

      {step === 3 && parseResult && (
        <>
          {commitError && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
              {commitError}
            </div>
          )}
          <Step3Confirm
            parseResult={parseResult}
            asAtDate={asAtDate}
            onCommit={handleCommit}
            onCancel={handleCancel}
          />
        </>
      )}

      {step === 4 && commitResult && (
        <Step4Success
          importId={commitResult.importId}
          isOverwrite={commitResult.isOverwrite}
          rowsInserted={commitResult.rowsInserted}
          rowsUpdated={commitResult.rowsUpdated}
          rowsSkipped={commitResult.rowsSkipped}
          asAtDate={asAtDate}
          onStartOver={reset}
        />
      )}
    </div>
  );
}
