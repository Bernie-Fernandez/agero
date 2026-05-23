'use client';
import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import LeadDetailPanel from './LeadDetailPanel';
import { stageLabel } from '@/lib/crm/stage-labels';

type User = { id: string; firstName: string; lastName: string };
type Lead = {
  id: string;
  hubspotDealId: string;
  leadName: string;
  stage: string;
  confidenceRating: string | null;
  probabilityPct: string | null;
  contractValue: string | null;
  goNoGoDate: string | null;
  decisionDate: string | null;
  contractDate: string | null;
  startDate: string | null;
  completionDate: string | null;
  syncStatus: string;
  lastSyncedAt: string | null;
  ownerUser: User | null;
  [key: string]: unknown;
};

const STAGE_COLORS: Record<string, string> = {
  RESEARCH: 'bg-zinc-100 text-zinc-600',
  VALIDATED: 'bg-blue-100 text-blue-700',
  DEVELOPING: 'bg-violet-100 text-violet-700',
  QUALIFIED: 'bg-indigo-100 text-indigo-700',
  SUBMISSION_IN_PROGRESS: 'bg-amber-100 text-amber-700',
  SUBMISSION_AWAITING: 'bg-orange-100 text-orange-700',
  INTENT_TO_NEGOTIATE: 'bg-yellow-100 text-yellow-800',
  CLOSED_WON: 'bg-green-100 text-green-700',
  CLOSED_LOST: 'bg-red-100 text-red-700',
  DEAD: 'bg-zinc-200 text-zinc-500',
  WITHDRAWN: 'bg-zinc-100 text-zinc-400',
  PURSUIT_UNSUCCESSFUL: 'bg-zinc-200 text-zinc-500',
  SUBMISSION_DECLINED: 'bg-red-100 text-red-600',
  SUBMISSION_WITHDRAWN: 'bg-zinc-100 text-zinc-400',
};

function SyncIcon({ status }: { status: string }) {
  if (status === 'SYNCED') return <span title="Synced" className="text-green-500">✓</span>;
  if (status === 'PENDING') return <span title="Pending sync" className="text-amber-500">⏳</span>;
  if (status === 'ERROR') return <span title="Sync error" className="text-red-500">✕</span>;
  if (status === 'CONFLICT') return <span title="Conflict — review needed" className="text-yellow-500">⚑</span>;
  if (status === 'ARCHIVED') return <span title="Archived — deal closed in HubSpot" className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-zinc-100 text-zinc-500">archived</span>;
  return null;
}

function fmt(v: string | null | undefined): string {
  if (!v) return '—';
  const n = parseFloat(v);
  return isNaN(n) ? '—' : new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(n);
}

function fmtDate(v: string | null | undefined): string {
  if (!v) return '—';
  return new Date(v).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
}

const FILTER_TABS = [
  { key: 'ALL', label: 'All active' },
  { key: 'RESEARCH', label: 'Research' },
  { key: 'VALIDATED', label: 'Validated' },
  { key: 'DEVELOPING', label: 'Developing' },
  { key: 'QUALIFIED', label: 'Qualified' },
  { key: 'SUBMISSION', label: 'Submission' },
  { key: 'NEGOTIATION', label: 'Negotiation' },
  { key: 'ARCHIVED', label: 'Archived' },
  { key: 'CONFLICT', label: 'Conflicts' },
];

const ACTIVE_STAGES = ['RESEARCH','VALIDATED','DEVELOPING','QUALIFIED','SUBMISSION_IN_PROGRESS','SUBMISSION_AWAITING','INTENT_TO_NEGOTIATE'];
const SUBMISSION_STAGES = ['SUBMISSION_IN_PROGRESS','SUBMISSION_AWAITING'];

