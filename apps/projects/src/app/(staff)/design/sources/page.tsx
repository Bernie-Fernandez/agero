import { requireAppUser } from '@/lib/auth';
import { getSources } from './actions';
import SourcesListClient from './SourcesListClient';

export default async function SourcesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const user = await requireAppUser();
  const sp = await searchParams;
  const isAdmin = user.role === 'DIRECTOR';

  const sources = await getSources(user.organisationId, {
    type: sp.type,
    category: sp.category,
    industryTag: sp.industryTag,
    status: sp.status,
    expiringSoon: sp.expiringSoon === 'true',
  });

  return <SourcesListClient sources={sources as never} isAdmin={isAdmin} />;
}
