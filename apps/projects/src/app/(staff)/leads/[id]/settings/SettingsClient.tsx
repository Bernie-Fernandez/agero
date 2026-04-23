'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { showToast, ToastContainer } from '@/components/Toast';
import { updateEstimateSettings, convertToProject } from '../actions';

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
  client: { id: string; name: string } | null;
};

type Company = { id: string; name: string };

type Tab = 'general' | 'financials' | 'convert';

export default function SettingsClient({ estimate, clients }: { estimate: Estimate; clients: Company[] }) {
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
    { key: 'convert', label: 'Convert to Project' },
  ];

  return (
    <div className="h-full overflow-auto bg-zinc-50 p-6">
      <ToastContainer />
      <div className="max-w-2xl mx-auto">
        <h2 className="text-base font-semibold text-zinc-800 mb-4">Estimate Settings</h2>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-zinc-200 mb-6">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-sm border-b-2 transition-colors -mb-px ${
                tab === t.key ? 'border-brand text-brand font-medium' : 'border-transparent text-zinc-500 hover:text-zinc-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'general' && (
          <form onSubmit={handleSave} className="bg-white rounded-lg border border-zinc-200 p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Title</label>
              <input name="title" defaultValue={estimate.title} className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Notes</label>
              <textarea name="notes" defaultValue={estimate.notes ?? ''} rows={4} className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 resize-none" />
            </div>
            <div className="flex justify-end">
              <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-brand text-white rounded-md hover:bg-brand/90 disabled:opacity-50">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        )}

        {tab === 'financials' && (
          <form onSubmit={handleSave} className="bg-white rounded-lg border border-zinc-200 p-6 space-y-4">
            {[
              { name: 'targetGpPct', label: 'Target GP %', value: estimate.targetGpPct },
              { name: 'minGpPct', label: 'Minimum GP %', value: estimate.minGpPct },
              { name: 'defaultMarkupPct', label: 'Default Markup %', value: estimate.defaultMarkupPct },
              { name: 'costRecoveryPct', label: 'Cost Recovery %', value: estimate.costRecoveryPct },
              { name: 'budgetCoverageTarget', label: 'Budget Coverage Target %', value: estimate.budgetCoverageTarget },
            ].map((field) => (
              <div key={field.name}>
                <label className="block text-sm font-medium text-zinc-700 mb-1">{field.label}</label>
                <input
                  name={field.name}
                  type="number"
                  step="0.01"
                  defaultValue={Number(field.value).toFixed(2)}
                  className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
                />
              </div>
            ))}
            <div className="flex justify-end">
              <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-brand text-white rounded-md hover:bg-brand/90 disabled:opacity-50">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        )}

        {tab === 'convert' && (
          <form onSubmit={handleConvert} className="bg-white rounded-lg border border-zinc-200 p-6 space-y-4">
            {estimate.status === 'CONVERTED' ? (
              <p className="text-sm text-zinc-500">This estimate has already been converted to a project.</p>
            ) : (
              <>
                <p className="text-sm text-zinc-600">Convert this estimate to an active project. This will lock the estimate and create a new project record.</p>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Project Name</label>
                  <input name="projectName" defaultValue={estimate.title} required className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Contract Value ($)</label>
                  <input name="contractValue" type="number" step="0.01" placeholder="0.00" className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30" />
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
