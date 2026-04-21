'use client';
import { useState, useEffect } from 'react';
import { useProject } from '@/context/ProjectContext';
import SubcontractorsTab from './[id]/SubcontractorsTab';
import { ToastContainer } from '@/components/Toast';
import { getProjectAssignments } from './actions';

type Project = {
  id: string;
  name: string;
  projectNumber: string | null;
  status: string;
  contractValue: { toString(): string } | null;
  siteAddress: string | null;
  startDate: Date | null;
  endDate: Date | null;
  plannedStart: Date | null;
  plannedFinish: Date | null;
  practicalCompletion: Date | null;
  additionalDays: number | null;
  contractSignedDate: Date | null;
  retentionType: string | null;
  variationMarginPercent: { toString(): string } | null;
  projectBrief: string | null;
  buildingType: string | null;
  sizeM2: { toString(): string } | null;
  client: { id: string; name: string } | null;
  projectManager: { firstName: string; lastName: string } | null;
  siteManager: { firstName: string; lastName: string } | null;
  projectEstimator: { firstName: string; lastName: string } | null;
};

type Assignment = {
  id: string;
  company: { id: string; name: string };
  role: string | null;
  assignedAt: Date;
};

type Company = { id: string; name: string };

const STATUS_LABELS: Record<string, string> = {
  PRECONSTRUCTION: 'Pre-construction', ACTIVE: 'Active', PRACTICAL_COMPLETION: 'Practical Completion',
  ON_HOLD: 'On Hold', COMPLETED: 'Completed', DEFECTS: 'Defects', CLOSED: 'Closed',
};
const STATUS_COLORS: Record<string, string> = {
  PRECONSTRUCTION: 'bg-blue-100 text-blue-700', ACTIVE: 'bg-green-100 text-green-700',
  PRACTICAL_COMPLETION: 'bg-purple-100 text-purple-700', ON_HOLD: 'bg-amber-100 text-amber-700',
  COMPLETED: 'bg-zinc-100 text-zinc-600', DEFECTS: 'bg-orange-100 text-orange-700', CLOSED: 'bg-zinc-100 text-zinc-500',
};

function fmt(d: Date | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtCurrency(v: { toString(): string } | null | undefined) {
  if (!v) return '—';
  return `$${Number(v.toString()).toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex py-2 border-b border-zinc-100 last:border-0">
      <span className="w-44 shrink-0 text-xs text-zinc-500">{label}</span>
      <span className="text-sm text-zinc-800">{value ?? '—'}</span>
    </div>
  );
}

const TABS = ['Overview', 'Subcontractors', 'Budget'];

export default function ProjectFoundationsClient({
  projects,
  subcontractorCompanies,
}: {
  projects: Project[];
  subcontractorCompanies: Company[];
}) {
  const { activeProject } = useProject();
  const [activeTab, setActiveTab] = useState('Overview');
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  const p = activeProject ? projects.find((proj) => proj.id === activeProject.id) ?? null : null;

  useEffect(() => {
    setActiveTab('Overview');
    setAssignments([]);
    if (p?.id) {
      getProjectAssignments(p.id).then((data) => setAssignments(data as never));
    }
  }, [p?.id]);

  if (!p) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-48px)] bg-zinc-50">
        <div className="text-center">
          <p className="text-zinc-500 text-sm font-medium">Select a project from the top bar to get started.</p>
          <p className="text-zinc-400 text-xs mt-1">Use the Project pill in the top navigation to switch projects.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-48px)]">
      <ToastContainer />

      {/* Upper info panel */}
      <div className="border-b border-zinc-200 bg-white overflow-y-auto" style={{ maxHeight: '50%' }}>
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-zinc-900">{p.name}</h1>
              {p.projectNumber && (
                <span className="text-xs font-mono text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded">{p.projectNumber}</span>
              )}
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[p.status] ?? 'bg-zinc-100 text-zinc-600'}`}>
                {STATUS_LABELS[p.status] ?? p.status}
              </span>
            </div>
            {p.client && (
              <p className="text-xs text-zinc-400 mt-0.5">Client: {p.client.name}</p>
            )}
          </div>
        </div>

        <div className="px-6 py-3 grid grid-cols-2 gap-x-12">
          <div>
            <InfoRow label="Site Address" value={p.siteAddress} />
            <InfoRow label="Building Type" value={p.buildingType} />
            <InfoRow label="Size (m²)" value={p.sizeM2 ? `${Number(p.sizeM2.toString()).toLocaleString()} m²` : null} />
            <InfoRow label="Contract Value" value={fmtCurrency(p.contractValue)} />
            <InfoRow label="Variation Margin" value={p.variationMarginPercent ? `${p.variationMarginPercent.toString()}%` : null} />
            <InfoRow label="Retention Type" value={p.retentionType} />
            <InfoRow label="Contract Signed" value={fmt(p.contractSignedDate)} />
          </div>
          <div>
            <InfoRow label="Planned Start" value={fmt(p.plannedStart ?? p.startDate)} />
            <InfoRow label="Planned Finish" value={fmt(p.plannedFinish ?? p.endDate)} />
            <InfoRow label="Practical Completion" value={fmt(p.practicalCompletion)} />
            <InfoRow label="Additional Days" value={p.additionalDays != null ? String(p.additionalDays) : null} />
            <InfoRow label="Project Manager" value={p.projectManager ? `${p.projectManager.firstName} ${p.projectManager.lastName}` : null} />
            <InfoRow label="Site Manager" value={p.siteManager ? `${p.siteManager.firstName} ${p.siteManager.lastName}` : null} />
            <InfoRow label="Estimator" value={p.projectEstimator ? `${p.projectEstimator.firstName} ${p.projectEstimator.lastName}` : null} />
          </div>
        </div>

        {p.projectBrief && (
          <div className="px-6 pb-4">
            <p className="text-xs text-zinc-500 mb-1">Project Brief</p>
            <p className="text-sm text-zinc-700 whitespace-pre-wrap">{p.projectBrief}</p>
          </div>
        )}
      </div>

      {/* Lower tabbed panel */}
      <div className="flex-1 flex flex-col overflow-hidden bg-white">
        <div className="flex border-b border-zinc-200 px-6">
          {TABS.map((t) => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === t ? 'border-brand text-brand' : 'border-transparent text-zinc-500 hover:text-zinc-800'}`}>
              {t}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'Overview' && (
            <div className="max-w-xl">
              <p className="text-sm text-zinc-500">All project details shown above. Use tabs for related records.</p>
            </div>
          )}

          {activeTab === 'Subcontractors' && (
            <SubcontractorsTab
              projectId={p.id}
              assignments={assignments as never}
              availableCompanies={subcontractorCompanies}
            />
          )}

          {activeTab === 'Budget' && (
            <div className="text-center py-12">
              <p className="text-sm text-zinc-500">Budget breakdown coming in a future sprint.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
