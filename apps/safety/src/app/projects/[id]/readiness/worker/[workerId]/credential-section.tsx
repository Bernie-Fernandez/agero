"use client";

import React, { useRef, useState, useTransition, useActionState } from "react";
import { uploadAndExtract, saveCredential } from "./credential-actions";
import type { SaveCredentialState } from "./credential-actions";

const CRED_TYPES = [
  { value: "WHITE_CARD", label: "White Card" },
  { value: "HRWL_SCAFFOLD", label: "HRWL — Scaffolding" },
  { value: "HRWL_CRANE", label: "HRWL — Crane" },
  { value: "HRWL_FORKLIFT", label: "HRWL — Forklift" },
  { value: "HRWL_EWP", label: "HRWL — EWP" },
  { value: "HRWL_DOGGING", label: "HRWL — Dogging" },
  { value: "HRWL_RIGGING", label: "HRWL — Rigging" },
  { value: "HRWL_CONFINED_SPACE", label: "HRWL — Confined Space" },
  { value: "HRWL_EXPLOSIVE", label: "HRWL — Explosive Powered Tools" },
  { value: "HRWL_OTHER", label: "HRWL — Other" },
  { value: "TRADE_CERTIFICATE", label: "Trade Certificate" },
  { value: "FIRST_AID", label: "First Aid" },
  { value: "ASBESTOS_AWARENESS", label: "Asbestos Awareness" },
  { value: "DRIVER_LICENCE", label: "Driver Licence" },
  { value: "PASSPORT", label: "Passport" },
  { value: "GOVERNMENT_ID", label: "Government ID" },
  { value: "TRAINING_CERTIFICATE", label: "Training Certificate" },
  { value: "OTHER", label: "Other" },
] as const;

type CredTypeValue = (typeof CRED_TYPES)[number]["value"];

type ExistingCredential = {
  id: string;
  credentialType: CredTypeValue;
  credentialNumber: string | null;
  issuingBody: string | null;
  issueDate: Date | null;
  expiryDate: Date | null;
  isVerified: boolean;
  photoUrl: string | null;
  notes: string | null;
  createdAt: Date;
};

type Phase = "idle" | "photo" | "extracting" | "confirm" | "upload-error" | "saved";

function expiryColor(expiryDate: Date | null): string {
  if (!expiryDate) return "text-zinc-500";
  const now = Date.now();
  const ms = expiryDate.getTime() - now;
  const days = ms / (1000 * 60 * 60 * 24);
  if (days < 0) return "text-red-600 dark:text-red-400";
  if (days < 30) return "text-amber-600 dark:text-amber-400";
  return "text-green-600 dark:text-green-400";
}

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-AU");
}

function labelFor(type: CredTypeValue): string {
  return CRED_TYPES.find((c) => c.value === type)?.label ?? type;
}

