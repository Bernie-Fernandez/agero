"use client";

import React, { useRef, useState, useTransition, useActionState } from "react";
import { addWorkerCredential, deleteWorkerCredential } from "./actions";
import type { AddCredentialState } from "./actions";
import {
  CREDENTIAL_TYPE_GROUPS,
  DEFAULT_CREDENTIAL_CONFIG,
} from "@/lib/credential-config";
import type { CredentialConfigData } from "@/lib/credential-config";

// ── Types ──────────────────────────────────────────────────────────────────────

export type CredDoc = {
  id: string;
  docType: string;
  credentialNumber: string | null;
  issuingBody: string | null;
  issueDate: Date | null;
  expiryDate: Date | null;
  aiExtractedExpiry: boolean;
  url: string;
  createdAt: Date;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function labelFor(docType: string): string {
  for (const group of CREDENTIAL_TYPE_GROUPS) {
    const found = group.types.find((t) => t.value === docType);
    if (found) return found.label;
  }
  return docType.replace(/_/g, " ");
}

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-AU");
}

function expiryColour(d: Date | null, config: CredentialConfigData): string {
  if (!d) return "text-zinc-400";
  const days = (d.getTime() - Date.now()) / 86400000;
  if (days < 0) return "text-red-600 dark:text-red-400";
  if (days < config.expiryUrgentDays) return "text-red-600 dark:text-red-400";
  if (days < config.expiryWarnDays) return "text-amber-600 dark:text-amber-400";
  return "text-green-600 dark:text-green-400";
}

// Convert DD/MM/YYYY → YYYY-MM-DD for date inputs
function toInputDate(dd: string | null): string {
  if (!dd) return "";
  const parts = dd.split("/");
  if (parts.length === 3)
    return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dd)) return dd;
  return "";
}

const inputCls =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100";

// ── AI extraction result ──────────────────────────────────────────────────────

type Extracted = {
  credentialNumber: string | null;
  issuingBody: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  holderName: string | null;
};

// ── Single credential add panel ───────────────────────────────────────────────

