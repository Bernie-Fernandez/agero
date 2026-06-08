import { requireDirector } from '@/lib/auth';
import { listBalanceSheetSnapshots } from './actions';
import BalanceSheetClient from './BalanceSheetClient';

export const dynamic = 'force-dynamic';

export default async function BalanceSheetPage() {
  await requireDirector();
  const snapshots = await listBalanceSheetSnapshots();

  return <BalanceSheetClient snapshots={snapshots} />;
}
