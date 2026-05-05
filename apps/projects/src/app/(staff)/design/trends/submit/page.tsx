'use client';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { submitTrendItem } from '../actions';

export default function SubmitTrendPage() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      await submitTrendItem(fd);
      router.push('/design/trends');
    });
  }

  return (
    <div className="p-6 max-w-lg">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-zinc-400 hover:text-zinc-700">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-xl font-bold text-zinc-900">Submit Trend Item</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-zinc-700 mb-1">Title *</label>
          <input name="title" required className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand" />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-700 mb-1">Source Name *</label>
          <input name="sourceName" required placeholder="e.g. LinkedIn, Dezeen, WorkTech" className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand" />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-700 mb-1">URL (optional)</label>
          <input name="url" type="url" placeholder="https://" className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand" />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-700 mb-1">Content / Notes</label>
          <textarea name="excerpt" rows={4} placeholder="Paste content, summary, or notes here" className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand resize-none" />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-700 mb-1">Date Published</label>
          <input name="publishedAt" type="date" className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm" />
        </div>
        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={pending} className="px-4 py-2 bg-brand text-white text-sm font-medium rounded-md hover:bg-brand/90 disabled:opacity-50">
            {pending ? 'Submitting…' : 'Submit'}
          </button>
          <button type="button" onClick={() => router.back()} className="px-4 py-2 border border-zinc-200 text-zinc-700 text-sm font-medium rounded-md hover:bg-zinc-50">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
