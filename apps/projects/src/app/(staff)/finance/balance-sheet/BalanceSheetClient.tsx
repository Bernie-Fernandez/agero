'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BSSnapshotRow, syncBalanceSheetMonth, backfillBalanceSheets } from './actions';

const AUD = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
  maximumFractionDigits: 0,
});

function fmt(val: string | null): string {
  if (val === null || val === undefined) return '—';
  const n = Number(val);
  return isNaN(n) ? '—' : AUD.format(n);
}

function num(val: string | null): number {
  return val === null || val === undefined ? 0 : Number(val) || 0;
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function monthLabel(iso: string): string {
  const d = new Date(iso);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function MovementBadge({ current, prior }: { current: number; prior: number | undefined }) {
  if (prior === undefined || prior === 0) return null;
  const diff = current - prior;
  if (Math.abs(diff) < 0.01) return null;
  const up = diff > 0;
  return (
    <span className={`ml-2 text-xs font-medium ${up ? 'text-emerald-600' : 'text-red-500'}`}>
      {up ? '↑' : '↓'} {AUD.format(Math.abs(diff))}
    </span>
  );
}

// ─── Balance Sheet table row helpers ─────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return (
    <tr className="bg-zinc-800">
      <td colSpan={2} className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-white">
        {label}
      </td>
    </tr>
  );
}

function SubHeader({ label }: { label: string }) {
  return (
    <tr className="bg-zinc-100">
      <td colSpan={2} className="px-4 py-1.5 text-xs font-semibold text-zinc-500 uppercase tracking-wide">
        {label}
      </td>
    </tr>
  );
}

function DataRow({ label, value, indent = false }: { label: string; value: string; indent?: boolean }) {
  return (
    <tr className="border-b border-zinc-100 hover:bg-zinc-50">
      <td className={`py-2 text-sm text-zinc-700 ${indent ? 'pl-8 pr-4' : 'px-4'}`}>{label}</td>
      <td className="px-4 py-2 text-sm text-right font-mono text-zinc-800">{value}</td>
    </tr>
  );
}

function TotalRow({ label, value, bold = false, priorValue, large = false }: { label: string; value: string; priorValue?: number; bold?: boolean; large?: boolean }) {
  const currentNum = Number(value.replace(/[^0-9.-]/g, ''));
  return (
    <tr className={`${large ? 'bg-zinc-900' : 'bg-zinc-700'} text-white`}>
      <td className={`px-4 py-2 text-sm ${bold || large ? 'font-bold' : 'font-semibold'} ${large ? 'text-base' : ''}`}>
        {label}
        {priorValue !== undefined && (
          <MovementBadge current={currentNum} prior={priorValue} />
        )}
      </td>
      <td className={`px-4 py-2 text-right font-mono ${large ? 'text-base font-bold' : 'font-semibold'}`}>{value}</td>
    </tr>
  );
}

function SpacerRow() {
  return <tr className="h-2"><td colSpan={2} /></tr>;
}

// ─── Main component ───────────────────────────────────────────────────────────

type Props = { snapshots: BSSnapshotRow[] };

