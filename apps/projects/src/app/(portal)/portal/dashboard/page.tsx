import { requirePortalSession } from '@/lib/portal/auth';
import { prisma } from '@/lib/prisma';
import PortalShell from '@/components/PortalShell';
import { prisma as safetyPrisma } from '@/lib/safety/prisma';
import Link from 'next/link';

export default async function PortalDashboardPage() {
  const session = await requirePortalSession();
  const { companyId, company } = session.portalUser;

  const [profile, projectCount] = await Promise.all([
    prisma.subcontractorProfile.findUnique({ where: { companyId } }),
    prisma.projectSubcontractor.count({ where: { companyId } }),
  ]);

  let workerCount = 0;
  try {
    workerCount = await safetyPrisma.worker.count({
      where: { employingOrganisation: { name: company.name } },
    });
  } catch {
    // Safety data not linked yet
  }

  const approvalStatus = profile?.approvalStatus ?? 'PENDING';
  const APPROVAL_COLORS: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-700',
    APPROVED: 'bg-green-100 text-green-700',
    SUSPENDED: 'bg-red-100 text-red-700',
    INACTIVE: 'bg-zinc-100 text-zinc-500',
  };

  return (
    <PortalShell companyName={company.name} userName={`${session.portalUser.firstName} ${session.portalUser.lastName}`}>
      <div className="p-8">
        <h1 className="text-2xl font-bold text-zinc-900 mb-1">Dashboard</h1>
        <p className="text-sm text-zinc-500 mb-6">{company.name}</p>

        {/* Status card */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-lg border border-zinc-200 p-5">
            <p className="text-xs font-medium text-zinc-500 mb-1">Approval Status</p>
            <span className={`text-sm font-semibold px-2.5 py-1 rounded-full ${APPROVAL_COLORS[approvalStatus] ?? 'bg-zinc-100 text-zinc-500'}`}>
              {approvalStatus.charAt(0) + approvalStatus.slice(1).toLowerCase()}
            </span>
          </div>
          <div className="bg-white rounded-lg border border-zinc-200 p-5">
            <p className="text-xs font-medium text-zinc-500 mb-1">Registered Workers</p>
            <p className="text-2xl font-bold text-zinc-900">{workerCount}</p>
            <Link href="/portal/workers" className="text-xs text-brand hover:underline mt-1 inline-block">Manage workers →</Link>
          </div>
          <div className="bg-white rounded-lg border border-zinc-200 p-5">
            <p className="text-xs font-medium text-zinc-500 mb-1">Projects Assigned</p>
            <p className="text-2xl font-bold text-zinc-900">{projectCount}</p>
          </div>
        </div>

        {/* Action items */}
        <div className="bg-white rounded-lg border border-zinc-200 p-5">
          <h2 className="text-sm font-semibold text-zinc-900 mb-3">Quick actions</h2>
          <div className="space-y-2">
            <Link href="/portal/workers" className="flex items-center gap-3 p-3 rounded-md hover:bg-zinc-50 transition-colors">
              <span className="w-8 h-8 rounded-md bg-brand/10 flex items-center justify-center text-brand text-sm">👷</span>
              <div>
                <p className="text-sm font-medium text-zinc-900">Add workers</p>
                <p className="text-xs text-zinc-500">Register your team so they can access Agero Safety sites</p>
              </div>
            </Link>
            <Link href="/portal/insurance" className="flex items-center gap-3 p-3 rounded-md hover:bg-zinc-50 transition-colors">
              <span className="w-8 h-8 rounded-md bg-blue-50 flex items-center justify-center text-blue-600 text-sm">📋</span>
              <div>
                <p className="text-sm font-medium text-zinc-900">Upload insurance</p>
                <p className="text-xs text-zinc-500">Keep your insurance certificates current</p>
              </div>
            </Link>
            <Link href="/portal/documents" className="flex items-center gap-3 p-3 rounded-md hover:bg-zinc-50 transition-colors">
              <span className="w-8 h-8 rounded-md bg-green-50 flex items-center justify-center text-green-600 text-sm">📁</span>
              <div>
                <p className="text-sm font-medium text-zinc-900">Company documents</p>
                <p className="text-xs text-zinc-500">WHS policy, SWMS, and compliance documents</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </PortalShell>
  );
}
