import { requirePortalSession } from '@/lib/portal/auth';
import { prisma } from '@/lib/prisma';
import PortalShell from '@/components/PortalShell';

function statusBadge(expiry: Date) {
  const now = new Date();
  const days = Math.floor((expiry.getTime() - now.getTime()) / 86400000);
  if (days < 0) return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">Expired</span>;
  if (days < 30) return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">Expiring soon</span>;
  return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">Current</span>;
}

export default async function PortalInsurancePage() {
  const session = await requirePortalSession();
  const { companyId, company } = session.portalUser;

  const policies = await prisma.insurancePolicy.findMany({
    where: { companyId, isCurrent: true },
    include: { policyType: { select: { name: true } } },
    orderBy: { expiryDate: 'asc' },
  });

  return (
    <PortalShell companyName={company.name} userName={`${session.portalUser.firstName} ${session.portalUser.lastName}`}>
      <div className="p-8">
        <h1 className="text-2xl font-bold text-zinc-900 mb-1">Insurance</h1>
        <p className="text-sm text-zinc-500 mb-6">Current insurance certificates for {company.name}</p>

        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
          To update or upload new insurance certificates, please contact your Agero safety manager directly.
        </div>

        {policies.length === 0 ? (
          <div className="bg-white rounded-lg border border-zinc-200 p-10 text-center">
            <p className="text-sm text-zinc-500">No insurance policies on record.</p>
            <p className="text-xs text-zinc-400 mt-1">Contact your Agero safety manager to add insurance details.</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Insurer</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Policy #</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Expiry</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Certificate</th>
                </tr>
              </thead>
              <tbody>
                {policies.map((p) => (
                  <tr key={p.id} className="border-b border-zinc-100 last:border-0">
                    <td className="px-4 py-3 font-medium text-zinc-900">{p.policyType.name}</td>
                    <td className="px-4 py-3 text-zinc-600">{p.insurerName ?? '—'}</td>
                    <td className="px-4 py-3 text-zinc-600 font-mono text-xs">{p.policyNumber ?? '—'}</td>
                    <td className="px-4 py-3 text-zinc-600">
                      {p.expiryDate.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3">{statusBadge(p.expiryDate)}</td>
                    <td className="px-4 py-3">
                      {p.certificateUrl ? (
                        <a href={p.certificateUrl} target="_blank" rel="noopener noreferrer" className="text-brand text-xs hover:underline">View PDF</a>
                      ) : (
                        <span className="text-xs text-zinc-400">Not uploaded</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PortalShell>
  );
}
