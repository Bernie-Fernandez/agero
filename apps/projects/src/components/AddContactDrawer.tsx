"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createContactInline } from "@/app/(staff)/crm/companies/actions";

interface Props {
  companyId: string;
  associationLabels: Array<{ id: string; name: string }>;
  buttonLabel?: string;
  buttonClassName?: string;
}

export function AddContactDrawer({
  companyId,
  associationLabels,
  buttonLabel = "+ New Contact",
  buttonClassName = "text-xs text-blue-600 hover:underline",
}: Props) {
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
      const result = await createContactInline(companyId, formData);
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
      <button type="button" onClick={openDrawer} className={buttonClassName}>
        {buttonLabel}
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/30 z-40"
          aria-hidden="true"
          onClick={closeDrawer}
        />
      )}

      {/* Drawer */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Add Contact"
        className={`fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
          <h2 className="text-base font-semibold text-zinc-900">Add Contact</h2>
          <button
            type="button"
            onClick={closeDrawer}
            className="text-zinc-400 hover:text-zinc-700 text-2xl leading-none w-7 h-7 flex items-center justify-center"
          >
            ×
          </button>
        </div>

        {/* Form */}
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="flex flex-col flex-1 overflow-hidden"
        >
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Name */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  name="firstName"
                  required
                  autoComplete="off"
                  className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">
                  Last Name <span className="text-red-500">*</span>
                </label>
                <input
                  name="lastName"
                  required
                  autoComplete="off"
                  className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Job Title */}
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">Job Title / Position</label>
              <input
                name="jobTitle"
                autoComplete="off"
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. Project Manager"
              />
            </div>

            {/* Mobile */}
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">Mobile</label>
              <input
                name="mobile"
                type="tel"
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="+61 4XX XXX XXX"
              />
            </div>

            {/* Phone DDI */}
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">Phone (DDI)</label>
              <input
                name="phoneDdi"
                type="tel"
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">Email</label>
              <input
                name="email"
                type="email"
                className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Association Label */}
            {associationLabels.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Association Label</label>
                <select
                  name="associationLabelId"
                  defaultValue=""
                  className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— None —</option>
                  {associationLabels.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Flags */}
            <div className="space-y-2 pt-1">
              <p className="text-xs font-medium text-zinc-600">Flags</p>
              <label className="flex items-center gap-2 text-sm text-zinc-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  name="isAccountContact"
                  value="true"
                  className="rounded border-gray-300 text-blue-600"
                />
                Account Contact (ACC)
              </label>
              <label className="flex items-center gap-2 text-sm text-zinc-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  name="isEstimatingContact"
                  value="true"
                  className="rounded border-gray-300 text-blue-600"
                />
                Estimating Contact — receives tender invitations (EST)
              </label>
            </div>

            <p className="text-xs text-zinc-400 pt-1">
              At least one of email, mobile, or DDI is required.
            </p>
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-gray-200 flex gap-3 shrink-0">
            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isPending ? "Saving…" : "Save Contact"}
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
