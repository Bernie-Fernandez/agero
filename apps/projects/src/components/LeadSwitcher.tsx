'use client';
import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

type Lead = { id: string; leadNumber: string; title: string; pipelineStage: number };

const STAGE_LABELS: Record<number, string> = {
  3: 'Qualified', 4: 'Submission', 5: 'Awaiting Decision',
  6: 'Intent to Negotiate', 7: 'Won', 8: 'Lost',
  9: 'Withdrawn', 10: 'Unsuccessful', 11: 'Dead',
  12: 'Declined', 13: 'Sub Withdrawn',
};

export default function LeadSwitcher({ leads }: { leads: Lead[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const leadMatch = pathname.match(/^\/leads\/([^/]+)/);
  const currentId = leadMatch?.[1];
  const activeLead = leads.find((l) => l.id === currentId);

  function navigate(leadId: string) {
    setOpen(false);
    router.push(`/leads/${leadId}/dashboard`);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
      >
        <span className="hidden sm:inline text-zinc-400">Lead</span>
        <span className="hidden sm:inline text-zinc-300">|</span>
        <span className="font-medium truncate max-w-[160px]">
          {activeLead
            ? `${activeLead.leadNumber} ${activeLead.title}`
            : 'Select lead'}
        </span>
        <svg className="h-3 w-3 text-zinc-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-50 w-72 rounded-lg border border-zinc-200 bg-white shadow-lg py-1 max-h-64 overflow-y-auto">
            {leads.length === 0 ? (
              <p className="px-3 py-2 text-xs text-zinc-400">No active leads</p>
            ) : (
              leads.map((lead) => (
                <button
                  key={lead.id}
                  onClick={() => navigate(lead.id)}
                  className="flex w-full items-start gap-2 px-3 py-2 text-left text-xs hover:bg-zinc-50"
                >
                  <span className={`h-1.5 w-1.5 rounded-full shrink-0 mt-1 ${activeLead?.id === lead.id ? 'bg-brand' : 'bg-transparent'}`} />
                  <div className="min-w-0">
                    <p className="font-medium text-zinc-800 truncate">{lead.title}</p>
                    <p className="text-zinc-400">{lead.leadNumber} · {STAGE_LABELS[lead.pipelineStage] ?? `Stage ${lead.pipelineStage}`}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
