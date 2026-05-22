'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Lead = {
  id: string;
  leadName: string;
  stage: string;
  updatedAt: string;
  lastSyncedAt: string | null;
  hubspotLastModified: string | null;
  syncLogs: Array<{ beforeValues: Record<string, unknown>; afterValues: Record<string, unknown>; syncedAt: string }>;
};

function fmtDate(v: string | null | undefined) {
  if (!v) return '—';
  return new Date(v).toLocaleString('en-AU');
}

export default function ConflictsClient({ conflicts }: { conflicts: Lead[] }) {
  const router = useRouter();
  const [resolving, setResolving] = useState<string | null>(null);
  const [msg, setMsg] = useState<Record<string, string>>({});

  async function resolve(leadId: string, resolution: 'ERP' | 'HUBSPOT') {
    setResolving(leadId);
    const res = await fetch(`/api/crm/hubspot/sync/conflicts/${leadId}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolution }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg((m) => ({ ...m, [leadId]: data.error ?? 'Failed' }));
    } else {
      setMsg((m) => ({ ...m, [leadId]: `Resolved — kept ${resolution} version` }));
      router.refresh();
    }
    setResolving(null);
  }

  return (
    <div className="p-6 max-w-5xl">
      <h1 className="text-xl font-semibold text-zinc-900 mb-1">Sync Conflicts</h1>
      <p className="text-sm text-zinc-500 mb-6">
        These leads were modified in both ERP and HubSpot since the last sync. Choose which version to keep.
      </p>

      {conflicts.length === 0 && (
        <div className="text-center py-16 text-zinc-400">
          <p className="text-lg mb-2">No conflicts</p>
          <p className="text-sm">All leads are in sync.</p>
        </div>
      )}

      <div className="space-y-4">
        {conflicts.map((lead) => {
          const log = lead.syncLogs[0];
          return (
            <div key={lead.id} className="bg-white border border-yellow-200 rounded-lg p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-zinc-900">{lead.leadName}</h3>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    ERP modified: {fmtDate(lead.updatedAt)} · HubSpot modified: {fmtDate(lead.hubspotLastModified)} · Last synced: {fmtDate(lead.lastSyncedAt)}
                  </p>
                </div>
                <span className="text-xs bg-yellow-100 text-yellow-700 font-medium px-2 py-0.5 rounded-full">CONFLICT</span>
              </div>

              {log && (
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-zinc-50 rounded p-3">
                    <p className="text-xs font-semibold text-zinc-500 mb-2">ERP Version (before conflict)</p>
                    <pre className="text-xs text-zinc-700 overflow-auto max-h-32 whitespace-pre-wrap">{JSON.stringify(log.beforeValues, null, 2)}</pre>
                  </div>
                  <div className="bg-blue-50 rounded p-3">
                    <p className="text-xs font-semibold text-blue-600 mb-2">HubSpot Version</p>
                    <pre className="text-xs text-blue-700 overflow-auto max-h-32 whitespace-pre-wrap">{JSON.stringify(log.afterValues, null, 2)}</pre>
                  </div>
                </div>
              )}

              {msg[lead.id] && (
                <p className="text-xs text-green-600 mb-3">{msg[lead.id]}</p>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => resolve(lead.id, 'ERP')}
                  disabled={resolving === lead.id}
                  className="px-4 py-1.5 text-sm bg-zinc-800 text-white rounded hover:bg-zinc-700 disabled:opacity-50"
                >
                  Keep ERP Version
                </button>
                <button
                  onClick={() => resolve(lead.id, 'HUBSPOT')}
                  disabled={resolving === lead.id}
                  className="px-4 py-1.5 text-sm bg-brand text-white rounded hover:bg-brand/90 disabled:opacity-50"
                >
                  Keep HubSpot Version
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
