'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

type Source = {
  id: string;
  title: string;
  type: string;
  category: string;
  industryTag: string;
  status: string;
  isActive: boolean;
  expiryDate: Date;
  versionNumber: number;
  submittedBy: { firstName: string; lastName: string };
};

const STATUS_COLORS: Record<string, string> = {
  INDEXED: 'bg-green-100 text-green-700',
  PENDING_INDEX: 'bg-amber-100 text-amber-700',
  PENDING_APPROVAL: 'bg-blue-100 text-blue-700',
  FAILED: 'bg-red-100 text-red-700',
  EXPIRED: 'bg-zinc-100 text-zinc-500',
};
const STATUS_LABELS: Record<string, string> = {
  INDEXED: 'Indexed', PENDING_INDEX: 'Pending Index', PENDING_APPROVAL: 'Pending Approval', FAILED: 'Failed', EXPIRED: 'Expired',
};
const CATEGORY_LABELS: Record<string, string> = {
  COMPLIANCE: 'Compliance', PAST_PROJECT: 'Past Project', DESIGN_RULES: 'Design Rules',
  RESEARCH_TRENDS: 'Research & Trends', CLIENT_BRIEF: 'Client Brief', CHATBOT_LEARNING: 'Chatbot Learning', OTHER: 'Other',
};

function fmt(d: Date) {
  return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}
function isExpiringSoon(d: Date) {
  const diff = new Date(d).getTime() - Date.now();
  return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000;
}

export default function SourcesListClient({ sources, isAdmin }: { sources: Source[]; isAdmin: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [type, setType] = useState(sp.get('type') ?? 'ALL');
  const [category, setCategory] = useState(sp.get('category') ?? 'ALL');
  const [status, setStatus] = useState(sp.get('status') ?? 'ALL');
  const [expiringSoon, setExpiringSoon] = useState(sp.get('expiringSoon') === 'true');

  function applyFilter(key: string, val: string) {
    const params = new URLSearchParams(sp.toString());
    if (val === 'ALL' || val === 'false') params.delete(key);
    else params.set(key, val);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-zinc-900">Sources Library</h1>
        <Link href="/design/sources/new" className="px-3 py-1.5 bg-brand text-white text-sm font-medium rounded-md hover:bg-brand/90">
          Add Source
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select value={type} onChange={(e) => { setType(e.target.value); applyFilter('type', e.target.value); }}
          className="text-sm border border-zinc-200 rounded-md px-2 py-1.5">
          <option value="ALL">All Types</option>
          <option value="GLOBAL">Global</option>
          <option value="NON_GLOBAL">Non-Global</option>
        </select>
        <select value={category} onChange={(e) => { setCategory(e.target.value); applyFilter('category', e.target.value); }}
          className="text-sm border border-zinc-200 rounded-md px-2 py-1.5">
          <option value="ALL">All Categories</option>
          {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={status} onChange={(e) => { setStatus(e.target.value); applyFilter('status', e.target.value); }}
          className="text-sm border border-zinc-200 rounded-md px-2 py-1.5">
          <option value="ALL">All Statuses</option>
          <option value="INDEXED">Indexed</option>
          <option value="PENDING_INDEX">Pending Index</option>
          <option value="PENDING_APPROVAL">Pending Approval</option>
          <option value="FAILED">Failed</option>
          <option value="EXPIRED">Expired</option>
        </select>
        <label className="flex items-center gap-1.5 text-sm text-zinc-600 cursor-pointer">
          <input type="checkbox" checked={expiringSoon} onChange={(e) => { setExpiringSoon(e.target.checked); applyFilter('expiringSoon', String(e.target.checked)); }} />
          Expiring soon
        </label>
      </div>

      {/* Table */}
      {sources.length === 0 ? (
        <div className="text-center py-16 bg-white border border-zinc-200 rounded-lg">
          <p className="text-zinc-500 text-sm">No sources found. Add a source to get started.</p>
        </div>
      ) : (
        <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500">Title</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500">Type</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500">Category</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500">Status</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500">Expires</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500">v</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500">Submitted by</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {sources.map((s) => (
                <tr key={s.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-4 py-2.5">
                    <Link href={`/design/sources/${s.id}`} className="text-brand hover:underline font-medium">
                      {s.title}
                    </Link>
                    {!s.isActive && <span className="ml-2 text-xs text-zinc-400">(inactive)</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.type === 'GLOBAL' ? 'bg-purple-100 text-purple-700' : 'bg-zinc-100 text-zinc-600'}`}>
                      {s.type === 'GLOBAL' ? 'Global' : 'Non-Global'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-zinc-600">{CATEGORY_LABELS[s.category] ?? s.category}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[s.status] ?? 'bg-zinc-100 text-zinc-500'}`}>
                      {STATUS_LABELS[s.status] ?? s.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={isExpiringSoon(s.expiryDate) ? 'text-orange-500 font-medium' : 'text-zinc-500'}>
                      {isExpiringSoon(s.expiryDate) && '⚠ '}
                      {fmt(s.expiryDate)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-zinc-400 text-xs">v{s.versionNumber}</td>
                  <td className="px-4 py-2.5 text-zinc-500">{s.submittedBy.firstName} {s.submittedBy.lastName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
