import { requireFinanceAccess } from '@/lib/auth';
import { getFYSettings, listBacklogBudget, getCATBannerData } from './actions';
import BacklogBudgetClient from './BacklogBudgetClient';
import { redirect } from 'next/navigation';

export const metadata = { title: 'Backlog Budget | Finance' };

export default async function BacklogBudgetPage() {
  const user = await requireFinanceAccess();

  const [settingsResult, bannerResult] = await Promise.all([
    getFYSettings(),
    getCATBannerData(),
  ]);

  if (!settingsResult.ok || !settingsResult.settings) {
    redirect('/finance/dashboard');
  }

  const settings = settingsResult.settings!;
  const mode = settingsResult.mode!;
  const fyYear = settings.currentFY;

  const listResult = await listBacklogBudget(fyYear);
  const rows = listResult.ok ? (listResult.rows ?? []) : [];

  return (
    <BacklogBudgetClient
      initialRows={rows}
      fySettings={settings}
      initialMode={mode}
      currentFY={fyYear}
      isDirector={user.role === 'DIRECTOR'}
      latestCatImportDate={bannerResult.ok ? (bannerResult.latestImportDate ?? null) : null}
    />
  );
}
