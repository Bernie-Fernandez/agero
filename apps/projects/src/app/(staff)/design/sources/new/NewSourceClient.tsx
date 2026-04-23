'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createSourceFromFile, createSourceFromUrl } from '../actions';

const CATEGORIES = [
  { value: 'COMPLIANCE', label: 'Compliance & Standards' },
  { value: 'PAST_PROJECT', label: 'Past Projects' },
  { value: 'DESIGN_RULES', label: 'Design Rules' },
  { value: 'RESEARCH_TRENDS', label: 'Research & Trends' },
  { value: 'CLIENT_BRIEF', label: 'Client Briefs' },
  { value: 'CHATBOT_LEARNING', label: 'Chatbot Learning' },
  { value: 'OTHER', label: 'Other' },
];
const INDUSTRY_TAGS = [
  { value: 'OFFICE', label: 'Office' }, { value: 'RETAIL', label: 'Retail' },
  { value: 'HOSPITALITY', label: 'Hospitality' }, { value: 'EDUCATION', label: 'Education' },
  { value: 'HEALTHCARE', label: 'Healthcare' }, { value: 'MIXED', label: 'Mixed' },
  { value: 'ALL', label: 'All' },
];

export default function NewSourceClient() {
  const router = useRouter();
  const [tab, setTab] = useState<'file' | 'url'>('file');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleFileSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await createSourceFromFile(fd);
        router.push('/design/sources');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create source');
      }
    });
  }

  function handleUrlSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await createSourceFromUrl(fd);
        router.push('/design/sources');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create source');
      }
    });
  }

  const commonFields = (
    <>
      <div>
        <label className="block text-xs font-medium text-zinc-700 mb-1">Title *</label>
        <input name="title" required className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-zinc-700 mb-1">Type</label>
          <select name="type" className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm">
            <option value="NON_GLOBAL">Non-Global</option>
            <option value="GLOBAL">Global</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-700 mb-1">Industry Tag</label>
          <select name="industryTag" className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm">
            {INDUSTRY_TAGS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-700 mb-1">Category *</label>
        <select name="category" required className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm">
          {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-700 mb-1">Notes</label>
        <textarea name="notes" rows={3} className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand resize-none" />
      </div>
    </>
  );

  return (
    <div className="p-6 max-w-xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-zinc-400 hover:text-zinc-700">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-xl font-bold text-zinc-900">Add Source</h1>
      </div>

      {/* Tab switcher */}
      <div className="flex border-b border-zinc-200 mb-6">
        {(['file', 'url'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === t ? 'border-brand text-brand' : 'border-transparent text-zinc-500 hover:text-zinc-800'}`}>
            {t === 'file' ? 'Upload File' : 'Add URL'}
          </button>
        ))}
      </div>

      {error && <p className="mb-4 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{error}</p>}

      {tab === 'file' ? (
        <form onSubmit={handleFileSubmit} className="space-y-4">
          {commonFields}
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">File (PDF or DOCX)</label>
            <input name="file" type="file" accept=".pdf,.docx" className="w-full text-sm text-zinc-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-zinc-100 file:text-zinc-700 hover:file:bg-zinc-200" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={pending} className="px-4 py-2 bg-brand text-white text-sm font-medium rounded-md hover:bg-brand/90 disabled:opacity-50">
              {pending ? 'Uploading…' : 'Add Source'}
            </button>
            <button type="button" onClick={() => router.back()} className="px-4 py-2 border border-zinc-200 text-zinc-700 text-sm font-medium rounded-md hover:bg-zinc-50">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleUrlSubmit} className="space-y-4">
          {commonFields}
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">URL *</label>
            <input name="url" type="url" required placeholder="https://" className="w-full border border-zinc-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand" />
            <p className="text-xs text-zinc-400 mt-1">Content will be fetched and stored as plain text.</p>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={pending} className="px-4 py-2 bg-brand text-white text-sm font-medium rounded-md hover:bg-brand/90 disabled:opacity-50">
              {pending ? 'Fetching…' : 'Add Source'}
            </button>
            <button type="button" onClick={() => router.back()} className="px-4 py-2 border border-zinc-200 text-zinc-700 text-sm font-medium rounded-md hover:bg-zinc-50">
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
