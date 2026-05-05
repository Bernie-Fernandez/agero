'use client';
import { useState, useTransition } from 'react';
import {
  createGlobalSetting, updateGlobalSetting, deleteGlobalSetting,
  proposeNonGlobalSetting, approveProposal, rejectProposal,
  updateExpiryConfig, createRssFeed, deleteRssFeed, toggleRssFeed,
  createMonitoredUrl, deleteMonitoredUrl, seedDefaultRssFeeds,
} from './actions';
import { fetchRssFeed, fetchMonitoredUrl } from '../trends/actions';

type GlobalSetting = { id: string; key: string; label: string; value: string; category: string; description: string | null; createdBy: { firstName: string; lastName: string } };
type NonGlobalSetting = { id: string; key: string; label: string; value: string; category: string; status: string };
type Proposal = { id: string; proposedKey: string; proposedLabel: string; proposedValue: string; reason: string | null; proposedBy: { firstName: string; lastName: string }; setting: { key: string; label: string } | null; createdAt: Date };
type ExpiryConfig = { defaultExpiryMonths: number; reminderDaysBefore: number } | null;
type RssFeed = { id: string; name: string; url: string; isActive: boolean; lastFetchedAt: Date | null };
type MonitoredUrl = { id: string; name: string; url: string; fetchSchedule: string; isActive: boolean; lastFetchedAt: Date | null };

const TABS = ['Global', 'Non-Global', 'Expiry Config', 'RSS Feeds', 'Monitored URLs'];

