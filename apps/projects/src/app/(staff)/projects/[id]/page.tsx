import { prisma } from '@/lib/prisma';
import { requireAppUser } from '@/lib/auth';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { TabNav } from '@/components/TabNav';
import SubcontractorsTab from './SubcontractorsTab';
import { ToastContainer } from '@/components/Toast';

const STATUS_LABELS: Record<string, string> = {
  PRECONSTRUCTION: 'Pre-construction', ACTIVE: 'Active', PRACTICAL_COMPLETION: 'Practical Completion',
  ON_HOLD: 'On Hold', COMPLETED: 'Completed', DEFECTS: 'Defects', CLOSED: 'Closed',
};
const STATUS_COLORS: Record<string, string> = {
  PRECONSTRUCTION: 'bg-blue-100 text-blue-700', ACTIVE: 'bg-green-100 text-green-700',
  PRACTICAL_COMPLETION: 'bg-purple-100 text-purple-700', ON_HOLD: 'bg-amber-100 text-amber-700',
  COMPLETED: 'bg-zinc-100 text-zinc-600', DEFECTS: 'bg-orange-100 text-orange-700', CLOSED: 'bg-zinc-100 text-zinc-500',
};

function formatDate(d: Date | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}
function formatCurrency(v: { toString(): string } | null | undefined) {
  if (!v) return '—';
  return `$${Number(v.toString()).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex py-2.5 border-b border-zinc-100 last:border-0">
      <span className="w-40 shrink-0 text-xs text-zinc-500">{label}</span>
      <span className="text-sm text-zinc-800">{value || '—'}</span>
    </div>
  );
}

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'subcontractors', label: 'Subcontractors' },
  { id: 'budget', label: 'Budget' },
];

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await requireAppUser();
  const { id } = await params;
  const { tab } = await searchParams;
  const activeTab = tab ?? 'overview';

  const [project, assignments, subcontractorCompanies] = await Promise.all([
    prisma.project.findUnique({
      where: { id },
      include: { client: { select: { id: true, name: true } } },
    }),
    prisma.projectSubcontractor.findMany({
      where: { projectId: id },
      include: { company: { select: { id: true, name: true } } },
      orderBy: { assignedAt: 'desc' },
    }),
    prisma.company.findMany({
      where: { organisationId: user.organisationId, types: { has: 'SUBCONTRACTOR' }, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  if (!project) notFound();

  return (
    <div className="p-8">
      <ToastContainer />

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 text-xs text-zinc-400 mb-1">
            <Link href="/projects" className="hover:text-zinc-600">Projects</Link>
            <span>/</span>
            <span className="text-zinc-600">{project.name}</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-zinc-900">{project.name}</h1>
            {project.projectNumber && (
              <span className="text-xs font-mono text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded">{project.projectNumber}</span>
            )}
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[project.status] ?? 'bg-zinc-100 text-zinc-600'}`}>
              {STATUS_LABELS[project.status] ?? project.status}
            </span>
          </div>
        </div>
        <Link href={`/projects/${id}/edit`}
          className="inline-flex items-center px-4 py-2 text-sm font-medium text-zinc-700 bg-white border border-zinc-300 rounded-md hover:bg-zinc-50 transition-colors">
          Edit
        </Link>
      </div>

      <TabNav tabs={TABS} baseHref={`/projects/${id}`} />

      {activeTab === 'overview' && (
        <div className="bg-white rounded-lg border border-zinc-200 px-6 py-4 max-w-2xl">
          <Row label="Project Name" value={project.name} />
          <Row label="Project Number" value={project.projectNumber} />
          <Row label="Client" value={project.client?.name} />
          <Row label="Site Address" value={project.siteAddress} />
          <Row label="Status" value={
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[project.status] ?? 'bg-zinc-100 text-zinc-600'}`}>
              {STATUS_LABELS[project.status] ?? project.status}
            </span>
          } />
          <Row label="Budget Total" value={formatCurrency(project.contractValue)} />
          <Row label="Start Date" value={formatDate(project.startDate)} />
          <Row label="End Date" value={formatDate(project.endDate)} />
        </div>
      )}

      {activeTab === 'subcontractors' && (
        <div className="max-w-3xl">
          <SubcontractorsTab
            projectId={id}
            assignments={assignments as never}
            availableCompanies={subcontractorCompanies}
          />
        </div>
      )}

      {activeTab === 'budget' && (
        <div className="bg-white rounded-lg border border-zinc-200 p-8 text-center max-w-2xl">
          <p className="text-sm text-zinc-500">Budget breakdown coming in a future sprint.</p>
        </div>
      )}
    </div>
  );
}
