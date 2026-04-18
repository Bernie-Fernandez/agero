"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

interface Tab {
  id: string;
  label: string;
}

export function TabNav({ tabs, baseHref }: { tabs: Tab[]; baseHref: string }) {
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") ?? tabs[0]?.id;

  return (
    <div className="flex gap-0 border-b border-gray-200 mb-6 overflow-x-auto">
      {tabs.map((tab) => (
        <Link
          key={tab.id}
          href={`${baseHref}?tab=${tab.id}`}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
            activeTab === tab.id
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-zinc-500 hover:text-zinc-800 hover:border-gray-300"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
