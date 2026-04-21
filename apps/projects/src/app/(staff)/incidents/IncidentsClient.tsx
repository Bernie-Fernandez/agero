'use client';
import { useState } from 'react';
import SlidePanel from '@/components/SlidePanel';
import { showToast, ToastContainer } from '@/components/Toast';
import { createIncident } from './actions';

type Incident = {
  id: string;
  title: string;
  description: string | null;
  incidentDate: Date;
  location: string | null;
  severity: string;
  status: string;
  project: { id: string; name: string } | null;
  reportedBy: { firstName: string; lastName: string } | null;
  createdAt: Date;
};

type Project = { id: string; name: string };

const SEVERITY_COLORS: Record<string, string> = {
  LOW: 'bg-zinc-100 text-zinc-600',
  MEDIUM: 'bg-yellow-100 text-yellow-700',
  HIGH: 'bg-orange-100 text-orange-700',
  CRITICAL: 'bg-red-100 text-red-700',
};

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-red-100 text-red-700',
  UNDER_INVESTIGATION: 'bg-yellow-100 text-yellow-700',
  CLOSED: 'bg-green-100 text-green-700',
};

function fmt(d: Date) {
  return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function IncidentsClient({ initialData, projects }: { initialData: Incident[]; projects: Project[] }) {
  const [data, setData] = useState(initialData);
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');

  const filtered = data.filter((i) => {
    if (filterStatus && i.status !== filterStatus) return false;
    if (filterSeverity && i.severity !== filterSeverity) return false;
    if (search && !i.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="p-8">
      <ToastContainer />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Incidents</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{filtered.length} of {data.length} incidents</p>
        </div>
        <button onClick={() => setAddOpen(true)} className="inline-flex items-center px-4 py-2 bg-brand text-white text-sm font-medium rounded-md hover:opacity-90">
          + Report Incident
        </button>
      </div>

      <div className="flex gap-2 mb-4">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search incidents…"
          className="flex-1 px-3 py-1.5 border border-zinc-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="border border-zinc-200 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand">
          <option value="">All Status</option>
          {['OPEN', 'UNDER_INVESTIGATION', 'CLOSED'].map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
        <select value={filterSeverity} onChange={(e) => setFilterSeverity(e.target.value)} className="border border-zinc-200 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand">
          <option value="">All Severity</option>
          {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-zinc-400"><p className="text-sm">No incidents found.</p></div>
      ) : (
        <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50">
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Title</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Date</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Severity</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Status</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Project</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Location</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((i, idx) => (
                <tr key={i.id} className={`${idx < filtered.length - 1 ? 'border-b border-zinc-100' : ''} hover:bg-zinc-50`}>
                  <td className="px-4 py-3 font-medium text-zinc-900">{i.title}</td>
                  <td className="px-4 py-3 text-xs text-zinc-600">{fmt(i.incidentDate)}</td>
                  <td className="px-4 py-3 text-xs">
                    <span className={`px-2 py-0.5 rounded-full font-medium ${SEVERITY_COLORS[i.severity] ?? 'bg-zinc-100 text-zinc-600'}`}>{i.severity}</span>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <span className={`px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[i.status] ?? 'bg-zinc-100 text-zinc-600'}`}>{i.status.replace(/_/g, ' ')}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-600">{i.project?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-zinc-600">{i.location ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <SlidePanel isOpen={addOpen} onClose={() => setAddOpen(false)} title="Report Incident">
        <form action={async (fd) => {
          await createIncident(fd);
          setAddOpen(false);
          showToast('Incident reported');
        }} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Title <span className="text-red-500">*</span></label>
            <input name="title" required className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Incident Date <span className="text-red-500">*</span></label>
            <input name="incidentDate" type="date" required defaultValue={new Date().toISOString().split('T')[0]}
              className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Severity</label>
            <select name="severity" defaultValue="LOW" className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand">
              {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Project</label>
            <select name="projectId" defaultValue="" className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand">
              <option value="">— None —</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Location</label>
            <input name="location" className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Description</label>
            <textarea name="description" rows={4} className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" className="flex-1 px-4 py-2 bg-brand text-white text-sm font-medium rounded-md hover:opacity-90">Report</button>
            <button type="button" onClick={() => setAddOpen(false)} className="px-4 py-2 text-sm font-medium text-zinc-600 bg-white border border-zinc-300 rounded-md hover:bg-zinc-50">Cancel</button>
          </div>
        </form>
      </SlidePanel>
    </div>
  );
}
