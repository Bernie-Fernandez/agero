import { requireFinanceAccess } from '@/lib/auth';
import { getCVRProject } from '@/lib/cvr/actions';
import CVRDetailClient from './CVRDetailClient';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function CVRDetailPage({ params }: { params: { projectId: string } }) {
  await requireFinanceAccess();
  const { projectId } = await params;
  const result = await getCVRProject(projectId);

  if (!result.ok || !result.data) {
    return (
      <div className="p-6">
        <Link href="/finance/cvr" className="text-sm text-zinc-500 hover:underline mb-4 inline-block">← Back to CVR</Link>
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {result.error ?? 'Failed to load project data.'}
        </div>
      </div>
    );
  }

  return <CVRDetailClient data={result.data} />;
}
