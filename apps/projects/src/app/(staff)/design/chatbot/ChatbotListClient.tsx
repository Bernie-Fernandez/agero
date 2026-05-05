'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createChatbotSession } from './actions';

type Session = {
  id: string; title: string | null; summary: string | null; startedAt: Date; endedAt: Date | null;
  user: { firstName: string; lastName: string };
  source: { id: string; title: string } | null;
};

function fmt(d: Date) {
  return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function ChatbotListClient({ sessions }: { sessions: Session[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleNewSession() {
    startTransition(async () => {
      const id = await createChatbotSession();
      router.push(`/design/chatbot/${id}`);
    });
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-zinc-900">Design Studio Chatbot</h1>
        <button onClick={handleNewSession} disabled={pending}
          className="px-4 py-2 bg-brand text-white text-sm font-medium rounded-md hover:bg-brand/90 disabled:opacity-50">
          {pending ? 'Creating…' : 'New Session'}
        </button>
      </div>

      <p className="text-sm text-zinc-500 mb-6">
        Have structured conversations to build your proprietary design knowledge base. Each session is automatically saved as a source entry when you end the session.
      </p>

      {sessions.length === 0 ? (
        <div className="text-center py-16 bg-white border border-zinc-200 rounded-lg">
          <p className="text-zinc-500 text-sm">No sessions yet. Start a new session to begin.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sessions.map((s) => (
            <Link key={s.id} href={`/design/chatbot/${s.id}`}
              className="block bg-white border border-zinc-200 rounded-lg p-4 hover:bg-zinc-50 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-900 truncate">
                    {s.title ?? 'Untitled Session'}
                  </p>
                  {s.summary && <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{s.summary}</p>}
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-xs text-zinc-400">{s.user.firstName} {s.user.lastName} · {fmt(s.startedAt)}</span>
                    {s.endedAt ? (
                      <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Complete</span>
                    ) : (
                      <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Active</span>
                    )}
                    {s.source && (
                      <span className="text-xs text-zinc-400">→ Source saved</span>
                    )}
                  </div>
                </div>
                <svg className="w-4 h-4 text-zinc-300 shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