function fmt(d: Date | null) {
  if (!d) return 'Never';
  return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function SettingsClient({
  globalSettings, nonGlobalSettings, proposals, expiryConfig,
  rssFeeds, monitoredUrls, isAdmin,
}: {
  globalSettings: GlobalSetting[]; nonGlobalSettings: NonGlobalSetting[];
  proposals: Proposal[]; expiryConfig: ExpiryConfig;
  rssFeeds: RssFeed[]; monitoredUrls: MonitoredUrl[]; isAdmin: boolean;
}) {
  const [tab, setTab] = useState(isAdmin ? 'Global' : 'Non-Global');
  const [pending, startTransition] = useTransition();
  const [editingGlobal, setEditingGlobal] = useState<string | null>(null);
  const [showAddGlobal, setShowAddGlobal] = useState(false);
  const [showProposeModal, setShowProposeModal] = useState<NonGlobalSetting | 'new' | null>(null);
  const [showAddFeed, setShowAddFeed] = useState(false);
  const [showAddUrl, setShowAddUrl] = useState(false);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [fetchResults, setFetchResults] = useState<Record<string, string>>({});

  function handleAddGlobal(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => { await createGlobalSetting(fd); setShowAddGlobal(false); });
  }

  function handleEditGlobal(id: string, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => { await updateGlobalSetting(id, fd); setEditingGlobal(null); });
  }

  function handlePropose(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (showProposeModal !== 'new' && showProposeModal) {
      fd.set('settingId', showProposeModal.id);
      fd.set('proposedKey', showProposeModal.key);
      fd.set('proposedLabel', showProposeModal.label);
    }
    startTransition(async () => { await proposeNonGlobalSetting(fd); setShowProposeModal(null); });
  }

  function handleUpdateExpiry(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => { await updateExpiryConfig(fd); });
  }

  function handleAddFeed(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => { await createRssFeed(fd); setShowAddFeed(false); });
  }

  function handleAddUrl(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => { await createMonitoredUrl(fd); setShowAddUrl(false); });
  }

  function handleFetchFeed(id: string) {
    startTransition(async () => {
      const r = await fetchRssFeed(id);
      setFetchResults((prev) => ({ ...prev, [id]: r.ok ? `✓ ${r.created} new items` : `✗ ${r.error}` }));
    });
  }

  function handleFetchUrl(id: string) {
    startTransition(async () => {
      const r = await fetchMonitoredUrl(id);
      setFetchResults((prev) => ({ ...prev, [id]: r.ok ? (r.changed ? '✓ Content changed, trend item created' : '✓ No change') : `✗ ${r.error}` }));
    });
  }

  const visibleTabs = isAdmin ? TABS : ['Non-Global'];

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-zinc-900 mb-4">Design Studio Settings</h1>

      <div className="flex border-b border-zinc-200 mb-6 overflow-x-auto">
        {visibleTabs.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${tab === t ? 'border-brand text-brand' : 'border-transparent text-zinc-500 hover:text-zinc-800'}`}>
            {t}
            {t === 'Non-Global' && proposals.length > 0 && (
              <span className="ml-2 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{proposals.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Global Settings ── */}
      {tab === 'Global' && isAdmin && (
        <div>
          <div className="flex justify-end mb-3">
            <button onClick={() => setShowAddGlobal(true)} className="px-3 py-1.5 bg-brand text-white text-sm font-medium rounded-md hover:bg-brand/90">Add Setting</button>
          </div>
          {globalSettings.length === 0 ? (
            <p className="text-sm text-zinc-500">No global settings yet.</p>
          ) : (
            <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 border-b border-zinc-200">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500">Key</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500">Label</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500">Value</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500">Category</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {globalSettings.map((s) => (
                    editingGlobal === s.id ? (
                      <tr key={s.id}>
                        <td colSpan={5} className="px-4 py-3">
                          <form onSubmit={(e) => handleEditGlobal(s.id, e)} className="flex gap-2 flex-wrap items-end">
                            <input name="label" defaultValue={s.label} placeholder="Label" className="border border-zinc-200 rounded-md px-2 py-1.5 text-sm w-32" />
                            <input name="value" defaultValue={s.value} placeholder="Value" className="border border-zinc-200 rounded-md px-2 py-1.5 text-sm w-48" />
                            <input name="category" defaultValue={s.category} placeholder="Category" className="border border-zinc-200 rounded-md px-2 py-1.5 text-sm w-32" />
                            <input name="reason" placeholder="Reason for change" className="border border-zinc-200 rounded-md px-2 py-1.5 text-sm w-48" />
                            <button type="submit" disabled={pending} className="px-3 py-1.5 bg-brand text-white text-xs font-medium rounded-md">Save</button>
                            <button type="button" onClick={() => setEditingGlobal(null)} className="px-3 py-1.5 border border-zinc-200 text-zinc-700 text-xs rounded-md">Cancel</button>
                          </form>
                        </td>
                      </tr>
                    ) : (
                      <tr key={s.id} className="hover:bg-zinc-50">
                        <td className="px-4 py-2.5 font-mono text-xs text-zinc-500">{s.key}</td>
                        <td className="px-4 py-2.5 font-medium text-zinc-800">{s.label}</td>
                        <td className="px-4 py-2.5 text-zinc-600 max-w-xs truncate">{s.value}</td>
                        <td className="px-4 py-2.5 text-zinc-500 text-xs">{s.category}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => setEditingGlobal(s.id)} className="text-xs text-brand hover:underline">Edit</button>
                            <form action={deleteGlobalSetting.bind(null, s.id)}>
                              <button className="text-xs text-red-500 hover:underline">Delete</button>
                            </form>
                          </div>
                        </td>
                      </tr>
                    )
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {showAddGlobal && (
            <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
              <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
                <h2 className="text-base font-semibold text-zinc-900 mb-4">Add Global Setting</h2>
                <form onSubmit={handleAddGlobal} className="space-y-3">
                  <input name="key" required placeholder="Key (e.g. bca_exit_width)" className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm" />
                  <input name="label" required placeholder="Label" className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm" />
                  <textarea name="value" required placeholder="Value" rows={2} className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm resize-none" />
                  <input name="category" required placeholder="Category (e.g. Compliance)" className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm" />
                  <textarea name="description" placeholder="Description (optional)" rows={2} className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm resize-none" />
                  <div className="flex gap-3 pt-1">
                    <button type="submit" disabled={pending} className="px-4 py-2 bg-brand text-white text-sm font-medium rounded-md">Add</button>
                    <button type="button" onClick={() => setShowAddGlobal(false)} className="px-4 py-2 border border-zinc-200 text-zinc-700 text-sm rounded-md">Cancel</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Non-Global Settings ── */}
      {tab === 'Non-Global' && (
        <div>
          <div className="flex justify-end mb-3">
            <button onClick={() => setShowProposeModal('new')} className="px-3 py-1.5 bg-brand text-white text-sm font-medium rounded-md hover:bg-brand/90">Propose New Setting</button>
          </div>

          {/* Pending proposals */}
          {isAdmin && proposals.length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-zinc-700 mb-2">Pending Proposals ({proposals.length})</h2>
              <div className="space-y-2">
                {proposals.map((p) => (
                  <div key={p.id} className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-zinc-800">{p.proposedLabel} <span className="font-mono text-xs text-zinc-400">({p.proposedKey})</span></p>
                      <p className="text-sm text-zinc-600 mt-0.5">Value: {p.proposedValue}</p>
                      {p.reason && <p className="text-xs text-zinc-500 mt-0.5">Reason: {p.reason}</p>}
                      <p className="text-xs text-zinc-400 mt-0.5">By {p.proposedBy.firstName} {p.proposedBy.lastName}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <form action={approveProposal.bind(null, p.id)}>
                        <button className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-md">Approve</button>
                      </form>
                      <button onClick={() => setRejectId(p.id)} className="px-3 py-1.5 border border-red-200 text-red-600 text-xs font-medium rounded-md">Reject</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {nonGlobalSettings.length === 0 ? (
            <p className="text-sm text-zinc-500">No active non-global settings.</p>
          ) : (
            <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 border-b border-zinc-200">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500">Label</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500">Value</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500">Category</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {nonGlobalSettings.map((s) => (
                    <tr key={s.id} className="hover:bg-zinc-50">
                      <td className="px-4 py-2.5 font-medium text-zinc-800">{s.label}</td>
                      <td className="px-4 py-2.5 text-zinc-600 max-w-xs truncate">{s.value}</td>
                      <td className="px-4 py-2.5 text-zinc-500 text-xs">{s.category}</td>
                      <td className="px-4 py-2.5 text-right">
                        <button onClick={() => setShowProposeModal(s)} className="text-xs text-brand hover:underline">Propose Change</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {showProposeModal && (
            <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
              <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
                <h2 className="text-base font-semibold text-zinc-900 mb-4">
                  {showProposeModal === 'new' ? 'Propose New Setting' : `Propose Change: ${showProposeModal.label}`}
                </h2>
                <form onSubmit={handlePropose} className="space-y-3">
                  {showProposeModal === 'new' && (
                    <>
                      <input name="proposedKey" required placeholder="Key" className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm" />
                      <input name="proposedLabel" required placeholder="Label" className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm" />
                    </>
                  )}
                  <textarea name="proposedValue" required placeholder="Proposed value" rows={3}
                    defaultValue={showProposeModal !== 'new' ? showProposeModal.value : ''}
                    className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm resize-none" />
                  <textarea name="reason" placeholder="Reason (optional)" rows={2} className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm resize-none" />
                  <div className="flex gap-3 pt-1">
                    <button type="submit" disabled={pending} className="px-4 py-2 bg-brand text-white text-sm font-medium rounded-md">Submit</button>
                    <button type="button" onClick={() => setShowProposeModal(null)} className="px-4 py-2 border border-zinc-200 text-zinc-700 text-sm rounded-md">Cancel</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {rejectId && (
            <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
              <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
                <h2 className="text-base font-semibold text-zinc-900 mb-3">Reject Proposal</h2>
                <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Reason for rejection (required)" rows={3}
                  className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm resize-none mb-4" />
                <div className="flex gap-3">
                  <form action={rejectProposal.bind(null, rejectId, rejectReason)} onSubmit={() => { setRejectId(null); setRejectReason(''); }}>
                    <button disabled={!rejectReason.trim()} className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md disabled:opacity-50">Reject</button>
                  </form>
                  <button onClick={() => setRejectId(null)} className="px-4 py-2 border border-zinc-200 text-zinc-700 text-sm rounded-md">Cancel</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Expiry Config ── */}
      {tab === 'Expiry Config' && isAdmin && (
        <div className="max-w-sm">
          <form onSubmit={handleUpdateExpiry} className="space-y-4 bg-white border border-zinc-200 rounded-lg p-6">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Default Expiry (months)</label>
              <input name="defaultExpiryMonths" type="number" min={1} max={120} defaultValue={expiryConfig?.defaultExpiryMonths ?? 12}
                className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Reminder Lead Time (days)</label>
              <input name="reminderDaysBefore" type="number" min={1} max={90} defaultValue={expiryConfig?.reminderDaysBefore ?? 30}
                className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm" />
            </div>
            <button type="submit" disabled={pending} className="px-4 py-2 bg-brand text-white text-sm font-medium rounded-md hover:bg-brand/90 disabled:opacity-50">
              {pending ? 'Saving…' : 'Save'}
            </button>
          </form>
        </div>
      )}

      {/* ── RSS Feeds ── */}
      {tab === 'RSS Feeds' && isAdmin && (
        <div>
          <div className="flex justify-end gap-2 mb-3">
            <form action={async () => { await seedDefaultRssFeeds(); }}>
              <button className="px-3 py-1.5 border border-zinc-200 text-zinc-700 text-sm font-medium rounded-md hover:bg-zinc-50">Seed 10 Default Feeds</button>
            </form>
            <button onClick={() => setShowAddFeed(true)} className="px-3 py-1.5 bg-brand text-white text-sm font-medium rounded-md hover:bg-brand/90">Add Feed</button>
          </div>
          {rssFeeds.length === 0 ? (
            <p className="text-sm text-zinc-500">No RSS feeds registered.</p>
          ) : (
            <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 border-b border-zinc-200">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500">Name</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500">URL</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500">Last Fetched</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {rssFeeds.map((f) => (
                    <tr key={f.id} className="hover:bg-zinc-50">
                      <td className="px-4 py-2.5 font-medium text-zinc-800">{f.name} {!f.isActive && <span className="text-xs text-zinc-400">(inactive)</span>}</td>
                      <td className="px-4 py-2.5 text-zinc-500 text-xs truncate max-w-xs">{f.url}</td>
                      <td className="px-4 py-2.5 text-zinc-500 text-xs">{fmt(f.lastFetchedAt)}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex gap-2 justify-end items-center">
                          {fetchResults[f.id] && <span className="text-xs text-zinc-500">{fetchResults[f.id]}</span>}
                          <button onClick={() => handleFetchFeed(f.id)} disabled={pending} className="text-xs text-brand hover:underline disabled:opacity-50">Fetch Now</button>
                          <form action={toggleRssFeed.bind(null, f.id, !f.isActive)}>
                            <button className="text-xs text-zinc-500 hover:underline">{f.isActive ? 'Deactivate' : 'Activate'}</button>
                          </form>
                          <form action={deleteRssFeed.bind(null, f.id)}>
                            <button className="text-xs text-red-500 hover:underline">Delete</button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {showAddFeed && (
            <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
              <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
                <h2 className="text-base font-semibold text-zinc-900 mb-4">Add RSS Feed</h2>
                <form onSubmit={handleAddFeed} className="space-y-3">
                  <input name="name" required placeholder="Publication name" className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm" />
                  <input name="url" type="url" required placeholder="Feed URL" className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm" />
                  <div className="flex gap-3">
                    <button type="submit" disabled={pending} className="px-4 py-2 bg-brand text-white text-sm font-medium rounded-md">Add</button>
                    <button type="button" onClick={() => setShowAddFeed(false)} className="px-4 py-2 border border-zinc-200 text-zinc-700 text-sm rounded-md">Cancel</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Monitored URLs ── */}
      {tab === 'Monitored URLs' && isAdmin && (
        <div>
          <div className="flex justify-end mb-3">
            <button onClick={() => setShowAddUrl(true)} className="px-3 py-1.5 bg-brand text-white text-sm font-medium rounded-md hover:bg-brand/90">Add URL</button>
          </div>
          {monitoredUrls.length === 0 ? (
            <p className="text-sm text-zinc-500">No monitored URLs.</p>
          ) : (
            <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 border-b border-zinc-200">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500">Name</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500">URL</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500">Schedule</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500">Last Fetched</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {monitoredUrls.map((u) => (
                    <tr key={u.id} className="hover:bg-zinc-50">
                      <td className="px-4 py-2.5 font-medium text-zinc-800">{u.name}</td>
                      <td className="px-4 py-2.5 text-zinc-500 text-xs truncate max-w-xs">{u.url}</td>
                      <td className="px-4 py-2.5 text-zinc-500 text-xs">{u.fetchSchedule}</td>
                      <td className="px-4 py-2.5 text-zinc-500 text-xs">{fmt(u.lastFetchedAt)}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex gap-2 justify-end items-center">
                          {fetchResults[u.id] && <span className="text-xs text-zinc-500">{fetchResults[u.id]}</span>}
                          <button onClick={() => handleFetchUrl(u.id)} disabled={pending} className="text-xs text-brand hover:underline disabled:opacity-50">Fetch Now</button>
                          <form action={deleteMonitoredUrl.bind(null, u.id)}>
                            <button className="text-xs text-red-500 hover:underline">Delete</button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {showAddUrl && (
            <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
              <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
                <h2 className="text-base font-semibold text-zinc-900 mb-4">Add Monitored URL</h2>
                <form onSubmit={handleAddUrl} className="space-y-3">
                  <input name="name" required placeholder="Descriptive name" className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm" />
                  <input name="url" type="url" required placeholder="URL to monitor" className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm" />
                  <select name="fetchSchedule" className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm">
                    <option value="DAILY">Daily</option>
                    <option value="WEEKLY">Weekly</option>
                    <option value="MANUAL">Manual</option>
                  </select>
                  <div className="flex gap-3">
                    <button type="submit" disabled={pending} className="px-4 py-2 bg-brand text-white text-sm font-medium rounded-md">Add</button>
                    <button type="button" onClick={() => setShowAddUrl(false)} className="px-4 py-2 border border-zinc-200 text-zinc-700 text-sm rounded-md">Cancel</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