function AddCredentialPanel({
  docType,
  expiryRequired,
  onClose,
}: {
  docType: string;
  expiryRequired: boolean;
  onClose: () => void;
}) {
  type Phase = "photo" | "extracting" | "form" | "error";
  const [phase, setPhase] = useState<Phase>("photo");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<Extracted | null>(null);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [, startTransition] = useTransition();

  const boundAdd = addWorkerCredential.bind(null, docType, photoUrl ?? "");
  const [saveState, saveAction, saving] = useActionState<AddCredentialState, FormData>(
    boundAdd,
    {},
  );

  if (saveState.id) {
    onClose();
    return null;
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhase("extracting");
    const fd = new FormData();
    fd.append("photo", file);
    fd.append("docType", docType);
    startTransition(async () => {
      const res = await fetch("/api/worker/extract-credential", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        setUploadErr("Upload failed. Try again.");
        setPhase("error");
        return;
      }
      const data = (await res.json()) as {
        photoUrl: string;
        extraction: Extracted;
        error?: string;
      };
      if (data.error) {
        setUploadErr(data.error);
        setPhase("error");
        return;
      }
      setPhotoUrl(data.photoUrl);
      setExtracted(data.extraction);
      setPhase("form");
    });
    e.target.value = "";
  }

  return (
    <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Add {labelFor(docType)}
        </p>
        <button type="button" onClick={onClose} className="text-xs text-zinc-400 hover:text-zinc-600">
          Cancel
        </button>
      </div>

      {phase === "photo" && (
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            className="hidden"
            onChange={handleFile}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-zinc-300 px-4 py-6 text-sm text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 dark:border-zinc-600 dark:hover:border-zinc-500"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.04l-.821 1.316z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z"
              />
            </svg>
            Take photo or upload image
          </button>
          <p className="mt-2 text-xs text-zinc-400">
            AI will extract details automatically from your photo.
          </p>
        </div>
      )}

      {phase === "extracting" && (
        <div className="flex items-center gap-2 py-4 text-sm text-zinc-500">
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          Uploading and extracting details…
        </div>
      )}

      {phase === "error" && (
        <div>
          <p className="text-sm text-red-600 dark:text-red-400">{uploadErr}</p>
          <button
            type="button"
            onClick={() => setPhase("photo")}
            className="mt-2 text-xs text-zinc-500 underline"
          >
            Try again
          </button>
        </div>
      )}

      {phase === "form" && (
        <form action={saveAction} className="space-y-3">
          {photoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl}
              alt="Credential photo"
              className="h-28 w-auto rounded border border-zinc-200 object-contain dark:border-zinc-700"
            />
          )}

          {extracted?.holderName && (
            <p className="text-xs text-zinc-500">
              Detected name: <span className="font-medium">{extracted.holderName}</span>
            </p>
          )}

          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">
              Licence / certificate number
            </label>
            <input
              type="text"
              name="credentialNumber"
              defaultValue={extracted?.credentialNumber ?? ""}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">
              Issuing authority
            </label>
            <input
              type="text"
              name="issuingBody"
              defaultValue={extracted?.issuingBody ?? ""}
              className={inputCls}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Issue date</label>
              <input
                type="date"
                name="issueDate"
                defaultValue={toInputDate(extracted?.issueDate ?? null)}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">
                Expiry date
                {expiryRequired && (
                  <span className="ml-1 text-red-500">*</span>
                )}
              </label>
              <input
                type="date"
                name="expiryDate"
                required={expiryRequired}
                defaultValue={toInputDate(extracted?.expiryDate ?? null)}
                className={inputCls}
              />
            </div>
          </div>

          {saveState.error && (
            <p className="text-sm text-red-600 dark:text-red-400">{saveState.error}</p>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// ── Credential group ───────────────────────────────────────────────────────────

function CredentialGroup({
  title,
  types,
  docs,
  note,
  config,
}: {
  title: string;
  types: ReadonlyArray<{ value: string; label: string }>;
  docs: CredDoc[];
  note?: React.ReactNode;
  config: CredentialConfigData;
}) {
  const [addingType, setAddingType] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const grouped = types.reduce<Record<string, CredDoc[]>>((acc, t) => {
    acc[t.value] = docs.filter((d) => d.docType === t.value);
    return acc;
  }, {});

  async function handleDelete(id: string) {
    setDeletingId(id);
    await deleteWorkerCredential(id);
    setDeletingId(null);
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">{title}</h2>
        {note && <div className="mt-0.5">{note}</div>}
      </div>

      {types.map((t) => {
        const typeDocs = grouped[t.value] ?? [];
        const isAdding = addingType === t.value;
        const expiryRequired = config.expiryRequiredTypes.includes(t.value);

        return (
          <div key={t.value}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{t.label}</p>
                {expiryRequired && (
                  <span className="rounded-full bg-zinc-100 px-1.5 py-px text-[10px] text-zinc-400 dark:bg-zinc-800">
                    expiry required
                  </span>
                )}
              </div>
              {!isAdding && (
                <button
                  type="button"
                  onClick={() => setAddingType(t.value)}
                  className="text-xs text-zinc-500 underline hover:text-zinc-700 dark:hover:text-zinc-300"
                >
                  + Add
                </button>
              )}
            </div>

            {typeDocs.length === 0 && !isAdding && (
              <p className="text-xs text-zinc-400 dark:text-zinc-500 pl-1">None on file</p>
            )}

            {typeDocs.length > 0 && (
              <div className="space-y-2">
                {typeDocs.map((doc) => {
                  const missingRequiredExpiry =
                    expiryRequired && !doc.expiryDate;
                  return (
                    <div
                      key={doc.id}
                      className={`flex items-start justify-between rounded-lg border px-3 py-2.5 ${
                        missingRequiredExpiry
                          ? "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20"
                          : "border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900"
                      }`}
                    >
                      <div className="space-y-0.5">
                        {doc.credentialNumber && (
                          <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200">
                            {doc.credentialNumber}
                          </p>
                        )}
                        {doc.issuingBody && (
                          <p className="text-xs text-zinc-500">{doc.issuingBody}</p>
                        )}
                        <div className="flex gap-3 text-xs">
                          {doc.issueDate && (
                            <span className="text-zinc-400">
                              Issued {fmtDate(doc.issueDate)}
                            </span>
                          )}
                          {doc.expiryDate ? (
                            <span className={expiryColour(doc.expiryDate, config)}>
                              {doc.aiExtractedExpiry ? "AI · " : ""}
                              Expires {fmtDate(doc.expiryDate)}
                            </span>
                          ) : missingRequiredExpiry ? (
                            <span className="text-amber-600 dark:text-amber-400">
                              Expiry date required
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        {doc.url && (
                          <a
                            href={doc.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-zinc-400 hover:text-zinc-600"
                          >
                            View
                          </a>
                        )}
                        <button
                          type="button"
                          disabled={deletingId === doc.id}
                          onClick={() => handleDelete(doc.id)}
                          className="text-xs text-red-400 hover:text-red-600 disabled:opacity-50"
                          aria-label="Delete"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {isAdding && (
              <AddCredentialPanel
                docType={t.value}
                expiryRequired={expiryRequired}
                onClose={() => setAddingType(null)}
              />
            )}
          </div>
        );
      })}
    </section>
  );
}

// ── Public component ──────────────────────────────────────────────────────────

export function CredentialCapture({
  docs,
  config = DEFAULT_CREDENTIAL_CONFIG,
}: {
  docs: CredDoc[];
  config?: CredentialConfigData;
}) {
  const identityGroup = CREDENTIAL_TYPE_GROUPS[0];
  const workGroup = CREDENTIAL_TYPE_GROUPS[1];
  const trainingGroup = CREDENTIAL_TYPE_GROUPS[2];

  // Filter identity types to only show admin-configured acceptable ones
  const acceptableIdentityTypes = identityGroup.types.filter((t) =>
    config.acceptableIdentityTypes.includes(t.value),
  );

  const identityDocs = docs.filter((d) =>
    config.acceptableIdentityTypes.includes(d.docType),
  );
  const workDocs = docs.filter((d) =>
    workGroup.types.some((t) => t.value === d.docType),
  );
  const trainingDocs = docs.filter((d) =>
    trainingGroup.types.some((t) => t.value === d.docType),
  );

  const hasIdentity = identityDocs.length > 0;

  return (
    <div className="space-y-6">
      <CredentialGroup
        title="Identity Document"
        types={acceptableIdentityTypes}
        docs={identityDocs}
        config={config}
        note={
          !hasIdentity ? (
            <p className="text-xs text-red-600 dark:text-red-400">
              At least one identity document is required for site access.
            </p>
          ) : (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Required for site access verification.
            </p>
          )
        }
      />

      <CredentialGroup
        title="Work Credentials"
        types={workGroup.types}
        docs={workDocs}
        config={config}
        note={
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            White card required. Add all HRW licences, trade licences, and certificates that
            apply to your work.
          </p>
        }
      />

      <CredentialGroup
        title="Training Certificates"
        types={trainingGroup.types}
        docs={trainingDocs}
        config={config}
        note={
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Any other training certificates relevant to your role on site.
          </p>
        }
      />
    </div>
  );
}
