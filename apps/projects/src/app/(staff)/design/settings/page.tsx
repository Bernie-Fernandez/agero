import { requireAppUser } from '@/lib/auth';
import {
  getGlobalSettings, getNonGlobalSettings, getPendingProposals,
  getDesignExpiryConfig, getRssFeeds, getMonitoredUrls,
} from './actions';
import SettingsClient from './SettingsClient';

export default async function DesignSettingsPage() {
  const user = await requireAppUser();
  const isAdmin = user.role === 'DIRECTOR' || user.role === 'ADMINISTRATOR';

  const [globalSettings, nonGlobalSettings, proposals, expiryConfig, rssFeeds, monitoredUrls] = await Promise.all([
    isAdmin ? getGlobalSettings(user.organisationId) : [],
    getNonGlobalSettings(user.organisationId),
    isAdmin ? getPendingProposals(user.organisationId) : [],
    isAdmin ? getDesignExpiryConfig(user.organisationId) : null,
    isAdmin ? getRssFeeds(user.organisationId) : [],
    isAdmin ? getMonitoredUrls(user.organisationId) : [],
  ]);

  return (
    <SettingsClient
      globalSettings={globalSettings as never}
      nonGlobalSettings={nonGlobalSettings as never}
      proposals={proposals as never}
      expiryConfig={expiryConfig as never}
      rssFeeds={rssFeeds as never}
      monitoredUrls={monitoredUrls as never}
      isAdmin={isAdmin}
    />
  );
}
