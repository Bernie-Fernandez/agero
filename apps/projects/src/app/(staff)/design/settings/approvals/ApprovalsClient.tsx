'use client';
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { approveProposal, rejectProposal } from '../actions';

type Proposal = {
  id: string; proposedKey: string; proposedLabel: string; proposedValue: string;
  reason: string | null; proposedBy: { firstName: string; lastName: string };
  setting: { key: string; label: string } | null; createdAt: Date;
};

function fmt(d: Date) {
  return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function ApprovalsClient({ proposals }: { proposals: Proposal[] }) {
  const [pending, startTransition] = useTransition();
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const visible = proposals.filter((p) => !dismissed.has(p.id));

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/design/settings" className="text-zinc-400 hover:text-zinc-700">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-xl font-bold text-zinc-900">Approval Queue</h1>
        {visible.length > 0 && (
          <span className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{visible.length}</span>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="text-center py-16 bg-white border border-zinc-200 rounded-lg">
          <p className="text-zinc-500 text-sm">No pending proposals.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((p) => (
            <div key={p.id} className="bg-white border border-zinc-200 rounded-lg p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="text-sm font-medium text-zinc-900">
                    {p.setting ? `Change: ${p.setting.label}` : `New: ${p.proposedLabel}`}
                  </p>
                  <p className="text-xs font-mono text-zinc-400 mt-0.5">{p.proposedKey}</p>
                  <div className="mt-2 bg-zinc-50 rounded-md px-3 py-2">
                    <p className="text-sm text-zinc-700">{p.proposedValue}</p>
                  </div>
                  {p.reason && <p className="text-xs text-zinc-500 mt-2">Reason: {p.reason}</p>}
                  <p className="text-xs text-zinc-400 mt-1">
                    Proposed by {p.proposedBy.firstName} {p.proposedBy.lastName} · {fmt(p.createdAt)}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <form action={approveProposal.bind(null, p.id)} onSubmit={() => setDismissed((s) => new Set([...s, p.id]))}>
                    <button disabled={pending} className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-md hover:bg-green-700 disabled:opacity-50">
                      Approve
                    </button>
                  </form>
                  <button onClick={() => setRejectId(p.id)} className="px-3 py-1.5 border border-red-200 text-red-600 text-xs font-medium rounded-md hover:bg-red-50">
                    Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
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
              <form action={rejectProposal.bind(null, rejectId, rejectReason)}
                onSubmit={() => { setDismissed((s) => new Set([...s, rejectId!])); setRejectId(null); setRejectReason(''); }}>
                <button disabled={!rejectReason.trim()} className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md disabled:opacity-50">Reject</button>
              </form>
              <button onClick={() => setRejectId(null)} className="px-4 py-2 border border-zinc-200 text-zinc-700 text-sm rounded-md">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
