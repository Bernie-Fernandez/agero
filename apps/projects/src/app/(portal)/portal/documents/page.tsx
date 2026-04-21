import { requirePortalSession } from '@/lib/portal/auth';
import { prisma } from '@/lib/prisma';
import PortalShell from '@/components/PortalShell';

const TYPE_LABELS: Record<string, string> = {
  WHS_POLICY: 'WHS Policy',
  SWMS: 'SWMS',
  SAFE_WORK_METHOD: 'Safe Work Method',
  JSA: 'JSA',
  INDUCTION: 'Induction',
  LICENSE: 'License',
  CERTIFICATE: 'Certificate',
  OTHER: 'Other',
};

function fileSize(bytes: number | null) {
  if (!bytes) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function PortalDocumentsPage() {
  const session = await requirePortalSession();
  const { companyId, company } = session.portalUser;

  const documents = await prisma.companyDocument.findMany({
    where: { companyId },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <PortalShell companyName={company.name} userName={`${session.portalUser.firstName} ${session.portalUser.lastName}`}>
      <div className="p-8">
        <h1 className="text-2xl font-bold text-zinc-900 mb-1">Documents</h1>
        <p className="text-sm text-zinc-500 mb-6">Company compliance documents for {company.name}</p>

        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
          To upload new documents (WHS policy, SWMS, licences), please contact your Agero safety manager directly.
        </div>

        {documents.length === 0 ? (
          <div className="bg-white rounded-lg border border-zinc-200 p-10 text-center">
            <p className="text-sm text-zinc-500">No documents on record.</p>
            <p className="text-xs text-zinc-400 mt-1">Contact your Agero safety manager to add compliance documents.</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Document</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Size</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Expiry</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Uploaded</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide"></th>
                </tr>
              </thead>
              <tbody>
                {documents.map((d) => (
                  <tr key={d.id} className="border-b border-zinc-100 last:border-0">
                    <td className="px-4 py-3 font-medium text-zinc-900">{d.documentName}</td>
                    <td className="px-4 py-3 text-zinc-600">{TYPE_LABELS[d.documentType] ?? d.documentType}</td>
                    <td className="px-4 py-3 text-zinc-500 text-xs">{fileSize(d.fileSizeBytes) ?? '—'}</td>
                    <td className="px-4 py-3 text-zinc-600">
                      {d.expiryDate
                        ? d.expiryDate.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-zinc-500 text-xs">
                      {d.createdAt.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={d.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand text-xs hover:underline"
                      >
                        View
                      </a>
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
