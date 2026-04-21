'use client';
import { useState } from 'react';
import SlidePanel from '@/components/SlidePanel';
import { showToast, ToastContainer } from '@/components/Toast';
import { createPermit } from './actions';

type Permit = {
  id: string;
  permitType: string;
  title: string;
  description: string | null;
  startDate: Date;
  endDate: Date;
  status: string;
  project: { id: string; name: string } | null;
  issuedBy: { firstName: string; lastName: string } | null;
};

type Project = { id: string; name: string };

const PERMIT_TYPES = ['Hot Work', 'Confined Space', 'Working at Height', 'Excavation', 'Electrical Isolation', 'Pressure Test', 'Other'];

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  EXPIRED: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-zinc-100 text-zinc-500',
};

function fmt(d: Date) {
  return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function isExpired(endDate: Date) {
  return new Date(endDate) < new Date();
}

export default function PermitsClient({ initialData, projects }: { initialData: Permit[]; projects: Project[] }) {
  const [data] = useState(initialData);
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const filtered = data.filter((p) => {
    if (filterStatus === 'ACTIVE' && (p.status !== 'ACTIVE' || isExpired(p.endDate))) return false;
    if (filterStatus === 'EXPIRED' && !isExpired(p.endDate)) return false;
    if (filterStatus && filterStatus !== 'ACTIVE' && filterStatus !== 'EXPIRED' && p.status !== filterStatus) return false;
    if (search && !p.title.toLowerCase().includes(search.toLowerCase()) && !p.permitType.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="p-8">
      <ToastContainer />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Permits</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{filtered.length} of {data.length} permits</p>
        </div>
        <button onClick={() => setAddOpen(true)} className="inline-flex items-center px-4 py-2 bg-brand text-white text-sm font-medium rounded-md hover:opacity-90">
          + Issue Permit
        </button>
      </div>

      <div className="flex gap-2 mb-4">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search permits…"
          className="flex-1 px-3 py-1.5 border border-zinc-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="border border-zinc-200 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand">
          <option value="">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="EXPIRED">Expired</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-zinc-400"><p className="text-sm">No permits found.</p></div>
      ) : (
        <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50">
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Title</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Type</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Status</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Start</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Expires</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Project</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, idx) => {
                const expired = isExpired(p.endDate);
                const displayStatus = expired && p.status === 'ACTIVE' ? 'EXPIRED' : p.status;
                return (
                  <tr key={p.id} className={`${idx < filtered.length - 1 ? 'border-b border-zinc-100' : ''} hover:bg-zinc-50`}>
                    <td className="px-4 py-3 font-medium text-zinc-900">{p.title}</td>
                    <td className="px-4 py-3 text-xs text-zinc-600">{p.permitType}</td>
                    <td className="px-4 py-3 text-xs">
                      <span className={`px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[displayStatus] ?? 'bg-zinc-100 text-zinc-600'}`}>{displayStatus}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-600">{fmt(p.startDate)}</td>
                    <td className="px-4 py-3 text-xs text-zinc-600">{fmt(p.endDate)}</td>
                    <td className="px-4 py-3 text-xs text-zinc-600">{p.project?.name ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <SlidePanel isOpen={addOpen} onClose={() => setAddOpen(false)} title="Issue Permit">
        <form action={async (fd) => {
          await createPermit(fd);
          setAddOpen(false);
          showToast('Permit issued');
        }} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Title <span className="text-red-500">*</span></label>
            <input name="title" required className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Permit Type <span className="text-red-500">*</span></label>
            <select name="permitType" required className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand">
              {PERMIT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Project</label>
            <select name="projectId" defaultValue="" className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand">
              <option value="">— None —</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">Start Date <span className="text-red-500">*</span></label>
              <input name="startDate" type="date" required defaultValue={new Date().toISOString().split('T')[0]}
                className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">End Date <span className="text-red-500">*</span></label>
              <input name="endDate" type="date" required
                className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Description</label>
            <textarea name="description" rows={3} className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" className="flex-1 px-4 py-2 bg-brand text-white text-sm font-medium rounded-md hover:opacity-90">Issue Permit</button>
            <button type="button" onClick={() => setAddOpen(false)} className="px-4 py-2 text-sm font-medium text-zinc-600 bg-white border border-zinc-300 rounded-md hover:bg-zinc-50">Cancel</button>
          </div>
        </form>
      </SlidePanel>
    </div>
  );
}