export default function LeadsListClient({
  initialLeads,
  users,
  hubspotConnected,
  lastSync,
  portalId,
}: {
  initialLeads: Lead[];
  users: User[];
  hubspotConnected: boolean;
  lastSync: string | null;
  portalId: string | null;
}) {
  const router = useRouter();
  const [leads, setLeads] = useState(initialLeads);
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [sortField, setSortField] = useState<string>('updatedAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const triggerSync = useCallback(async () => {
    setSyncing(true);
    await fetch('/api/crm/hubspot/sync/incremental', { method: 'POST' });
    setSyncing(false);
    router.refresh();
  }, [router]);

  function handleSort(field: string) {
    if (sortField === field) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  }

  const filtered = leads.filter((l) => {
    if (filter === 'ALL') {
      if (!ACTIVE_STAGES.includes(l.stage) || l.syncStatus === 'ARCHIVED') return false;
    } else if (filter === 'SUBMISSION') {
      if (!SUBMISSION_STAGES.includes(l.stage) || l.syncStatus === 'ARCHIVED') return false;
    } else if (filter === 'NEGOTIATION') {
      if (l.stage !== 'INTENT_TO_NEGOTIATE' || l.syncStatus === 'ARCHIVED') return false;
    } else if (filter === 'ARCHIVED') {
      if (l.syncStatus !== 'ARCHIVED') return false;
    } else if (filter === 'CONFLICT') {
      if (l.syncStatus !== 'CONFLICT') return false;
    } else {
      // Single-stage tab (RESEARCH, VALIDATED, DEVELOPING, QUALIFIED)
      if (l.stage !== filter || l.syncStatus === 'ARCHIVED') return false;
    }
    if (ownerFilter && l.ownerUser?.id !== ownerFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !l.leadName.toLowerCase().includes(q) &&
        !(l.projectLocation as string | null)?.toLowerCase().includes(q) &&
        !(l.ownerUser ? `${l.ownerUser.firstName} ${l.ownerUser.lastName}` : '').toLowerCase().includes(q)
      ) return false;
    }
    return true;
  }).sort((a, b) => {
    const av = (a[sortField] as string) ?? '';
    const bv = (b[sortField] as string) ?? '';
    return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
  });

  function ThButton({ field, children }: { field: string; children: React.ReactNode }) {
    return (
      <button
        onClick={() => handleSort(field)}
        className="text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider hover:text-zinc-800 flex items-center gap-1 whitespace-nowrap"
      >
        {children}
        {sortField === field && <span>{sortDir === 'asc' ? '↑' : '↓'}</span>}
      </button>
    );
  }

  return (
    <div className="flex h-full">
      {/* Main list */}
      <div className={`flex flex-col flex-1 min-w-0 ${selectedLead ? 'hidden md:flex' : ''}`}>
        {/* Toolbar */}
        <div className="border-b border-zinc-200 bg-white px-6 py-3 flex items-center gap-3 flex-wrap">
          <h1 className="text-lg font-semibold text-zinc-900 mr-2">Leads</h1>
          <input
            type="text"
            placeholder="Search leads…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border border-zinc-200 rounded px-3 py-1.5 text-sm w-52 outline-none focus:ring-1 focus:ring-brand"
          />
          <select
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
            className="border border-zinc-200 rounded px-2 py-1.5 text-sm"
          >
            <option value="">All owners</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
            ))}
          </select>
          <div className="flex-1" />
          {hubspotConnected && (
            <button
              onClick={triggerSync}
              disabled={syncing}
              className="px-3 py-1.5 text-sm border border-zinc-200 rounded hover:bg-zinc-50 disabled:opacity-50"
            >
              {syncing ? 'Syncing…' : '↻ Sync'}
            </button>
          )}
          <button
            onClick={() => setSelectedLead({} as Lead)}
            className="px-3 py-1.5 text-sm bg-brand text-white rounded hover:bg-brand/90 font-medium"
          >
            + New Lead
          </button>
        </div>

        {/* HubSpot status bar */}
        <div className="px-6 py-1.5 bg-zinc-50 border-b border-zinc-100 flex items-center gap-3 text-xs text-zinc-500">
          {hubspotConnected ? (
            <>
              <span className="text-green-600 font-medium">● HubSpot connected</span>
              {portalId && <span>Portal {portalId}</span>}
              {lastSync && <span>Last sync: {fmtDate(lastSync)}</span>}
            </>
          ) : (
            <span className="text-zinc-400">HubSpot not connected — <a href="/crm/settings/hubspot" className="underline">Connect in Settings</a></span>
          )}
        </div>

        {/* Stage filter tabs */}
        <div className="flex gap-0 px-6 border-b border-zinc-200 bg-white overflow-x-auto">
          {FILTER_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className={`px-4 py-2 text-sm whitespace-nowrap border-b-2 transition-colors ${
                filter === t.key
                  ? 'border-brand text-brand font-medium'
                  : 'border-transparent text-zinc-500 hover:text-zinc-800'
              }`}
            >
              {t.label}
              {t.key === 'CONFLICT' && leads.filter((l) => l.syncStatus === 'CONFLICT').length > 0 && (
                <span className="ml-1 bg-yellow-400 text-yellow-900 text-[10px] font-bold px-1 rounded-full">
                  {leads.filter((l) => l.syncStatus === 'CONFLICT').length}
                </span>
              )}
              {t.key === 'ARCHIVED' && leads.filter((l) => l.syncStatus === 'ARCHIVED').length > 0 && (
                <span className="ml-1 bg-zinc-300 text-zinc-600 text-[10px] font-bold px-1 rounded-full">
                  {leads.filter((l) => l.syncStatus === 'ARCHIVED').length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm min-w-[1200px]">
            <thead className="bg-zinc-50 sticky top-0 border-b border-zinc-200">
              <tr>
                <th className="text-left px-4 py-2.5"><ThButton field="leadName">Lead Name</ThButton></th>
                <th className="text-left px-3 py-2.5"><ThButton field="stage">Stage</ThButton></th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Confidence</th>
                <th className="text-right px-3 py-2.5"><ThButton field="contractValue">Contract $</ThButton></th>
                <th className="text-right px-3 py-2.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap">Prob %</th>
                <th className="text-left px-3 py-2.5"><ThButton field="goNoGoDate">Go/No Go</ThButton></th>
                <th className="text-left px-3 py-2.5"><ThButton field="decisionDate">Decision</ThButton></th>
                <th className="text-left px-3 py-2.5"><ThButton field="contractDate">Contract</ThButton></th>
                <th className="text-left px-3 py-2.5"><ThButton field="startDate">Start</ThButton></th>
                <th className="text-left px-3 py-2.5"><ThButton field="completionDate">Completion</ThButton></th>
                <th className="text-left px-3 py-2.5">Owner</th>
                <th className="text-center px-3 py-2.5"><ThButton field="syncStatus">Sync</ThButton></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filtered.length === 0 && (
                <tr><td colSpan={12} className="text-center py-12 text-zinc-400">No leads found.</td></tr>
              )}
              {filtered.map((lead) => (
                <tr
                  key={lead.id}
                  onClick={() => setSelectedLead(lead)}
                  className="cursor-pointer hover:bg-zinc-50 transition-colors"
                >
                  <td className="px-4 py-2.5 font-medium text-zinc-900 max-w-[240px] truncate">{lead.leadName}</td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STAGE_COLORS[lead.stage] ?? 'bg-zinc-100 text-zinc-500'}`}>
                      {stageLabel(lead.stage)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    {lead.confidenceRating ? (
                      <span className={`text-xs font-medium ${lead.confidenceRating === 'GREEN' ? 'text-green-600' : lead.confidenceRating === 'YELLOW' ? 'text-amber-500' : 'text-red-500'}`}>
                        ● {lead.confidenceRating}
                      </span>
                    ) : <span className="text-zinc-300">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right text-zinc-700">{fmt(lead.contractValue)}</td>
                  <td className="px-3 py-2.5 text-right text-zinc-600">
                    {lead.probabilityPct ? `${(parseFloat(lead.probabilityPct) * 100).toFixed(0)}%` : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-zinc-600 whitespace-nowrap">{fmtDate(lead.goNoGoDate)}</td>
                  <td className="px-3 py-2.5 text-zinc-600 whitespace-nowrap">{fmtDate(lead.decisionDate)}</td>
                  <td className="px-3 py-2.5 text-zinc-600 whitespace-nowrap">{fmtDate(lead.contractDate)}</td>
                  <td className="px-3 py-2.5 text-zinc-600 whitespace-nowrap">{fmtDate(lead.startDate)}</td>
                  <td className="px-3 py-2.5 text-zinc-600 whitespace-nowrap">{fmtDate(lead.completionDate)}</td>
                  <td className="px-3 py-2.5 text-zinc-600 whitespace-nowrap text-xs">
                    {lead.ownerUser ? `${lead.ownerUser.firstName} ${lead.ownerUser.lastName}` : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-center"><SyncIcon status={lead.syncStatus} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail panel */}
      {selectedLead && (
        <LeadDetailPanel
          lead={selectedLead}
          users={users}
          portalId={portalId}
          onClose={() => setSelectedLead(null)}
          onSave={(updated) => {
            setLeads((prev) => prev.map((l) => l.id === updated.id ? updated as unknown as Lead : l));
            setSelectedLead(updated as unknown as Lead);
          }}
        />
      )}
    </div>
  );
}
