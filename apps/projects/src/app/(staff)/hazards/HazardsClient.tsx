'use client';
import { useState } from 'react';
import SlidePanel from '@/components/SlidePanel';
import { showToast, ToastContainer } from '@/components/Toast';
import { createHazard } from './actions';

type Hazard = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  controls: string | null;
  likelihoodPre: number | null;
  consequencePre: number | null;
  likelihoodPost: number | null;
  consequencePost: number | null;
  status: string;
  project: { id: string; name: string } | null;
  raisedBy: { firstName: string; lastName: string } | null;
  createdAt: Date;
};

type Project = { id: string; name: string };

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-red-100 text-red-700',
  CONTROLLED: 'bg-yellow-100 text-yellow-700',
  CLOSED: 'bg-green-100 text-green-700',
};

function riskScore(l: number | null, c: number | null) {
  if (!l || !c) return null;
  return l * c;
}

function riskColor(score: number | null) {
  if (score === null) return 'bg-zinc-100 text-zinc-500';
  if (score >= 15) return 'bg-red-100 text-red-700';
  if (score >= 8) return 'bg-orange-100 text-orange-700';
  if (score >= 4) return 'bg-yellow-100 text-yellow-700';
  return 'bg-green-100 text-green-700';
}

function riskLabel(score: number | null) {
  if (score === null) return '—';
  if (score >= 15) return `${score} (Extreme)`;
  if (score >= 8) return `${score} (High)`;
  if (score >= 4) return `${score} (Medium)`;
  return `${score} (Low)`;
}

function RiskMatrix({ value, onChange }: { value: [number, number] | null; onChange: (v: [number, number]) => void }) {
  const LIKELIHOOD = ['Rare', 'Unlikely', 'Possible', 'Likely', 'Almost Certain'];
  const CONSEQUENCE = ['Insignificant', 'Minor', 'Moderate', 'Major', 'Catastrophic'];

  function cellColor(l: number, c: number) {
    const s = l * c;
    if (s >= 15) return 'bg-red-400 hover:bg-red-500';
    if (s >= 8) return 'bg-orange-300 hover:bg-orange-400';
    if (s >= 4) return 'bg-yellow-200 hover:bg-yellow-300';
    return 'bg-green-200 hover:bg-green-300';
  }

  return (
    <div className="overflow-x-auto">
      <table className="text-[10px] border-collapse">
        <thead>
          <tr>
            <th className="w-16" />
            {CONSEQUENCE.map((c, ci) => (
              <th key={ci} className="px-1 py-0.5 text-center text-zinc-500 font-medium w-16">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {LIKELIHOOD.map((l, li) => (
            <tr key={li}>
              <td className="pr-2 py-0.5 text-right text-zinc-500 font-medium">{l}</td>
              {CONSEQUENCE.map((_, ci) => {
                const lv = li + 1;
                const cv = ci + 1;
                const selected = value?.[0] === lv && value?.[1] === cv;
                return (
                  <td key={ci} className="p-0.5">
                    <button type="button" onClick={() => onChange([lv, cv])}
                      className={`w-full h-6 rounded text-[9px] font-bold transition-colors ${cellColor(lv, cv)} ${selected ? 'ring-2 ring-brand ring-offset-1' : ''}`}>
                      {lv * cv}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function HazardsClient({ initialData, projects }: { initialData: Hazard[]; projects: Project[] }) {
  const [data] = useState(initialData);
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [preRisk, setPreRisk] = useState<[number, number] | null>(null);
  const [postRisk, setPostRisk] = useState<[number, number] | null>(null);

  const filtered = data.filter((h) => {
    if (filterStatus && h.status !== filterStatus) return false;
    if (search && !h.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="p-8">
      <ToastContainer />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Hazard Register</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{filtered.length} of {data.length} hazards</p>
        </div>
        <button onClick={() => setAddOpen(true)} className="inline-flex items-center px-4 py-2 bg-brand text-white text-sm font-medium rounded-md hover:opacity-90">
          + Add Hazard
        </button>
      </div>

      <div className="flex gap-2 mb-4">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search hazards…"
          className="flex-1 px-3 py-1.5 border border-zinc-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="border border-zinc-200 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand">
          <option value="">All Status</option>
          {['OPEN', 'CONTROLLED', 'CLOSED'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-zinc-400"><p className="text-sm">No hazards found.</p></div>
      ) : (
        <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50">
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Title</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Status</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Pre-Control Risk</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Post-Control Risk</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Project</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Location</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((h, idx) => {
                const prePre = riskScore(h.likelihoodPre, h.consequencePre);
                const prePost = riskScore(h.likelihoodPost, h.consequencePost);
                return (
                  <tr key={h.id} className={`${idx < filtered.length - 1 ? 'border-b border-zinc-100' : ''} hover:bg-zinc-50`}>
                    <td className="px-4 py-3 font-medium text-zinc-900">{h.title}</td>
                    <td className="px-4 py-3 text-xs">
                      <span className={`px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[h.status] ?? 'bg-zinc-100 text-zinc-600'}`}>{h.status}</span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span className={`px-2 py-0.5 rounded-full font-medium ${riskColor(prePre)}`}>{riskLabel(prePre)}</span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span className={`px-2 py-0.5 rounded-full font-medium ${riskColor(prePost)}`}>{riskLabel(prePost)}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-600">{h.project?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-zinc-600">{h.location ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <SlidePanel isOpen={addOpen} onClose={() => { setAddOpen(false); setPreRisk(null); setPostRisk(null); }} title="Add Hazard">
        <form action={async (fd) => {
          if (preRisk) { fd.set('likelihoodPre', String(preRisk[0])); fd.set('consequencePre', String(preRisk[1])); }
          if (postRisk) { fd.set('likelihoodPost', String(postRisk[0])); fd.set('consequencePost', String(postRisk[1])); }
          await createHazard(fd);
          setAddOpen(false);
          setPreRisk(null);
          setPostRisk(null);
          showToast('Hazard added');
        }} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Title <span className="text-red-500">*</span></label>
            <input name="title" required className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
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
            <textarea name="description" rows={3} className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-2">Pre-Control Risk (click cell to select)</label>
            <RiskMatrix value={preRisk} onChange={setPreRisk} />
            {preRisk && <p className="text-xs text-zinc-500 mt-1">Selected: L{preRisk[0]} × C{preRisk[1]} = {preRisk[0] * preRisk[1]}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-2">Post-Control Risk</label>
            <RiskMatrix value={postRisk} onChange={setPostRisk} />
            {postRisk && <p className="text-xs text-zinc-500 mt-1">Selected: L{postRisk[0]} × C{postRisk[1]} = {postRisk[0] * postRisk[1]}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Controls / Mitigation</label>
            <textarea name="controls" rows={3} className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" className="flex-1 px-4 py-2 bg-brand text-white text-sm font-medium rounded-md hover:opacity-90">Add Hazard</button>
            <button type="button" onClick={() => { setAddOpen(false); setPreRisk(null); setPostRisk(null); }} className="px-4 py-2 text-sm font-medium text-zinc-600 bg-white border border-zinc-300 rounded-md hover:bg-zinc-50">Cancel</button>
          </div>
        </form>
      </SlidePanel>
    </div>
  );
}
