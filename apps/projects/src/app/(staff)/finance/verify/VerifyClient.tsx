'use client';
import { useState } from 'react';

type PnL = {
  revenue: string; costOfSales: string; directLabour: string; grossProfit: string;
  indirectExpenses: string; indirectLabour: string; marketingExpenses: string;
  netProfitBeforeTax: string; debtorDays: string | null; creditorDays: string | null;
} | null;

type BankBalance = { accountName: string; balance: string };
type FinanceProject = {
  jobNumber: string; projectName: string; forecastContractValue: string;
  forecastMarginPercent: string; claimTotal: string; subClaims: string;
  creditors: string; labour: string; totalCost: string;
};
type Budget = { category: string; lineItem: string; total: string };
type MonthStatus = { status: string; dataVerifiedAt: string | null } | null;

function Row({ label, value, reference, unit = '$' }: { label: string; value: string | null; reference?: string; unit?: string }) {
  const v = parseFloat(value ?? '0');
  const r = parseFloat(reference ?? '0');
  const variance = r !== 0 ? v - r : 0;
  const hasVariance = reference !== undefined && Math.abs(variance) > 0.01;

  return (
    <tr className={`border-b border-zinc-50 hover:bg-zinc-50`}>
      <td className="px-4 py-2.5 text-sm text-zinc-700">{label}</td>
      <td className="px-4 py-2.5 text-sm text-right text-zinc-900 font-medium">
        {value == null ? '—' : unit === '$'
          ? v.toLocaleString('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 })
          : unit === '%' ? (v).toFixed(1) + ' days'
          : v.toFixed(2)}
      </td>
      {reference !== undefined && (
        <>
          <td className="px-4 py-2.5 text-sm text-right text-zinc-500">
            {unit === '$'
              ? r.toLocaleString('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 })
              : r.toFixed(2)}
          </td>
          <td className={`px-4 py-2.5 text-sm text-right font-semibold ${hasVariance ? 'text-red-600' : 'text-green-600'}`}>
            {hasVariance
              ? (variance > 0 ? '+' : '') + variance.toLocaleString('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 })
              : '✓'}
          </td>
        </>
      )}
    </tr>
  );
}

function Panel({ title, children, allClear }: { title: string; children: React.ReactNode; allClear: boolean }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden mb-6">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 bg-zinc-50">
        <h2 className="text-sm font-semibold text-zinc-800">{title}</h2>
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${allClear ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {allClear ? '✓ All Clear' : '⚠ Variance'}
        </span>
      </div>
      <table className="w-full">
        {children}
      </table>
    </div>
  );
}

export default function VerifyClient({
  pnl, bankBalances, projects, budgets, monthStatus, reportMonth,
}: {
  pnl: PnL;
  bankBalances: BankBalance[];
  projects: FinanceProject[];
  budgets: Budget[];
  monthStatus: MonthStatus;
  reportMonth: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(monthStatus?.dataVerifiedAt != null);

  async function confirmData() {
    setConfirming(true);
    await fetch('/api/finance/verify/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reportMonth }),
    });
    setConfirmed(true);
    setConfirming(false);
  }

  // For the reference columns we show ERP vs "Excel reference" — since we don't have the Excel,
  // the reference column is omitted and we show ERP data with a note.
  const pnlAllClear = pnl != null;
  const bankAllClear = bankBalances.length > 0;
  const projectsAllClear = projects.length > 0;
  const budgetTotal = budgets.reduce((s, b) => s + parseFloat(b.total || '0'), 0);
  const budgetAllClear = budgets.length > 0;
  const overallAllClear = pnlAllClear && bankAllClear && projectsAllClear && budgetAllClear;

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Data Verification — March 2026</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Review ERP data before Sprint 9 calculation engine is built.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`inline-flex px-3 py-1 rounded-full text-sm font-semibold ${overallAllClear ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {overallAllClear ? '✓ Data Loaded' : '⚠ Missing Data'}
          </span>
          {confirmed ? (
            <span className="px-4 py-2 bg-green-50 border border-green-200 text-green-700 text-sm font-medium rounded-lg">
              Data Confirmed
            </span>
          ) : (
            <button
              onClick={confirmData}
              disabled={confirming || !overallAllClear}
              className="px-4 py-2 bg-brand hover:bg-brand/90 text-white text-sm font-medium rounded-lg disabled:opacity-50"
            >
              {confirming ? 'Confirming…' : 'Confirm Data'}
            </button>
          )}
        </div>
      </div>

      <div className="mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
        <strong>Note:</strong> The Management_Report.xlsx reference data was not uploaded. ERP figures shown below are from the database seed.
        Once the Excel is provided, upload it via the seed route to enable side-by-side variance comparison.
      </div>

      {/* Xero P&L Panel */}
      <Panel title="Xero P&L — March 2026" allClear={pnlAllClear}>
        <thead className="bg-zinc-50 text-xs text-zinc-500 uppercase">
          <tr>
            <th className="text-left px-4 py-2">Line Item</th>
            <th className="text-right px-4 py-2">ERP Value</th>
          </tr>
        </thead>
        <tbody>
          {pnl ? (
            <>
              <Row label="Revenue" value={pnl.revenue} />
              <Row label="Cost of Sales" value={pnl.costOfSales} />
              <Row label="Direct Labour" value={pnl.directLabour} />
              <Row label="Gross Profit" value={pnl.grossProfit} />
              <Row label="Indirect Expenses" value={pnl.indirectExpenses} />
              <Row label="Indirect Labour" value={pnl.indirectLabour} />
              <Row label="Marketing Expenses" value={pnl.marketingExpenses} />
              <Row label="Net Profit Before Tax" value={pnl.netProfitBeforeTax} />
              <Row label="Debtor Days" value={pnl.debtorDays} unit="%" />
              <Row label="Creditor Days" value={pnl.creditorDays} unit="%" />
            </>
          ) : (
            <tr><td colSpan={2} className="px-4 py-6 text-center text-sm text-zinc-400">No P&L data. Run Xero sync or seed from Excel.</td></tr>
          )}
        </tbody>
      </Panel>

      {/* Bank Balances Panel */}
      <Panel title="Bank Balances — March 2026" allClear={bankAllClear}>
        <thead className="bg-zinc-50 text-xs text-zinc-500 uppercase">
          <tr>
            <th className="text-left px-4 py-2">Account</th>
            <th className="text-right px-4 py-2">Balance</th>
          </tr>
        </thead>
        <tbody>
          {bankBalances.length > 0 ? bankBalances.map((b) => (
            <Row key={b.accountName} label={b.accountName} value={b.balance} />
          )) : (
            <tr><td colSpan={2} className="px-4 py-6 text-center text-sm text-zinc-400">No bank data. Run Xero sync or seed from Excel.</td></tr>
          )}
        </tbody>
      </Panel>

      {/* Projects Panel */}
      <Panel title="Finance Projects — March 2026" allClear={projectsAllClear}>
        <thead className="bg-zinc-50 text-xs text-zinc-500 uppercase">
          <tr>
            <th className="text-left px-4 py-2">Job</th>
            <th className="text-left px-4 py-2">Project</th>
            <th className="text-right px-4 py-2">Contract Value</th>
            <th className="text-right px-4 py-2">Margin%</th>
            <th className="text-right px-4 py-2">Claim Total</th>
            <th className="text-right px-4 py-2">Total Cost</th>
          </tr>
        </thead>
        <tbody>
          {projects.length > 0 ? projects.map((p) => (
            <tr key={p.jobNumber} className="border-b border-zinc-50 hover:bg-zinc-50">
              <td className="px-4 py-2.5 text-xs font-mono text-zinc-600">{p.jobNumber}</td>
              <td className="px-4 py-2.5 text-sm text-zinc-700">{p.projectName}</td>
              <td className="px-4 py-2.5 text-sm text-right text-zinc-900">{parseFloat(p.forecastContractValue).toLocaleString('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 })}</td>
              <td className="px-4 py-2.5 text-sm text-right text-zinc-700">{(parseFloat(p.forecastMarginPercent) * 100).toFixed(1)}%</td>
              <td className="px-4 py-2.5 text-sm text-right text-zinc-900">{parseFloat(p.claimTotal).toLocaleString('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 })}</td>
              <td className="px-4 py-2.5 text-sm text-right text-zinc-900">{parseFloat(p.totalCost).toLocaleString('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 })}</td>
            </tr>
          )) : (
            <tr><td colSpan={6} className="px-4 py-6 text-center text-sm text-zinc-400">No project data. Seed from Excel.</td></tr>
          )}
        </tbody>
      </Panel>

      {/* Budget Panel */}
      <Panel title="Annual Budget — FY2025-26" allClear={budgetAllClear}>
        <thead className="bg-zinc-50 text-xs text-zinc-500 uppercase">
          <tr>
            <th className="text-left px-4 py-2">Category</th>
            <th className="text-left px-4 py-2">Line Item</th>
            <th className="text-right px-4 py-2">Annual Total</th>
          </tr>
        </thead>
        <tbody>
          {budgets.length > 0 ? budgets.map((b) => (
            <tr key={`${b.category}-${b.lineItem}`} className="border-b border-zinc-50 hover:bg-zinc-50">
              <td className="px-4 py-2 text-xs text-zinc-500">{b.category}</td>
              <td className="px-4 py-2 text-sm text-zinc-700">{b.lineItem}</td>
              <td className="px-4 py-2 text-sm text-right text-zinc-900">{parseFloat(b.total).toLocaleString('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 })}</td>
            </tr>
          )) : (
            <tr><td colSpan={3} className="px-4 py-6 text-center text-sm text-zinc-400">No budget data. Seed from Excel.</td></tr>
          )}
          {budgets.length > 0 && (
            <tr className="border-t-2 border-zinc-200 bg-zinc-50">
              <td colSpan={2} className="px-4 py-2 text-xs font-bold text-zinc-700">Total All Line Items</td>
              <td className="px-4 py-2 text-sm text-right font-bold text-zinc-900">{budgetTotal.toLocaleString('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 })}</td>
            </tr>
          )}
        </tbody>
      </Panel>
    </div>
  );
}
