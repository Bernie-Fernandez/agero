'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Settings = {
  status: string;
  portalId: string | null;
  connectedAt: string | null;
  connectedBy: { firstName: string; lastName: string } | null;
  lastFullSyncAt: string | null;
  lastIncrementalSyncAt: string | null;
  confidenceGreenPct: string;
  confidenceYellowPct: string;
  confidenceRedPct: string;
} | null;

type SyncLog = {
  id: string;
  direction: string;
  operation: string;
  status: string;
  errorMessage: string | null;
  syncedAt: string;
  lead: { leadName: string } | null;
};

function fmtDate(v: string | null | undefined) {
  if (!v) return '—';
  return new Date(v).toLocaleString('en-AU');
}

const HS_PROPERTIES_MAP = [
  { erp: 'leadName', hs: 'dealname' }, { erp: 'contractValue', hs: 'amount' },
  { erp: 'stage', hs: 'dealstage' }, { erp: 'contractDate', hs: 'closedate' },
  { erp: 'goNoGoDate', hs: 'go_no_go_date' }, { erp: 'decisionDate', hs: 'decision_date' },
  { erp: 'startDate', hs: 'start_date' }, { erp: 'completionDate', hs: 'completion_date' },
  { erp: 'leaseExpiryDate', hs: 'lease_expiry_date' }, { erp: 'entryGpPct', hs: 'entry_gp__c' },
  { erp: 'confidenceRating', hs: 'confidence_rating' }, { erp: 'projectLocation', hs: 'project_location' },
  { erp: 'serviceType', hs: 'service__c' }, { erp: 'dealClassification', hs: 'deal_classification__c' },
  { erp: 'clientType', hs: 'client_type' }, { erp: 'floorAreaM2', hs: 'floor_area' },
  { erp: 'currentAddress', hs: 'current_address' }, { erp: 'futureAddress', hs: 'future_address' },
];

