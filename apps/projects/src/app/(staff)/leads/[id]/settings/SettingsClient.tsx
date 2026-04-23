'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { showToast, ToastContainer } from '@/components/Toast';
import { updateEstimateSettings, convertToProject } from '../actions';

const JOB_TYPES = [
  'Commercial Fitout', 'Refurbishment', 'Make Good',
  'Design & Construct', 'Minor Works', 'Other',
];

const AU_STATES = ['VIC', 'NSW', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'];

type Estimate = {
  id: string;
  title: string;
  notes: string | null;
  status: string;
  targetGpPct: number | string;
  minGpPct: number | string;
  defaultMarkupPct: number | string;
  costRecoveryPct: number | string;
  budgetCoverageTarget: number | string;
  addressStreet: string | null;
  addressSuburb: string | null;
  addressState: string | null;
  addressPostcode: string | null;
  jobType: string | null;
  floorAreaM2: number | string | null;
  estimatorId: string | null;
  revenueCostCodeId: string | null;
  tradePackageHighPct: number | string | null;
  tradePackageMedPct: number | string | null;
  tradePackageLowPct: number | string | null;
  marketEvalHighPct: number | string | null;
  marketEvalMedPct: number | string | null;
  marketEvalLowPct: number | string | null;
  declaredMarginDefaultPct: number | string | null;
  currencySymbol: string;
  costPerUnitLabel: string | null;
  taxCodeName: string;
  client: { id: string; name: string } | null;
};

type AppUser = { id: string; firstName: string; lastName: string };
type RevenueCode = { id: string; catCode: string; codeDescription: string };
type Company = { id: string; name: string };

type Tab = 'general' | 'financials' | 'report' | 'convert';

const inputCls = 'w-full border border-zinc-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30';
const labelCls = 'block text-sm font-medium text-zinc-700 mb-1';

function pct(v: number | string | null | undefined) {
  return v != null ? Number(v).toFixed(2) : '';
}

export default function SettingsClient({
  estimate,
  clients,
  users,
  revenueCodes,
}: {
  estimate: Estimate;
  clients: Company[];
  users: AppUser[];
  revenueCodes: RevenueCode[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('general');
  const [saving, startTransition] = useTransition();

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      await updateEstimateSettings(estimate.id, fd);
      showToast('Settings saved');
    });
  }

  function handleConvert(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const projectId = await convertToProject(estimate.id, fd);
      showToast('Converted to project');
      router.push(`/projects/${projectId}`);
    });
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'general', label: 'General' },
    { key: 'financials', label: 'Financials' },
    { key: 'report', label: 'Report Settings' },
    { key: 'convert', label: 'Convert to Project' },
  ];

  return (
    <div className="h-full overflow-auto bg-zinc-50 p-6">
      <ToastContainer />
      <div className="max-w-2xl mx-auto">
        <h2 className="text-base font-semibold text-zinc-800 mb-4">Estimate Settings</h2>

        <div className="flex gap-0 border-b border-zinc-200 mb-6">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-sm border-b-2 transition-colors -mb-px ${
                tab === t.key ? 'border-brand text-brand font-medium' : 'border-transparent text-zinc-500 hover:text-zinc-800'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── General ──────────────────────────────────────────────────────────── */}
        {tab === 'general' && (
          <form onSubmit={handleSave} className="bg-white rounded-lg border border-zinc-200 p-6 space-y-4">
            <div>
              <label className={labelCls}>Project Name</label>
              <input name="title" defaultValue={estimate.title} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Notes</label>
              <textarea name="notes" defaultValue={estimate.notes ?? ''} rows={4} className={`${inputCls} resize-none`} />
            </div>
            <div>
              <label className={labelCls}>Address</label>
              <div className="space-y-2">
                <input name="addressStreet" defaultValue={estimate.addressStreet ?? ''} placeholder="Street address" className={inputCls} />
                <div className="grid grid-cols-3 gap-2">
                  <input name="addressSuburb" defaultValue={estimate.addressSuburb ?? ''} placeholder="Suburb" className={inputCls} />
                  <select name="addressState" defaultValue={estimate.addressState ?? ''} className={inputCls}>
                    <option value="">State</option>
                    {AU_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <input name="addressPostcode" defaultValue={estimate.addressPostcode ?? ''} placeholder="Postcode" maxLength={4} className={inputCls} />
                </div>
              </div>
            </div>
            <div>
              <label className={labelCls}>Job Type</label>
              <select name="jobType" defaultValue={estimate.jobType ?? ''} className={inputCls}>
                <option value="">Select…</option>
                {JOB_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Revenue Code</label>
              <select name="revenueCostCodeId" defaultValue={estimate.revenueCostCodeId ?? ''} className={inputCls}>
                <option value="">Select…</option>
                {revenueCodes.map((rc) => <option key={rc.id} value={rc.id}>{rc.catCode} — {rc.codeDescription}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Estimator</label>
              <select name="estimatorId" defaultValue={estimate.estimatorId ?? ''} className={inputCls}>
                <option value="">Select…</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Floor Area (m²)</label>
              <input name="floorAreaM2" type="number" min="0" step="0.01" defaultValue={estimate.floorAreaM2 != null ? Number(estimate.floorAreaM2) : ''} placeholder="Optional" className={inputCls} />
            </div>
            <div className="flex justify-end">
              <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-brand text-white rounded-md hover:bg-brand/90 disabled:opacity-50">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        )}

        {/* ── Financials ───────────────────────────────────────────────────────── */}
        {tab === 'financials' && (
          <form onSubmit={handleSave} className="bg-white rounded-lg border border-zinc-200 p-6 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              {([
                { name: 'targetGpPct', label: 'Target GP %', value: estimate.targetGpPct },
                { name: 'minGpPct', label: 'Minimum GP %', value: estimate.minGpPct },
                { name: 'defaultMarkupPct', label: 'Default Markup %', value: estimate.defaultMarkupPct },
                { name: 'costRecoveryPct', label: 'Cost Recovery %', value: estimate.costRecoveryPct },
                { name: 'budgetCoverageTarget', label: 'Budget Coverage Target %', value: estimate.budgetCoverageTarget },
                { name: 'declaredMarginDefaultPct', label: 'Declared Margin Default %', value: estimate.declaredMarginDefaultPct },
              ] as const).map((f) => (
                <div key={f.name}>
                  <label className={labelCls}>{f.label}</label>
                  <input name={f.name} type="number" step="0.01" defaultValue={pct(f.value)} className={inputCls} />
                </div>
              ))}
            </div>

            <div>
              <p className="text-sm font-medium text-zinc-700 mb-2">Trade Package Thresholds</p>
              <div className="grid grid-cols-3 gap-3">
                {([
                  { name: 'tradePackageHighPct', label: 'High %', value: estimate.tradePackageHighPct },
                  { name: 'tradePackageMedPct', label: 'Medium %', value: estimate.tradePackageMedPct },
                  { name: 'tradePackageLowPct', label: 'Low %', value: estimate.tradePackageLowPct },
                ] as const).map((f) => (
                  <div key={f.name}>
                    <label className={labelCls}>{f.label}</label>
                    <input name={f.name} type="number" step="0.01" defaultValue={pct(f.value)} className={inputCls} />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-zinc-700 mb-2">Market Evaluation Thresholds</p>
              <div className="grid grid-cols-3 gap-3">
                {([
                  { name: 'marketEvalHighPct', label: 'High %', value: estimate.marketEvalHighPct },
                  { name: 'marketEvalMedPct', label: 'Medium %', value: estimate.marketEvalMedPct },
                  { name: 'marketEvalLowPct', label: 'Low %', value: estimate.marketEvalLowPct },
                ] as const).map((f) => (
                  <div key={f.name}>
                    <label className={labelCls}>{f.label}</label>
                    <input name={f.name} type="number" step="0.01" defaultValue={pct(f.value)} className={inputCls} />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end">
              <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-brand text-white rounded-md hover:bg-brand/90 disabled:opacity-50">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        )}

        {/* ── Report Settings ──────────────────────────────────────────────────── */}
        {tab === 'report' && (
          <form onSubmit={handleSave} className="bg-white rounded-lg border border-zinc-200 p-6 space-y-4">
            <div>
              <label className={labelCls}>Currency Symbol</label>
              <input name="currencySymbol" defaultValue={estimate.currencySymbol ?? '$'} maxLength={3} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Cost Per Unit Label</label>
              <input name="costPerUnitLabel" defaultValue={estimate.costPerUnitLabel ?? ''} placeholder="e.g. $/m²" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Tax Code Name</label>
              <input name="taxCodeName" defaultValue={estimate.taxCodeName ?? 'GST'} placeholder="e.g. GST" className={inputCls} />
            </div>
            <div className="flex justify-end">
              <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-brand text-white rounded-md hover:bg-brand/90 disabled:opacity-50">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        )}

        {/* ── Convert to Project ───────────────────────────────────────────────── */}
        {tab === 'convert' && (
          <form onSubmit={handleConvert} className="bg-white rounded-lg border border-zinc-200 p-6 space-y-4">
            {estimate.status === 'CONVERTED' ? (
              <p className="text-sm text-zinc-500">This estimate has already been converted to a project.</p>
            ) : (
              <>
                <p className="text-sm text-zinc-600">Convert this estimate to an active project. This will lock the estimate and create a new project record.</p>
                <div>
                  <label className={labelCls}>Project Name</label>
                  <input name="projectName" defaultValue={estimate.title} required className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Contract Value ($)</label>
                  <input name="contractValue" type="number" step="0.01" placeholder="0.00" className={inputCls} />
                </div>
                <div className="flex justify-end">
                  <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50">
                    {saving ? 'Converting…' : 'Convert to Project'}
                  </button>
                </div>
              </>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
