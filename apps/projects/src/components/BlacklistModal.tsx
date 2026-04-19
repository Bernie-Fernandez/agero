"use client";

import { useState, useTransition } from "react";

interface Props {
  companyId: string;
  onBlacklist: (id: string, reason: string) => Promise<void>;
}

export function BlacklistButton({ companyId, onBlacklist }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) return;
    startTransition(async () => {
      await onBlacklist(companyId, reason);
      setOpen(false);
      setReason("");
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors"
      >
        Blacklist Company
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg border border-gray-200 shadow-xl p-6 w-full max-w-md mx-4">
            <h2 className="text-base font-semibold text-zinc-900 mb-1">Blacklist Company</h2>
            <p className="text-xs text-zinc-500 mb-4">
              A blacklisted company will be flagged as must-not-engage. You must provide a reason.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">
                  Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                  rows={3}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Reason for blacklisting…"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={isPending || !reason.trim()}
                  className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {isPending ? "Saving…" : "Confirm Blacklist"}
                </button>
                <button
                  type="button"
                  onClick={() => { setOpen(false); setReason(""); }}
                  className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
