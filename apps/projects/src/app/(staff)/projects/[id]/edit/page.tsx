import { prisma } from '@/lib/prisma';
import { requireAppUser } from '@/lib/auth';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { updateProject } from '../../actions';

const STATUS_OPTIONS = [
  { value: 'PRECONSTRUCTION', label: 'Pre-construction' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'PRACTICAL_COMPLETION', label: 'Practical Completion' },
  { value: 'ON_HOLD', label: 'On Hold' },
  { value: 'COMPLETED', label: 'Completed' },
];

function toDateInputValue(d: Date | null | undefined) {
  if (!d) return '';
  return new Date(d).toISOString().split('T')[0];
}

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAppUser();
  const { id } = await params;

  const [project, companies] = await Promise.all([
    prisma.project.findUnique({ where: { id } }),
    prisma.company.findMany({
      where: { organisationId: user.organisationId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  if (!project) notFound();

  const updateProjectWithId = updateProject.bind(null, id);

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center gap-2 text-xs text-zinc-400 mb-4">
        <Link href="/projects" className="hover:text-zinc-600">Projects</Link>
        <span>/</span>
        <Link href={`/projects/${id}`} className="hover:text-zinc-600">{project.name}</Link>
        <span>/</span>
        <span className="text-zinc-600">Edit</span>
      </div>

      <h1 className="text-2xl font-bold text-zinc-900 mb-6">Edit Project</h1>

      <div className="bg-white rounded-lg border border-zinc-200 px-6 py-5">
        <form action={updateProjectWithId} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">
              Project Name <span className="text-red-500">*</span>
            </label>
            <input
              name="name"
              required
              defaultValue={project.name}
              className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Project Number</label>
            <input
              name="projectNumber"
              defaultValue={project.projectNumber ?? ''}
              className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Client</label>
            <select
              name="clientId"
              defaultValue={project.clientId ?? ''}
              className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            >
              <option value="">— Select client —</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Site Address</label>
            <input
              name="siteAddress"
              defaultValue={project.siteAddress ?? ''}
              className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Status</label>
            <select
              name="status"
              defaultValue={project.status}
              className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Budget Total ($)</label>
            <input
              name="contractValue"
              type="number"
              step="0.01"
              min="0"
              defaultValue={project.contractValue ? project.contractValue.toString() : ''}
              className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">Start Date</label>
              <input
                name="startDate"
                type="date"
                defaultValue={toDateInputValue(project.startDate)}
                className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">End Date</label>
              <input
                name="endDate"
                type="date"
                defaultValue={toDateInputValue(project.endDate)}
                className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-brand text-white text-sm font-medium rounded-md hover:opacity-90 transition-opacity"
            >
              Save Changes
            </button>
            <Link
              href={`/projects/${id}`}
              className="px-4 py-2 text-sm font-medium text-zinc-600 bg-white border border-zinc-300 rounded-md hover:bg-zinc-50 transition-colors"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
