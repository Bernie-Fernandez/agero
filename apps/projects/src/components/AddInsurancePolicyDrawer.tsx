"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addInsurancePolicy } from "@/app/(staff)/crm/companies/actions";

interface PolicyType {
  id: string;
  name: string;
  isMandatory: boolean;
}

interface Props {
  companyId: string;
  policyTypes: PolicyType[];
}

export function AddInsurancePolicyDrawer({ companyId, policyTypes }: Props) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  function openDrawer() {
    setError(null);
    setOpen(true);
  }

  function closeDrawer() {
    if (isPending) return;
    setOpen(false);
    setError(null);
    formRef.current?.reset();
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await addInsurancePolicy(companyId, formData);
      if (result.ok) {
        closeDrawer();
        router.refresh();
      } else {
        setError(result.error ?? "Something went wrong.");
      }
    });
  }

  return (
    <>
      <button type="button" onClick={openDrawer} className="text-sm text-blue-600 hover:underline">
        + Add Policy
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/30 z-40" aria-hidden="true" onClick={closeDrawer} />
      )}

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Add Insurance Policy"
        className={`fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
          <h2 className="text-base font-semibold text-zinc-900">Add Insurance Policy</h2>
          <button
            type="button"
            onClick={closeDrawer}
            className="text-zinc-400 hover:text-zinc-700 text-2xl leading-none w-7 h-7 flex items-center justify-center"
          >
            ×
          </button>
        </div>

        <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">
                Policy Type <span className="text-red-500">*</span>
              </label>
              <select
                name="policyTypeId"
                required
                defaultValue=""
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="" disabled>— Select type —</option>
                {policyTypes.map((pt) => (
                  <option key={pt.id} value={pt.id}>
                    {pt.name}{pt.isMandatory ? " *" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Insurer</label>
                <input
                  name="insurerName"
                  autoComplete="off"
                  className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. QBE Insurance"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Policy Number</label>
                <input
                  name="policyNumber"
                  autoComplete="off"
                  className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">Coverage Amount ($)</label>
              <input
                name="coverageAmount"
                type="text"
                autoComplete="off"
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. 10000000"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Effective Date</label>
                <input
                  name="effectiveDate"
                  type="date"
                  className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">
                  Expiry Date <span className="text-red-500">*</span>
                </label>
                <input
                  name="expiryDate"
                  type="date"
                  required
                  className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">Certificate (optional)</label>
              <input
                name="certificate"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className="w-full text-xs text-zinc-600 file:mr-2 file:rounded file:border-0 file:bg-zinc-100 file:px-2 file:py-1 file:text-xs file:font-medium hover:file:bg-zinc-200"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">Notes</label>
              <textarea
                name="notes"
                rows={2}
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>

          <div className="px-5 py-4 border-t border-gray-200 flex gap-3 shrink-0">
            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isPending ? "Saving…" : "Save Policy"}
            </button>
            <button
              type="button"
              onClick={closeDrawer}
              disabled={isPending}
              className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
