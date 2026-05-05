'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateSource, approveSource, rejectSource, toggleSourceActive, renewSourceExpiry, reindexSource, deleteSource } from '../actions';

type Version = {
  id: string; versionNumber: number; title: string; notes: string | null;
  changeSummary: string | null; changedBy: { firstName: string; lastName: string }; changedAt: Date;
};
type Source = {
  id: string; title: string; type: string; category: string; industryTag: string; status: string;
  isActive: boolean; expiryDate: Date; versionNumber: number; notes: string | null;
  url: string | null; filePath: string | null; fetchedContent: string | null;
  rejectionReason: string | null;
  submittedBy: { firstName: string; lastName: string };
  approvedBy: { firstName: string; lastName: string } | null;
  approvedAt: Date | null;
  versions: Version[];
};

const STATUS_COLORS: Record<string, string> = {
  INDEXED: 'bg-green-100 text-green-700', PENDING_INDEX: 'bg-amber-100 text-amber-700',
  PENDING_APPROVAL: 'bg-blue-100 text-blue-700', FAILED: 'bg-red-100 text-red-700', EXPIRED: 'bg-zinc-100 text-zinc-500',
};
const STATUS_LABELS: Record<string, string> = {
  INDEXED: 'Indexed', PENDING_INDEX: 'Pending Index', PENDING_APPROVAL: 'Pending Approval', FAILED: 'Failed', EXPIRED: 'Expired',
};
const CATEGORIES = [
  'COMPLIANCE', 'PAST_PROJECT', 'DESIGN_RULES', 'RESEARCH_TRENDS', 'CLIENT_BRIEF', 'CHATBOT_LEARNING', 'OTHER',
];
const CATEGORY_LABELS: Record<string, string> = {
  COMPLIANCE: 'Compliance & Standards', PAST_PROJECT: 'Past Projects', DESIGN_RULES: 'Design Rules',
  RESEARCH_TRENDS: 'Research & Trends', CLIENT_BRIEF: 'Client Briefs', CHATBOT_LEARNING: 'Chatbot Learning', OTHER: 'Other',
};

function fmt(d: Date | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}
function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex py-2 border-b border-zinc-100 last:border-0">
      <span className="w-40 shrink-0 text-xs text-zinc-500">{label}</span>
      <span className="text-sm text-zinc-800">{value ?? '—'}</span>
    </div>
  );
}