export default function BalanceSheetClient({ snapshots: initial }: Props) {
  const router = useRouter();
  const [snapshots, setSnapshots] = useState(initial);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [isBackfilling, startBackfill] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Auto-backfill on first load if no data
  useEffect(() => {
    if (snapshots.length === 0) {
      setInfo('Loading Balance Sheet data from Xero…');
      startBackfill(async () => {
        const res = await backfillBalanceSheets();
        if (res.ok) {
          setInfo(`Loaded ${res.pulled} months.`);
        } else {
          setInfo(null);
          setError(res.errors.slice(0, 3).join('; ') || 'Backfill failed.');
        }
        router.refresh();
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const snap = snapshots[selectedIdx] ?? null;
  const priorSnap = snapshots[selectedIdx + 1] ?? null;

  function handleSync() {
    if (!snap) return;
    const d = new Date(snap.reportMonth);
    const month = d.getUTCMonth() + 1;
    const year = d.getUTCFullYear();
    setError(null);
    setInfo(null);
    startTransition(async () => {
      const res = await syncBalanceSheetMonth(month, year);
      if (res.ok) {
        setInfo('Synced successfully.');
        router.refresh();
      } else {
        setError(res.error ?? 'Sync failed.');
      }
    });
  }

  function handleBackfill() {
    setError(null);
    setInfo('Backfilling all months from Xero…');
    startBackfill(async () => {
      const res = await backfillBalanceSheets();
      if (res.ok) {
        setInfo(`Backfilled ${res.pulled} months successfully.`);
      } else {
        setInfo(null);
        setError(res.errors.slice(0, 3).join('; ') || 'Backfill failed.');
      }
      router.refresh();
    });
  }

  // Compute derived values
  const totalA   = num(snap?.totalAssets);
  const totalL   = num(snap?.totalLiabilities);
  const totalEq  = num(snap?.totalEquity);
  const isBalanced = snap ? Math.abs(totalA - totalL - totalEq) < 1 : true;

  const priorTotalA  = priorSnap ? num(priorSnap.totalAssets)      : undefined;
  const priorTotalL  = priorSnap ? num(priorSnap.totalLiabilities)  : undefined;
  const priorTotalEq = priorSnap ? num(priorSnap.totalEquity)       : undefined;

  const cash = num(snap?.cashAndBankBalances);
  const ar   = num(snap?.accountsReceivable);
  const ret  = num(snap?.retentionsHeld);
  const wip  = num(snap?.wipAsset);
  const tca  = num(snap?.totalCurrentAssets);
  const otherCurrentAssets = Math.max(0, tca - cash - ar - ret - wip);

  const ap   = num(snap?.accountsPayable);
  const tcl  = num(snap?.totalCurrentLiabilities);
  const otherCurrentLiab = Math.max(0, tcl - ap);

  const tncA = num(snap?.totalNonCurrentAssets);
  const tncL = num(snap?.totalNonCurrentLiabilities);

  const isPendingAny = isPending || isBackfilling;

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-xl font-bold text-zinc-900">Balance Sheet</h1>

        <div className="flex items-center gap-3 flex-wrap">
          {snapshots.length > 0 && (
            <select
              className="border border-zinc-300 rounded-lg px-3 py-2 text-sm"
              value={selectedIdx}
              onChange={(e) => { setSelectedIdx(Number(e.target.value)); setError(null); setInfo(null); }}
            >
              {snapshots.map((s, i) => (
                <option key={s.id} value={i}>{monthLabel(s.reportMonth)}</option>
              ))}
            </select>
          )}

          <button
            onClick={handleSync}
            disabled={isPendingAny || !snap}
            className="px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded-lg hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? 'Syncing…' : 'Sync Latest Month'}
          </button>

          <button
            onClick={handleBackfill}
            disabled={isPendingAny}
            className="px-4 py-2 bg-zinc-100 text-zinc-700 text-sm font-medium rounded-lg hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isBackfilling ? 'Backfilling…' : 'Backfill All'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      {info && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-700">{info}</div>
      )}

      {!snap && !isPendingAny && (
        <div className="bg-white border border-zinc-200 rounded-xl p-8 text-center text-zinc-400 text-sm">
          No Balance Sheet data yet. Click &quot;Backfill All&quot; to load from Xero.
        </div>
      )}

      {snap && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-600 mb-1">Total Assets</p>
              <p className="text-2xl font-bold text-blue-800">{fmt(snap.totalAssets)}</p>
              <MovementBadge current={totalA} prior={priorTotalA} />
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-600 mb-1">Total Liabilities</p>
              <p className="text-2xl font-bold text-amber-800">{fmt(snap.totalLiabilities)}</p>
              <MovementBadge current={totalL} prior={priorTotalL} />
            </div>
            <div className={`border rounded-xl p-5 ${totalEq >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
              <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${totalEq >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>Net Equity</p>
              <p className={`text-2xl font-bold ${totalEq >= 0 ? 'text-emerald-800' : 'text-red-800'}`}>{fmt(snap.totalEquity)}</p>
              <MovementBadge current={totalEq} prior={priorTotalEq} />
            </div>
          </div>

          {/* Balance check warning */}
          {!isBalanced && (
            <div className="bg-red-50 border border-red-300 rounded-lg px-4 py-3 text-sm text-red-700 font-medium">
              Balance sheet does not balance — check Xero data. (Assets: {fmt(snap.totalAssets)}, Liabilities + Equity: {AUD.format(totalL + totalEq)})
            </div>
          )}

          {/* Structured table */}
          <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-700">
                Balance Sheet — {monthLabel(snap.reportMonth)}
              </h2>
              <span className="text-xs text-zinc-400">
                Synced {new Date(snap.syncedAt).toLocaleString('en-AU', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            <table className="w-full border-collapse">
              <tbody>
                {/* ASSETS */}
                <SectionHeader label="Assets" />
                <SubHeader label="Current Assets" />
                {cash > 0 && <DataRow label="Cash and Bank" value={AUD.format(cash)} indent />}
                {ar > 0 && <DataRow label="Accounts Receivable" value={AUD.format(ar)} indent />}
                {ret > 0 && <DataRow label="Retentions Held" value={AUD.format(ret)} indent />}
                {wip > 0 && <DataRow label="WIP Asset" value={AUD.format(wip)} indent />}
                {otherCurrentAssets > 1 && <DataRow label="Other Current Assets" value={AUD.format(otherCurrentAssets)} indent />}
                <TotalRow label="Total Current Assets" value={fmt(snap.totalCurrentAssets)} />

                {tncA > 0 && (
                  <>
                    <SpacerRow />
                    <SubHeader label="Non-Current Assets" />
                    <TotalRow label="Total Non-Current Assets" value={fmt(snap.totalNonCurrentAssets)} />
                  </>
                )}

                <SpacerRow />
                <TotalRow label="TOTAL ASSETS" value={fmt(snap.totalAssets)} bold large priorValue={priorTotalA} />

                <SpacerRow />

                {/* LIABILITIES */}
                <SectionHeader label="Liabilities" />
                <SubHeader label="Current Liabilities" />
                {ap > 0 && <DataRow label="Accounts Payable" value={AUD.format(ap)} indent />}
                {otherCurrentLiab > 1 && <DataRow label="Other Current Liabilities" value={AUD.format(otherCurrentLiab)} indent />}
                <TotalRow label="Total Current Liabilities" value={fmt(snap.totalCurrentLiabilities)} />

                {tncL > 0 && (
                  <>
                    <SpacerRow />
                    <SubHeader label="Non-Current Liabilities" />
                    <TotalRow label="Total Non-Current Liabilities" value={fmt(snap.totalNonCurrentLiabilities)} />
                  </>
                )}

                <SpacerRow />
                <TotalRow label="TOTAL LIABILITIES" value={fmt(snap.totalLiabilities)} bold large priorValue={priorTotalL} />

                <SpacerRow />

                {/* EQUITY */}
                <SectionHeader label="Equity" />
                <TotalRow label="TOTAL EQUITY" value={fmt(snap.totalEquity)} bold large priorValue={priorTotalEq} />
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