export function CredentialSection({
  workerId,
  safetyProjectId,
  initialCredentials,
  canEdit,
}: {
  workerId: string;
  safetyProjectId: string;
  initialCredentials: ExistingCredential[];
  canEdit: boolean;
}) {
  const [activeType, setActiveType] = useState<CredTypeValue | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<{
    credentialNumber: string | null;
    issuingBody: string | null;
    issueDate: string | null;
    expiryDate: string | null;
    holderName: string | null;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  const boundSave = activeType
    ? saveCredential.bind(null, workerId, safetyProjectId)
    : null;

  const [saveState, saveAction] = useActionState<SaveCredentialState, FormData>(
    boundSave ?? (async (prev: SaveCredentialState) => prev),
    {},
  );

  function handleTypeSelect(type: CredTypeValue) {
    setActiveType(type);
    setPhase("photo");
    setUploadError(null);
    setPhotoUrl(null);
    setExtracted(null);
    setTimeout(() => fileInputRef.current?.click(), 50);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const label = labelFor(activeType!);
    setPhase("extracting");
    const fd = new FormData();
    fd.append("photo", file);
    startTransition(async () => {
      const result = await uploadAndExtract(workerId, label, fd);
      if ("error" in result) {
        setUploadError(result.error);
        setPhase("upload-error");
      } else {
        setPhotoUrl(result.photoUrl);
        setExtracted(result.extraction);
        setPhase("confirm");
      }
    });
    // Reset input so same file can be re-selected if needed
    e.target.value = "";
  }

  function handleCancel() {
    setActiveType(null);
    setPhase("idle");
    setUploadError(null);
    setPhotoUrl(null);
    setExtracted(null);
  }

  if (phase === "saved") {
    return (
      <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm text-green-600 dark:text-green-400">Credential saved.</p>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Credentials</h2>
      <p className="mt-1 text-xs text-zinc-500">
        {canEdit
          ? "Capture a photo of each licence or certificate. Claude will extract the details automatically."
          : "Credentials are managed by the worker's company."}
      </p>

      {/* Hidden file input — triggered programmatically, only mounted when editing is allowed */}
      {canEdit && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
        />
      )}

      {/* Existing credentials list */}
      {initialCredentials.length > 0 && (
        <div className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800">
          {initialCredentials.map((c) => (
            <div key={c.id} className="flex items-start justify-between py-3">
              <div>
                <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                  {labelFor(c.credentialType)}
                  {c.isVerified && (
                    <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      Verified
                    </span>
                  )}
                </p>
                {c.credentialNumber && (
                  <p className="text-xs text-zinc-500">{c.credentialNumber}</p>
                )}
                {c.issuingBody && (
                  <p className="text-xs text-zinc-500">{c.issuingBody}</p>
                )}
              </div>
              <div className="text-right text-xs">
                {c.expiryDate && (
                  <p className={expiryColor(c.expiryDate)}>
                    Expires {fmtDate(c.expiryDate)}
                  </p>
                )}
                {c.issueDate && (
                  <p className="text-zinc-400">Issued {fmtDate(c.issueDate)}</p>
                )}
                {c.photoUrl && (
                  <a
                    href={c.photoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-zinc-400 hover:text-zinc-600"
                  >
                    View photo →
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Write UI — only shown when the current user is allowed to add/edit */}
      {/* Extracting spinner */}
      {canEdit && phase === "extracting" && (
        <div className="mt-4 flex items-center gap-2 text-sm text-zinc-500">
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          Uploading and extracting details…
        </div>
      )}

      {/* Upload error */}
      {canEdit && phase === "upload-error" && (
        <div className="mt-4">
          <p className="text-sm text-red-600 dark:text-red-400">{uploadError}</p>
          <button
            type="button"
            onClick={handleCancel}
            className="mt-2 text-sm text-zinc-500 underline"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Confirm form */}
      {canEdit && phase === "confirm" && activeType && (
        <form action={saveAction} className="mt-4 space-y-4">
          <input type="hidden" name="credentialType" value={activeType} />
          <input type="hidden" name="photoUrl" value={photoUrl ?? ""} />

          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Confirm details for <strong>{labelFor(activeType)}</strong>
          </p>

          {photoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl}
              alt="Credential photo"
              className="h-32 w-auto rounded border border-zinc-200 object-contain dark:border-zinc-700"
            />
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-zinc-500 mb-1">
                Credential / licence number
              </label>
              <input
                type="text"
                name="credentialNumber"
                defaultValue={extracted?.credentialNumber ?? ""}
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-zinc-500 mb-1">
                Issuing body / authority
              </label>
              <input
                type="text"
                name="issuingBody"
                defaultValue={extracted?.issuingBody ?? ""}
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Issue date</label>
              <input
                type="date"
                name="issueDate"
                defaultValue={extracted?.issueDate ?? ""}
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Expiry date</label>
              <input
                type="date"
                name="expiryDate"
                defaultValue={extracted?.expiryDate ?? ""}
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-zinc-500 mb-1">Notes</label>
              <input
                type="text"
                name="notes"
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
          </div>

          {saveState.error && (
            <p className="text-sm text-red-600 dark:text-red-400">{saveState.error}</p>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Save credential
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Add credential buttons — only show when idle and editing is allowed */}
      {canEdit && phase === "idle" && (
        <div className="mt-4">
          <p className="text-xs font-medium text-zinc-500 mb-2">Add credential</p>
          <div className="flex flex-wrap gap-2">
            {CRED_TYPES.map((ct) => (
              <button
                key={ct.value}
                type="button"
                disabled={isPending}
                onClick={() => handleTypeSelect(ct.value)}
                className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-600 hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:text-zinc-200 disabled:opacity-50"
              >
                + {ct.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
