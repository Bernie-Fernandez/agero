import { requireFinanceAccess } from '@/lib/auth';
import { getAdminFYSettings } from './actions';
import FYSettingsClient from './FYSettingsClient';

export const metadata = { title: 'Financial Year Settings | Admin' };

export default async function FYSettingsPage() {
  const user = await requireFinanceAccess();
  const result = await getAdminFYSettings();
  const settings = result.ok ? result.settings! : {
    id: '', currentFY: 'FY27', draftOpenMonth: 4, draftOpenDay: 1, lockOpenMonth: 7, lockOpenDay: 1,
  };

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-zinc-900">Financial Year Settings</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Configure the EOFY window dates and current financial year for the Backlog Budget module.
        </p>
      </div>
      <FYSettingsClient settings={settings} isDirector={user.role === 'DIRECTOR'} />
    </div>
  );
}
