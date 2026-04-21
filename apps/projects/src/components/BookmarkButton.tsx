'use client';
import { useState, useTransition } from 'react';
import { addBookmark, removeBookmark } from '@/lib/bookmarks/actions';

export default function BookmarkButton({
  entityType,
  entityId,
  entityLabel,
  entityUrl,
  initialBookmarked,
}: {
  entityType: string;
  entityId: string;
  entityLabel: string;
  entityUrl: string;
  initialBookmarked: boolean;
}) {
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    setError(null);
    startTransition(async () => {
      if (bookmarked) {
        await removeBookmark(entityId);
        setBookmarked(false);
      } else {
        const res = await addBookmark(entityType, entityId, entityLabel, entityUrl);
        if (res.ok) {
          setBookmarked(true);
        } else {
          setError(res.error ?? 'Failed to bookmark');
        }
      }
    });
  }

  return (
    <div className="relative inline-flex items-center">
      <button
        onClick={toggle}
        disabled={isPending}
        title={bookmarked ? 'Remove bookmark' : 'Bookmark this'}
        className={`p-1.5 rounded-md transition-colors ${
          bookmarked ? 'text-brand' : 'text-zinc-400 hover:text-zinc-600'
        } disabled:opacity-50`}
      >
        <svg className="w-4 h-4" fill={bookmarked ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
        </svg>
      </button>
      {error && (
        <span className="absolute left-8 top-0 z-10 bg-white border border-red-200 text-red-700 text-xs px-2 py-1 rounded-md shadow whitespace-nowrap">{error}</span>
      )}
    </div>
  );
}
