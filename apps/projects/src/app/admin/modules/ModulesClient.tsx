'use client';

import { useState, useTransition } from 'react';
import { toggleModuleFlag } from './actions';

const MODULE_DISPLAY: Record<string, string> = {
  admin:            'Admin',
  crm:              'CRM (Leads + HubSpot)',
  finance:          'Finance (P&L, Xero, Reports)',
  estimating:       'Estimating (Cost Plans, Trade Letting)',
  safety:           'Safety (Worker portal)',
  design_studio:    'Design Studio (Sources, Trends, Chatbot)',
  project_delivery: 'Project Delivery (ITPs, RFIs)',
  marketing:        'Marketing (Bid management)',
};

type Flag = {
  id: string;
  module: string;
  enabled: boolean;
  description: string;
  enabledAt: Date | null;
  enabledBy: { firstName: string; lastName: string } | null;
};

function formatRelative(date: Date | null): string {
  if (!date) return '—';
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function ConfirmDisableModal({
  moduleName,
  onConfirm,
  onCancel,
}: {
  moduleName: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
        <h2 className="text-base font-semibold text-zinc-900 mb-2">
          Disable {moduleName}?
        </h2>
        <p className="text-sm text-zinc-500 mb-5">
          Any users currently using this module will be redirected away on their
          next page load.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded-lg border border-zinc-200 text-zinc-700 hover:bg-zinc-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700"
          >
            Disable
          </button>
        </div>
      </div>
    </div>
  );
}

function Toast({ message, type }: { message: string; type: 'success' | 'error' }) {
  return (
    <div
      className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium text-white ${
        type === 'success' ? 'bg-green-600' : 'bg-red-600'
      }`}
    >
      {message}
    </div>
  );
}

export default function ModulesClient({ flags }: { flags: Flag[] }) {
  const [optimistic, setOptimistic] = useState<Record<string, boolean>>(
    () => Object.fromEntries(flags.map((f) => [f.module, f.enabled]))
  );
  const [confirm, setConfirm] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isPending, startTransition] = useTransition();

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  function handleToggle(module: string, currentlyEnabled: boolean) {
    if (currentlyEnabled) {
      // Disabling — show confirm dialog
      setConfirm(module);
    } else {
      // Enabling — no confirm needed
      doToggle(module, true);
    }
  }

  function doToggle(module: string, enabled: boolean) {
    const prev = optimistic[module];
    setOptimistic((s) => ({ ...s, [module]: enabled }));
    startTransition(async () => {
      try {
        await toggleModuleFlag(module, enabled);
        const label = MODULE_DISPLAY[module] ?? module;
        showToast(`${label} ${enabled ? 'enabled' : 'disabled'}`, 'success');
      } catch {
        setOptimistic((s) => ({ ...s, [module]: prev }));
        showToast('Could not save change', 'error');
      }
    });
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-zinc-900">Module Visibility</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Control which modules are visible across the platform. Disabled modules
          are hidden from the sidebar and return 404 on direct URL access.
        </p>
      </div>

      <div className="border border-zinc-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-zinc-50 border-b border-zinc-200">
              <th className="text-left px-4 py-3 font-medium text-zinc-500 text-xs uppercase tracking-wide">Module</th>
              <th className="text-left px-4 py-3 font-medium text-zinc-500 text-xs uppercase tracking-wide">Description</th>
              <th className="text-left px-4 py-3 font-medium text-zinc-500 text-xs uppercase tracking-wide">Status</th>
              <th className="text-left px-4 py-3 font-medium text-zinc-500 text-xs uppercase tracking-wide">Last enabled</th>
              <th className="text-left px-4 py-3 font-medium text-zinc-500 text-xs uppercase tracking-wide">By</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {flags.map((flag) => {
              const isEnabled = optimistic[flag.module] ?? flag.enabled;
              const displayName = MODULE_DISPLAY[flag.module] ?? flag.module;
              return (
                <tr key={flag.module} className="hover:bg-zinc-50/50">
                  <td className="px-4 py-3 font-medium text-zinc-900">{displayName}</td>
                  <td className="px-4 py-3 text-zinc-500 max-w-xs">{flag.description}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggle(flag.module, isEnabled)}
                      disabled={isPending}
                      className="flex items-center gap-2 group"
                      aria-label={`Toggle ${displayName}`}
                    >
                      <div
                        className={`relative w-9 h-5 rounded-full transition-colors ${
                          isEnabled ? 'bg-green-500' : 'bg-zinc-300'
                        }`}
                      >
                        <div
                          className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                            isEnabled ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </div>
                      <span
                        className={`text-xs font-medium ${
                          isEnabled ? 'text-green-600' : 'text-zinc-400'
                        }`}
                      >
                        {isEnabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </button>
                  </td>
                  <td className="px-4 py-3 text-zinc-400 text-xs">
                    {formatRelative(flag.enabledAt)}
                  </td>
                  <td className="px-4 py-3 text-zinc-500 text-xs">
                    {flag.enabledBy
                      ? `${flag.enabledBy.firstName} ${flag.enabledBy.lastName}`
                      : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {confirm && (
        <ConfirmDisableModal
          moduleName={MODULE_DISPLAY[confirm] ?? confirm}
          onConfirm={() => {
            doToggle(confirm, false);
            setConfirm(null);
          }}
          onCancel={() => setConfirm(null)}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}
