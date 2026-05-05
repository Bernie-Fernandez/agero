import { requireAppUser } from '@/lib/auth';
import { getDesignDashboard } from './actions';
import { addTrendItemToSources, dismissTrendItem } from './trends/actions';
import { renewSourceExpiry } from './sources/actions';
import Link from 'next/link';

function KpiCard({ label, value, amber }: { label: string; value: number; amber?: boolean }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-lg p-4">
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${amber && value > 0 ? 'text-amber-600' : 'text-zinc-900'}`}>{value}</p>
    </div>
  );
}

function fmt(d: Date | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default async function DesignHomePage() {
  await requireAppUser();
  const data = await getDesignDashboard();

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-zinc-900">Design Studio</h1>
        <p className="text-sm text-zinc-500 mt-0.5">AI-powered knowledge base and trend intelligence</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <KpiCard label="Total Sources" value={data.totalSources} />
        <KpiCard label="Active Global Settings" value={data.activeGlobalSettings} />
        <KpiCard label="Pending Approvals" value={data.pendingApprovals} amber />
        <KpiCard label="New Trends This Week" value={data.newTrendItemsThisWeek} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Recent Trend Items */}
        <div className="bg-white border border-zinc-200 rounded-lg">
          <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-800">Recent Trends</h2>
            <Link href="/design/trends" className="text-xs text-brand hover:underline">View all</Link>
          </div>
          {data.recentTrendItems.length === 0 ? (
            <p className="px-4 py-6 text-xs text-zinc-400 text-center">No trend items yet. Fetch RSS feeds in Settings.</p>
          ) : (
            <ul className="divide-y divide-zinc-50">
              {data.recentTrendItems.map((item) => (
                <li key={item.id} className="px-4 py-3">
                  <p className="text-sm font-medium text-zinc-800 truncate">{item.title}</p>
                  <p className="text-xs text-zinc-400 mt-0.5">{item.rssFeed?.name ?? item.sourceName} · {fmt(item.publishedAt ?? item.fetchedAt)}</p>
                  <div className="flex gap-2 mt-2">
                    <form action={addTrendItemToSources.bind(null, item.id)}>
                      <button className="text-xs text-brand hover:underline">Add to Sources</button>
                    </form>
                    <form action={dismissTrendItem.bind(null, item.id)}>
                      <button className="text-xs text-zinc-400 hover:text-zinc-600">Dismiss</button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Expiring Soon */}
        <div className="bg-white border border-zinc-200 rounded-lg">
          <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-800">Sources Expiring Soon</h2>
            <Link href="/design/sources?expiringSoon=true" className="text-xs text-brand hover:underline">View all</Link>
          </div>
          {data.expiringSoon.length === 0 ? (
            <p className="px-4 py-6 text-xs text-zinc-400 text-center">No sources expiring in the next 30 days.</p>
          ) : (
            <ul className="divide-y divide-zinc-50">
              {data.expiringSoon.map((s) => (
                <li key={s.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-zinc-800 truncate max-w-[200px]">{s.title}</p>
                    <p className="text-xs text-orange-500 mt-0.5">Expires {fmt(s.expiryDate)}</p>
                  </div>
                  <form action={renewSourceExpiry.bind(null, s.id)}>
                    <button className="text-xs text-brand hover:underline">Renew</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Quick Links */}
      <div className="flex gap-3 flex-wrap">
        <Link href="/design/sources/new" className="px-4 py-2 bg-brand text-white text-sm font-medium rounded-md hover:bg-brand/90 transition-colors">
          Add Source
        </Link>
        <Link href="/design/trends/submit" className="px-4 py-2 border border-zinc-200 text-zinc-700 text-sm font-medium rounded-md hover:bg-zinc-50 transition-colors">
          Submit Trend Item
        </Link>
        <Link href="/design/chatbot" className="px-4 py-2 border border-zinc-200 text-zinc-700 text-sm font-medium rounded-md hover:bg-zinc-50 transition-colors">
          Open Chatbot
        </Link>
        {data.pendingApprovals > 0 && (
          <Link href="/design/settings/approvals" className="px-4 py-2 border border-amber-200 text-amber-700 text-sm font-medium rounded-md hover:bg-amber-50 transition-colors">
            Review {data.pendingApprovals} Pending {data.pendingApprovals === 1 ? 'Approval' : 'Approvals'}
          </Link>
        )}
      </div>
    </div>
  );
}
