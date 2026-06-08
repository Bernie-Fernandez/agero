"use client";

import { useTransition, useState } from "react";

export function MobilisationDateForm({
  currentDate,
  submitAction,
  canEdit,
}: {
  currentDate: Date | null;
  submitAction: (formData: FormData) => Promise<{ error?: string }>;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  const formatted = currentDate?.toLocaleDateString("en-AU") ?? null;
  const isoDate = currentDate ? currentDate.toISOString().slice(0, 10) : "";

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await submitAction(fd);
      if (result.error) {
        setError(result.error);
      } else {
        setError(undefined);
        setEditing(false);
      }
    });
  }

  if (!editing) {
    return (
      <div className="flex items-center justify-between">
        <span className="text-zinc-500">Mobilisation date</span>
        <span className="flex items-center gap-2">
          <span
            className={`font-medium ${
              formatted
                ? "text-zinc-900 dark:text-zinc-50"
                : "text-amber-600 dark:text-amber-400"
            }`}
          >
            {formatted ?? "Not set"}
          </span>
          {canEdit && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
            >
              Edit
            </button>
          )}
        </span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-zinc-500">Mobilisation date</span>
        <div className="flex items-center gap-2">
          <input
            type="date"
            name="mobilisationDate"
            defaultValue={isoDate}
            className="rounded border border-zinc-300 px-2 py-0.5 text-xs dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
          />
          <button
            type="submit"
            disabled={isPending}
            className="rounded bg-blue-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending ? "…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => { setEditing(false); setError(undefined); }}
            className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            Cancel
          </button>
        </div>
      </div>
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </form>
  );
}