export default function HubSpotSettingsClient({
  settings,
  recentLogs,
}: {
  settings: Settings;
  recentLogs: SyncLog[];
}) {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncing, setSyncing] = useState<'full' | 'incremental' | null>(null);
  const [logFilter, setLogFilter] = useState('');
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const connected = settings?.status === 'CONNECTED';

  async function handleConnect() {
    if (!token) return;
    setConnecting(true);
    setMsg(null);
    const res = await fetch('/api/crm/hubspot/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken: token }),
    });
    const data = await res.json();
    if (!res.ok) { setMsg({ type: 'error', text: data.error ?? 'Connection failed' }); }
    else { setMsg({ type: 'success', text: `Connected to HubSpot portal ${data.portalId}` }); setToken(''); router.refresh(); }
    setConnecting(false);
  }

  async function handleDisconnect() {
    if (!confirm('Disconnect HubSpot? Leads will remain in ERP but sync will stop.')) return;
    setDisconnecting(true);
    await fetch('/api/crm/hubspot/disconnect', { method: 'POST' });
    setDisconnecting(false);
    router.refresh();
  }

  async function handleSync(type: 'full' | 'incremental') {
    setSyncing(type);
    setMsg(null);
    const url = type === 'full' ? '/api/crm/hubspot/sync' : '/api/crm/hubspot/sync/incremental';
    const res = await fetch(url, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) { setMsg({ type: 'error', text: data.error ?? 'Sync failed' }); }
    else { setMsg({ type: 'success', text: type === 'full' ? `Full sync complete: ${data.imported} imported, ${data.updated} updated` : `Incremental sync: ${data.synced} synced, ${data.conflicts} conflicts` }); router.refresh(); }
    setSyncing(null);
  }

  const filteredLogs = recentLogs.filter((l) => !logFilter || l.status === logFilter);

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-xl font-semibold text-zinc-900 mb-1">HubSpot Settings</h1>
      <p className="text-sm text-zinc-500 mb-6">Manage your HubSpot connection and sync settings.</p>

      {msg && (
        <div className={`mb-4 px-4 py-2 rounded border text-sm ${msg.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {msg.text}
        </div>
      )}

      {/* Connection status */}
      <div className="bg-white border border-zinc-200 rounded-lg p-5 mb-4">
        <h2 className="font-semibold text-zinc-800 mb-3">Connection</h2>
        {connected ? (
          <>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
              <span className="text-sm font-medium text-green-700">Connected</span>
              {settings?.portalId && <span className="text-sm text-zinc-500">Portal {settings.portalId}</span>}
            </div>
            <div className="text-xs text-zinc-500 space-y-1 mb-4">
              {settings?.connectedBy && <p>Connected by: {settings.connectedBy.firstName} {settings.connectedBy.lastName}</p>}
              {settings?.connectedAt && <p>Connected at: {fmtDate(settings.connectedAt)}</p>}
              {settings?.lastFullSyncAt && <p>Last full sync: {fmtDate(settings.lastFullSyncAt)}</p>}
              {settings?.lastIncrementalSyncAt && <p>Last incremental sync: {fmtDate(settings.lastIncrementalSyncAt)}</p>}
            </div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => handleSync('full')} disabled={syncing !== null} className="px-3 py-1.5 text-sm bg-brand text-white rounded hover:bg-brand/90 disabled:opacity-50">
                {syncing === 'full' ? 'Syncing…' : 'Run Full Sync'}
              </button>
              <button onClick={() => handleSync('incremental')} disabled={syncing !== null} className="px-3 py-1.5 text-sm border border-zinc-200 rounded hover:bg-zinc-50 disabled:opacity-50">
                {syncing === 'incremental' ? 'Syncing…' : 'Run Incremental Sync'}
              </button>
              <button onClick={handleDisconnect} disabled={disconnecting} className="px-3 py-1.5 text-sm border border-red-200 text-red-600 rounded hover:bg-red-50 disabled:opacity-50 ml-auto">
                Disconnect
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-4">
              <span className="w-2.5 h-2.5 rounded-full bg-zinc-300" />
              <span className="text-sm text-zinc-500">Not connected</span>
            </div>
            <p className="text-xs text-zinc-500 mb-3">
              Create a Private App in HubSpot Settings → Integrations → Private Apps with scopes:
              <code className="ml-1 bg-zinc-100 px-1 rounded">crm.objects.deals.read</code>{' '}
              <code className="bg-zinc-100 px-1 rounded">crm.objects.deals.write</code>{' '}
              <code className="bg-zinc-100 px-1 rounded">crm.schemas.deals.read</code>
            </p>
            <div className="flex gap-2">
              <input
                type="password"
                placeholder="Paste Private App access token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="flex-1 border border-zinc-200 rounded px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-brand"
              />
              <button onClick={handleConnect} disabled={connecting || !token} className="px-4 py-1.5 bg-brand text-white text-sm rounded hover:bg-brand/90 disabled:opacity-50 font-medium">
                {connecting ? 'Connecting…' : 'Connect HubSpot'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Field mapping reference */}
      <div className="bg-white border border-zinc-200 rounded-lg p-5 mb-4">
        <h2 className="font-semibold text-zinc-800 mb-3">Field Mapping Reference</h2>
        <div className="overflow-auto">
          <table className="w-full text-xs">
            <thead><tr className="border-b border-zinc-100"><th className="text-left py-1.5 font-medium text-zinc-500">ERP Field</th><th className="text-left py-1.5 font-medium text-zinc-500">HubSpot Property</th></tr></thead>
            <tbody className="divide-y divide-zinc-50">
              {HS_PROPERTIES_MAP.map((m) => (
                <tr key={m.erp}><td className="py-1 text-zinc-700">{m.erp}</td><td className="py-1 font-mono text-zinc-500">{m.hs}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sync log */}
      <div className="bg-white border border-zinc-200 rounded-lg p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-zinc-800">Sync Log (last 100)</h2>
          <select value={logFilter} onChange={(e) => setLogFilter(e.target.value)} className="text-xs border border-zinc-200 rounded px-2 py-1">
            <option value="">All statuses</option>
            <option value="SUCCESS">Success</option>
            <option value="ERROR">Error</option>
            <option value="CONFLICT">Conflict</option>
          </select>
        </div>
        <div className="overflow-auto max-h-80">
          <table className="w-full text-xs">
            <thead><tr className="border-b border-zinc-100 sticky top-0 bg-white">
              <th className="text-left py-1.5 font-medium text-zinc-500">Lead</th>
              <th className="text-left py-1.5 font-medium text-zinc-500">Direction</th>
              <th className="text-left py-1.5 font-medium text-zinc-500">Op</th>
              <th className="text-left py-1.5 font-medium text-zinc-500">Status</th>
              <th className="text-left py-1.5 font-medium text-zinc-500">Time</th>
            </tr></thead>
            <tbody className="divide-y divide-zinc-50">
              {filteredLogs.length === 0 && <tr><td colSpan={5} className="py-4 text-center text-zinc-400">No log entries.</td></tr>}
              {filteredLogs.map((log) => (
                <tr key={log.id}>
                  <td className="py-1 text-zinc-700 max-w-[160px] truncate">{log.lead?.leadName ?? '—'}</td>
                  <td className="py-1 text-zinc-500">{log.direction === 'ERP_TO_HUBSPOT' ? '→ HS' : '← HS'}</td>
                  <td className="py-1 text-zinc-500">{log.operation}</td>
                  <td className={`py-1 font-medium ${log.status === 'SUCCESS' ? 'text-green-600' : log.status === 'ERROR' ? 'text-red-500' : 'text-yellow-500'}`}>{log.status}</td>
                  <td className="py-1 text-zinc-400 whitespace-nowrap">{new Date(log.syncedAt).toLocaleString('en-AU')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
