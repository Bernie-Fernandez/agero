'use client';
import { useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { addTrendItemToSources, dismissTrendItem } from './actions';

type TrendItem = {
  id: string; title: string; sourceName: string; sourceType: string;
  url: string | null; excerpt: string | null; engagementScore: number | null;
  publishedAt: Date | null; fetchedAt: Date; status: string;
  rssFeed: { name: string } | null;
};

const SOURCE_TYPE_COLORS: Record<string, string> = {
  RSS: 'bg-blue-100 text-blue-700',
  MONITORED_URL: 'bg-purple-100 text-purple-700',
  MANUAL: 'bg-zinc-100 text-zinc-600',
};

function fmt(d: Date | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function TrendCard({ item }: { item: TrendItem }) {
  const [dismissed, setDismissed] = useState(false);
  const [added, setAdded] = useState(item.status === 'ADDED_TO_SOURCES');

  if (dismissed) return null;

  return (
    <div className="bg-white border border-zinc-200 rounded-lg p-4 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${SOURCE_TYPE_COLORS[item.sourceType] ?? 'bg-zinc-100 text-zinc-500'}`}>
            {item.sourceType}
          </span>
          {item.engagementScore && item.engagementScore > 100 && (
            <span className="text-[10px] text-amber-600 font-medium">🔥 {item.engagementScore}</span>
          )}
        </div>
        <span className="text-xs text-zinc-400 shrink-0">{fmt(item.publishedAt ?? item.fetchedAt)}</span>
      </div>
      <div>
        {item.url ? (
          <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-zinc-900 hover:text-brand line-clamp-2">
            {item.title}
          </a>
        ) : (
          <p className="text-sm font-medium text-zinc-900 line-clamp-2">{item.title}</p>
        )}
        <p className="text-xs text-zinc-400 mt-0.5">{item.rssFeed?.name ?? item.sourceName}</p>
      </div>
      {item.excerpt && (
        <p className="text-xs text-zinc-500 line-clamp-3">{item.excerpt}</p>
      )}
      <div className="flex gap-3 mt-1">
        {!added && (
          <form action={addTrendItemToSources.bind(null, item.id)} onSubmit={() => setAdded(true)}>
            <button className="text-xs text-brand font-medium hover:underline">Add to Sources</button>
          </form>
        )}
        {added && <span className="text-xs text-green-600 font-medium">Added to Sources</span>}
        <form action={dismissTrendItem.bind(null, item.id)} onSubmit={() => setDismissed(true)}>
          <button className="text-xs text-zinc-400 hover:text-zinc-600">Dismiss</button>
        </form>
      </div>
    </div>
  );
}

export default function TrendsClient({ items }: { items: TrendItem[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [sourceType, setSourceType] = useState(sp.get('sourceType') ?? 'ALL');
  const [showDismissed, setShowDismissed] = useState(sp.get('showDismissed') === 'true');

  function applyFilter(key: string, val: string) {
    const params = new URLSearchParams(sp.toString());
    if (!val || val === 'ALL' || val === 'false') params.delete(key);
    else params.set(key, val);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-zinc-900">Trend Intelligence Feed</h1>
        <Link href="/design/trends/submit" className="px-3 py-1.5 border border-zinc-200 text-zinc-700 text-sm font-medium rounded-md hover:bg-zinc-50">
          Submit Item
        </Link>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <select value={sourceType} onChange={(e) => { setSourceType(e.target.value); applyFilter('sourceType', e.target.value); }}
          className="text-sm border border-zinc-200 rounded-md px-2 py-1.5">
          <option value="ALL">All Sources</option>
          <option value="RSS">RSS</option>
          <option value="MONITORED_URL">Monitored URL</option>
          <option value="MANUAL">Manual</option>
        </select>
        <label className="flex items-center gap-1.5 text-sm text-zinc-600 cursor-pointer">
          <input type="checkbox" checked={showDismissed} onChange={(e) => { setShowDismissed(e.target.checked); applyFilter('showDismissed', String(e.target.checked)); }} />
          Show dismissed
        </label>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-16 bg-white border border-zinc-200 rounded-lg">
          <p className="text-zinc-500 text-sm">No trend items yet.</p>
          <p className="text-zinc-400 text-xs mt-1">Fetch RSS feeds in Settings, or submit a manual item.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => <TrendCard key={item.id} item={item} />)}
        </div>
      )}
    </div>
  );
}
