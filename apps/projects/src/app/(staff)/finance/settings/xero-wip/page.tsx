import { requireDirector } from '@/lib/auth';
import { getXeroWipSettings } from '@/lib/month-end/actions';
import { XeroWipSettingsClient } from './XeroWipSettingsClient';

export const dynamic = 'force-dynamic';

export default async function XeroWipSettingsPage() {
  await requireDirector();
  const result = await getXeroWipSettings();

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <h1 className="text-xl font-semibold text-zinc-900 mb-1">Xero WIP Account Settings</h1>
      <p className="text-sm text-zinc-500 mb-6">
        Confirm account codes with your accountant before the first live journal post.
        Defaults are pre-populated from Agero&apos;s verified Xero chart of accounts (June 2026).
      </p>
      <XeroWipSettingsClient
        initial={result.settings ?? { openingWipAccountCode: '330', closingWipAccountCode: '370' }}
      />
    </div>
  );
}