export default function SourceDetailClient({ source, isAdmin }: { source: Source; isAdmin: boolean }) {
  const router = useRouter();
  const [tab, setTab] = useState<'details' | 'versions' | 'content'>('details');
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await updateSource(source.id, fd);
        setEditing(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Update failed');
      }
    });
  }

  return (
    <div className="p-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-zinc-400 hover:text-zinc-700">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-zinc-900">{source.title}</h1>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${source.type === 'GLOBAL' ? 'bg-purple-100 text-purple-700' : 'bg-zinc-100 text-zinc-600'}`}>
                {source.type === 'GLOBAL' ? 'Global' : 'Non-Global'}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[source.status] ?? 'bg-zinc-100 text-zinc-500'}`}>
                {STATUS_LABELS[source.status] ?? source.status}
              </span>
              {!source.isActive && <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-400">Inactive</span>}
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">v{source.versionNumber} · Expires {fmt(source.expiryDate)}</p>
          </div>
        </div>

        {isAdmin && (
          <div className="flex gap-2 flex-wrap justify-end">
            {source.status === 'PENDING_APPROVAL' && (
              <>
                <form action={approveSource.bind(null, source.id)}>
                  <button className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-md hover:bg-green-700">Approve</button>
                </form>
                <button onClick={() => setShowRejectModal(true)} className="px-3 py-1.5 bg-red-50 text-red-700 text-xs font-medium rounded-md hover:bg-red-100">Reject</button>
              </>
            )}
            <button onClick={() => setEditing(!editing)} className="px-3 py-1.5 border border-zinc-200 text-zinc-700 text-xs font-medium rounded-md hover:bg-zinc-50">
              {editing ? 'Cancel Edit' : 'Edit'}
            </button>
            <form action={toggleSourceActive.bind(null, source.id, !source.isActive)}>
              <button className="px-3 py-1.5 border border-zinc-200 text-zinc-700 text-xs font-medium rounded-md hover:bg-zinc-50">
                {source.isActive ? 'Deactivate' : 'Activate'}
              </button>
            </form>
            <form action={renewSourceExpiry.bind(null, source.id)}>
              <button className="px-3 py-1.5 border border-zinc-200 text-zinc-700 text-xs font-medium rounded-md hover:bg-zinc-50">Renew Expiry</button>
            </form>
            <form action={reindexSource.bind(null, source.id)}>
              <button className="px-3 py-1.5 border border-zinc-200 text-zinc-700 text-xs font-medium rounded-md hover:bg-zinc-50">Re-index</button>
            </form>
            <button onClick={() => setShowDeleteConfirm(true)} className="px-3 py-1.5 border border-red-200 text-red-600 text-xs font-medium rounded-md hover:bg-red-50">Delete</button>
          </div>
        )}
      </div>

      {error && <p className="mb-4 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{error}</p>}
      {source.rejectionReason && (
        <p className="mb-4 text-sm text-red-700 bg-red-50 px-3 py-2 rounded-md">
          <span className="font-medium">Rejected:</span> {source.rejectionReason}
        </p>
      )}

      {/* Tabs */}
      <div className="flex border-b border-zinc-200 mb-6">
        {(['details', 'versions', 'content'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px capitalize transition-colors ${tab === t ? 'border-brand text-brand' : 'border-transparent text-zinc-500 hover:text-zinc-800'}`}>
            {t === 'versions' ? 'Version History' : t === 'content' ? 'Raw Content' : 'Details'}
          </button>
        ))}
      </div>

      {/* Details Tab */}
      {tab === 'details' && (
        editing && isAdmin ? (
          <form onSubmit={handleEdit} className="space-y-4 max-w-lg">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Title</label>
              <input name="title" defaultValue={source.title} className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Type</label>
                <select name="type" defaultValue={source.type} className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm">
                  <option value="NON_GLOBAL">Non-Global</option>
                  <option value="GLOBAL">Global</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Category</label>
                <select name="category" defaultValue={source.category} className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm">
                  {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Expiry Date</label>
              <input name="expiryDate" type="date" defaultValue={new Date(source.expiryDate).toISOString().split('T')[0]}
                className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Notes</label>
              <textarea name="notes" defaultValue={source.notes ?? ''} rows={3} className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm resize-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Change Summary</label>
              <input name="changeSummary" placeholder="What changed?" className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm" />
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={pending} className="px-4 py-2 bg-brand text-white text-sm font-medium rounded-md hover:bg-brand/90 disabled:opacity-50">
                {pending ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
        ) : (
          <div>
            <InfoRow label="Category" value={CATEGORY_LABELS[source.category] ?? source.category} />
            <InfoRow label="Industry Tag" value={source.industryTag} />
            <InfoRow label="URL" value={source.url ? <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline truncate">{source.url}</a> : null} />
            <InfoRow label="File" value={source.filePath ? source.filePath.split('/').pop() : null} />
            <InfoRow label="Expiry Date" value={fmt(source.expiryDate)} />
            <InfoRow label="Notes" value={source.notes} />
            <InfoRow label="Submitted By" value={`${source.submittedBy.firstName} ${source.submittedBy.lastName}`} />
            <InfoRow label="Approved By" value={source.approvedBy ? `${source.approvedBy.firstName} ${source.approvedBy.lastName}` : null} />
            <InfoRow label="Approved At" value={fmt(source.approvedAt)} />
          </div>
        )
      )}

      {/* Version History Tab */}
      {tab === 'versions' && (
        <div>
          {source.versions.length === 0 ? (
            <p className="text-sm text-zinc-500">No version history yet. Edits will appear here.</p>
          ) : (
            <div className="space-y-3">
              {source.versions.map((v) => (
                <div key={v.id} className="border border-zinc-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-zinc-800">v{v.versionNumber} — {v.title}</span>
                    <span className="text-xs text-zinc-400">{fmt(v.changedAt)} · {v.changedBy.firstName} {v.changedBy.lastName}</span>
                  </div>
                  {v.changeSummary && <p className="text-xs text-zinc-500">{v.changeSummary}</p>}
                  {v.notes && <p className="text-xs text-zinc-400 mt-1 italic">{v.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Raw Content Tab */}
      {tab === 'content' && (
        <div>
          {source.fetchedContent ? (
            <pre className="text-xs text-zinc-600 bg-zinc-50 border border-zinc-200 rounded-lg p-4 whitespace-pre-wrap overflow-auto max-h-[60vh]">
              {source.fetchedContent}
            </pre>
          ) : (
            <p className="text-sm text-zinc-500">No extracted content. This is available for URL-sourced entries after indexing.</p>
          )}
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
            <h2 className="text-base font-semibold text-zinc-900 mb-3">Reject Source</h2>
            <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason for rejection (required)" rows={3}
              className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm resize-none mb-4" />
            <div className="flex gap-3">
              <form action={rejectSource.bind(null, source.id, rejectReason)} onSubmit={() => setShowRejectModal(false)}>
                <button disabled={!rejectReason.trim()} className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 disabled:opacity-50">
                  Reject Source
                </button>
              </form>
              <button onClick={() => setShowRejectModal(false)} className="px-4 py-2 border border-zinc-200 text-zinc-700 text-sm rounded-md hover:bg-zinc-50">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
            <h2 className="text-base font-semibold text-zinc-900 mb-2">Delete Source</h2>
            <p className="text-sm text-zinc-600 mb-4">This will permanently delete this source and all version history. This cannot be undone.</p>
            <div className="flex gap-3">
              <form action={deleteSource.bind(null, source.id)}>
                <button className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700">Delete</button>
              </form>
              <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 border border-zinc-200 text-zinc-700 text-sm rounded-md hover:bg-zinc-50">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
