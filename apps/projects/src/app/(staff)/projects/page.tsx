import { prisma } from '@/lib/prisma';
import { requireAppUser } from '@/lib/auth';
import Link from 'next/link';
import AddProjectPanel from './AddProjectPanel';

const STATUS_LABELS: Record<string, string> = {
  PRECONSTRUCTION: 'Pre-construction',
  ACTIVE: 'Active',
  PRACTICAL_COMPLETION: 'Practical Completion',
  ON_HOLD: 'On Hold',
  COMPLETED: 'Completed',
};

const STATUS_COLORS: Record<string, string> = {
  PRECONSTRUCTION: 'bg-blue-100 text-blue-700',
  ACTIVE: 'bg-green-100 text-green-700',
  PRACTICAL_COMPLETION: 'bg-purple-100 text-purple-700',
  ON_HOLD: 'bg-amber-100 text-amber-700',
  COMPLETED: 'bg-zinc-100 text-zinc-600',
};

function formatDate(d: Date | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatCurrency(v: { toString(): string } | null | undefined) {
  if (!v) return '—';
  return `$${Number(v.toString()).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const user = await requireAppUser();
  const params = await searchParams;
  const q = params.q?.trim() ?? '';
  const statusFilter = params.status ?? '';

  const [projects, companies] = await Promise.all([
    prisma.project.findMany({
      where: {
        organisationId: user.organisationId,
        ...(statusFilter ? { status: statusFilter as never } : {}),
        ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
      },
      include: {
        client: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.company.findMany({
      where: { organisationId: user.organisationId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  const STATUS_FILTER_OPTIONS = ['', 'ACTIVE', 'ON_HOLD', 'COMPLETED'];

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Projects</h1>
          <p className="text-sm text-zinc-500 mt-1">{projects.length} project{projects.length !== 1 ? 's' : ''}</p>
        </div>
        <AddProjectPanel companies={companies} />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <form method="GET" className="flex-1 max-w-xs">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search projects…"
            className="w-full border border-zinc-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          />
          {statusFilter && <input type="hidden" name="status" value={statusFilter} />}
        </form>
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_FILTER_OPTIONS.map((s) => (
            <Link
              key={s || 'all'}
              href={`/projects?${new URLSearchParams({ ...(q ? { q } : {}), ...(s ? { status: s } : {}) }).toString()}`}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-zinc-900 text-white'
                  : 'bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50'
              }`}
            >
              {s ? STATUS_LABELS[s] : 'All'}
            </Link>
          ))}
        </div>
      </div>

      {/* Table */}
      {projects.length === 0 ? (
        <div className="text-center py-16 text-zinc-400">
          <p className="text-sm">No projects found.</p>
          {q && <p className="text-xs mt-1">Try clearing the search.</p>}
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50">
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Project Name</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Number</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Client</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Site Address</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Status</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Budget</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Start Date</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p, idx) => (
                <tr
                  key={p.id}
                  className={`${idx < projects.length - 1 ? 'border-b border-zinc-100' : ''} hover:bg-zinc-50 transition-colors cursor-pointer`}
                >
                  <td className="px-4 py-3">
                    <Link href={`/projects/${p.id}`} className="font-medium text-zinc-900 hover:text-brand">
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-zinc-500">{p.projectNumber || '—'}</td>
                  <td className="px-4 py-3 text-xs text-zinc-600">{p.client?.name || '—'}</td>
                  <td className="px-4 py-3 text-xs text-zinc-500 max-w-[180px] truncate">{p.siteAddress || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[p.status] ?? 'bg-zinc-100 text-zinc-600'}`}>
                      {STATUS_LABELS[p.status] ?? p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-600">{formatCurrency(p.contractValue)}</td>
                  <td className="px-4 py-3 text-xs text-zinc-500">{formatDate(p.startDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
