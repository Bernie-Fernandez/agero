"use client";

import { useState, useTransition } from "react";

interface Props {
  companyId: string;
  companyName: string;
  onDelete: (id: string) => Promise<void>;
}

export function DeleteCompanyModal({ companyId, companyName, onDelete }: Props) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [isPending, startTransition] = useTransition();
  const matches = typed === companyName;

  function handleDelete() {
    if (!matches) return;
    startTransition(async () => {
      await onDelete(companyId);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-md hover:bg-red-50 transition-colors"
      >
        Delete Company
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-zinc-900 mb-2">Delete Company</h2>
            <p className="text-sm text-zinc-600 mb-4">
              This will permanently delete <strong>{companyName}</strong> and all associated records.
              Contacts with no other company links will also be deleted.
            </p>
            <p className="text-sm text-zinc-600 mb-2">
              Type <span className="font-mono font-medium text-zinc-800">{companyName}</span> to confirm:
            </p>
            <input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder={companyName}
              autoFocus
            />
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => { setOpen(false); setTyped(""); }}
                disabled={isPending}
                className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={!matches || isPending}
                className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {isPending ? "Deleting…" : "Delete Permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
