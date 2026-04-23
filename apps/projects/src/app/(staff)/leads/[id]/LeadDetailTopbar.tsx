'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

type Estimate = {
  id: string;
  leadNumber: string;
  title: string;
  status: string;
  client: { name: string } | null;
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-zinc-100 text-zinc-600',
  ACTIVE: 'bg-blue-100 text-blue-700',
  CONVERTED: 'bg-green-100 text-green-700',
  ARCHIVED: 'bg-amber-100 text-amber-700',
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft', ACTIVE: 'Active', CONVERTED: 'Converted', ARCHIVED: 'Archived',
};

const TABS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'cost-plan', label: 'Cost Plan' },
  { key: 'analysis', label: 'Analysis' },
  { key: 'options', label: 'Options & R&O' },
  { key: 'lockaway', label: 'Lockaway' },
  { key: 'insights', label: 'Insights' },
  { key: 'scope-library', label: 'Scope Library' },
  { key: 'trade-letting', label: 'Trade Letting' },
  { key: 'reports', label: 'Reports' },
  { key: 'settings', label: 'Settings' },
];

export default function LeadDetailTopbar({ estimate }: { estimate: Estimate }) {
  const pathname = usePathname();

  function isActive(key: string) {
    return pathname.includes(`/leads/${estimate.id}/${key}`);
  }

  return (
    <div className="border-b border-zinc-200 bg-white">
      {/* Header row */}
      <div className="flex items-center gap-4 px-6 py-3">
        <Link href="/leads" className="text-zinc-400 hover:text-zinc-600 text-sm">
          ← Leads
        </Link>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className="font-mono text-xs text-zinc-500 shrink-0">{estimate.leadNumber}</span>
          <h1 className="font-semibold text-zinc-900 text-sm truncate">{estimate.title}</h1>
          {estimate.client && (
            <span className="text-zinc-400 text-sm truncate shrink-0">{estimate.client.name}</span>
          )}
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${STATUS_COLORS[estimate.status] ?? 'bg-zinc-100 text-zinc-600'}`}>
            {STATUS_LABELS[estimate.status] ?? estimate.status}
          </span>
        </div>
      </div>

      {/* Tab row */}
      <div className="flex items-center gap-0 px-4 overflow-x-auto">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={`/leads/${estimate.id}/${tab.key}`}
            className={`px-4 py-2 text-sm whitespace-nowrap border-b-2 transition-colors ${
              isActive(tab.key)
                ? 'border-brand text-brand font-medium'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 hover:border-zinc-300'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
