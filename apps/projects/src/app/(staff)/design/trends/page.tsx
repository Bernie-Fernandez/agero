import { requireAppUser } from '@/lib/auth';
import { getTrendItems } from './actions';
import TrendsClient from './TrendsClient';

export default async function TrendsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const user = await requireAppUser();
  const sp = await searchParams;

  const items = await getTrendItems(user.organisationId, {
    sourceType: sp.sourceType,
    status: sp.status,
    showDismissed: sp.showDismissed === 'true',
  });

  return <TrendsClient items={items as never} />;
}
