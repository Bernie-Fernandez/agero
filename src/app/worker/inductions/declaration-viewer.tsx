"use client";

import { useState } from "react";

// ipAddress and timestamp are internal audit fields — not shown to workers
const DECLARATION_FIELDS: { key: string; label: string; block?: boolean }[] = [
  { key: "workerName",      label: "Worker name" },
  { key: "mobile",          label: "Mobile" },
  { key: "projectName",     label: "Project" },
  { key: "templateTitle",   label: "Template" },
  { key: "inductionVersion",label: "Version" },
  { key: "declarationText", label: "Declaration", block: true },
];

export function DeclarationViewer({
  signedAt,
  data,
}: {
  signedAt: string;
  data: Record<string, unknown>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
      >
        View declaration
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-900">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                Signed declaration
              </h3>
              <button
                onClick={() => setOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
              >
                ✕
              </button>
            </div>
            <p className="mt-1 text-xs text-zinc-500">
              Signed {new Date(signedAt).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" })}
            </p>
            <div className="mt-4 space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
              {DECLARATION_FIELDS.filter(({ key }) => key in data).map(({ key, label, block }) => (
                <div key={key} className={block ? "pt-1" : ""}>
                  <span className="font-medium">{label}:</span>{" "}
                  {block ? (
                    <p className="mt-1 whitespace-pre-wrap text-xs text-zinc-600 dark:text-zinc-400">
                      {String(data[key])}
                    </p>
                  ) : (
                    <span>{String(data[key])}</span>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={() => setOpen(false)}
              className="mt-5 w-full rounded-lg bg-zinc-900 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
