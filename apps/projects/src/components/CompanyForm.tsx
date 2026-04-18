"use client";

import { useState, useTransition, useRef } from "react";
import { lookupAbn, searchAbnByName } from "@/app/(staff)/crm/companies/actions";
import type { AbnNameResult } from "@/app/(staff)/crm/companies/actions";

const COMPANY_TYPES = [
  { value: "SUBCONTRACTOR", label: "Subcontractor" },
  { value: "CLIENT", label: "Client" },
  { value: "CONSULTANT", label: "Consultant" },
  { value: "SUPPLIER", label: "Supplier" },
];

const AU_STATES = ["ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA"];

interface PaymentTerm {
  id: string;
  name: string;
  isDefault: boolean;
}

interface CompanyData {
  id: string;
  name: string;
  legalName: string | null;
  types: string[];
  abn: string | null;
  abnStatus: string;
  abnRegisteredName: string | null;
  abnGstRegistered: boolean | null;
  asicStatus: string;
  website: string | null;
  phoneMain: string | null;
  emailGeneral: string | null;
  addressStreet: string | null;
  addressSuburb: string | null;
  addressState: string | null;
  addressPostcode: string | null;
  postalSameAsStreet: boolean | null;
  postalStreet: string | null;
  postalSuburb: string | null;
  postalState: string | null;
  postalPostcode: string | null;
  paymentTerms: string | null;
  isActive: boolean;
}

interface Props {
  company?: CompanyData;
  paymentTerms: PaymentTerm[];
  action: (formData: FormData) => Promise<void>;
}

interface AbnLookupState {
  abnStatus: string;
  abnRegisteredName: string;
  abnGstRegistered: boolean;
  asicStatus: string;
}

function formatAbn(raw: string) {
  const d = raw.replace(/\s/g, "");
  if (d.length !== 11) return raw;
  return `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8)}`;
}

function StatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    ACTIVE: "bg-green-100 text-green-700",
    CANCELLED: "bg-red-100 text-red-700",
    NOT_VERIFIED: "bg-gray-100 text-gray-500",
    REGISTERED: "bg-green-100 text-green-700",
    DEREGISTERED: "bg-red-100 text-red-700",
    NOT_CHECKED: "bg-gray-100 text-gray-500",
  };
  const labels: Record<string, string> = {
    ACTIVE: "ABN Active",
    CANCELLED: "ABN Cancelled",
    NOT_VERIFIED: "ABN Not Verified",
    REGISTERED: "ASIC Registered",
    DEREGISTERED: "ASIC Deregistered",
    NOT_CHECKED: "ASIC Not Checked",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls[status] ?? "bg-gray-100 text-gray-500"}`}>
      {labels[status] ?? status}
    </span>
  );
}

export function CompanyForm({ company, paymentTerms, action }: Props) {
  // Search mode: "abn" = lookup by number, "name" = search by company name
  const [searchMode, setSearchMode] = useState<"abn" | "name">("abn");

  // ABN field (the final confirmed ABN)
  const [abn, setAbn] = useState(company?.abn ?? "");

  // Lookup result (shown as confirmation card)
  const [abnLookup, setAbnLookup] = useState<AbnLookupState | null>(
    company && company.abnStatus !== "NOT_VERIFIED"
      ? {
          abnStatus: company.abnStatus,
          abnRegisteredName: company.abnRegisteredName ?? "",
          abnGstRegistered: company.abnGstRegistered ?? false,
          asicStatus: company.asicStatus,
        }
      : null
  );
  const [lookupError, setLookupError] = useState<string | null>(null);

  // Name search state
  const [nameQuery, setNameQuery] = useState("");
  const [nameResults, setNameResults] = useState<AbnNameResult[] | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  // Pending states (separate for each action so buttons show correct loading)
  const [isLookingUpAbn, startAbnLookup] = useTransition();
  const [isSearchingName, startNameSearch] = useTransition();
  const [isSelectingResult, startSelectResult] = useTransition();

  const nameInputRef = useRef<HTMLInputElement>(null);

  // Other form state
  const [selectedTypes, setSelectedTypes] = useState<string[]>(company?.types ?? []);
  const [postalSame, setPostalSame] = useState(company?.postalSameAsStreet ?? true);
  const [isActive, setIsActive] = useState(company?.isActive ?? true);

  function toggleType(value: string) {
    setSelectedTypes((prev) =>
      prev.includes(value) ? prev.filter((t) => t !== value) : [...prev, value]
    );
  }

  // ── ABN number lookup ────────────────────────────────────────────────────────

  function handleAbnLookup() {
    setLookupError(null);
    startAbnLookup(async () => {
      const result = await lookupAbn(abn);
      if (!result.ok) {
        setLookupError(result.error ?? "Lookup failed");
        return;
      }
      setAbnLookup({
        abnStatus: result.abnStatus!,
        abnRegisteredName: result.abnRegisteredName ?? "",
        abnGstRegistered: result.abnGstRegistered ?? false,
        asicStatus: result.asicStatus!,
      });
    });
  }

  // ── Name search ──────────────────────────────────────────────────────────────

  function handleNameSearch() {
    setNameError(null);
    setNameResults(null);
    startNameSearch(async () => {
      const result = await searchAbnByName(nameQuery);
      if (!result.ok) {
        setNameError(result.error ?? "Search failed");
        return;
      }
      setNameResults(result.results ?? []);
    });
  }

  function handleSelectResult(r: AbnNameResult) {
    // Set the ABN field and immediately run detail lookup
    setAbn(r.abn);
    setNameResults(null);
    setNameQuery("");
    setLookupError(null);
    setNameError(null);

    startSelectResult(async () => {
      const detail = await lookupAbn(r.abn);
      if (detail.ok) {
        setAbnLookup({
          abnStatus: detail.abnStatus!,
          abnRegisteredName: detail.abnRegisteredName ?? r.name,
          abnGstRegistered: detail.abnGstRegistered ?? false,
          asicStatus: detail.asicStatus!,
        });
      } else {
        // Fallback to data we already have from the search result
        setAbnLookup({
          abnStatus: r.abnStatus,
          abnRegisteredName: r.name,
          abnGstRegistered: false,
          asicStatus: "NOT_CHECKED",
        });
      }
    });
  }

  const defaultPaymentTerm = paymentTerms.find((p) => p.isDefault)?.name ?? "";
  const isAnyLookupPending = isLookingUpAbn || isSearchingName || isSelectingResult;

  return (
    <form action={action} className="space-y-8">
      {/* Hidden fields for ABN lookup results */}
      <input type="hidden" name="abnStatus" value={abnLookup?.abnStatus ?? "NOT_VERIFIED"} />
      <input type="hidden" name="abnRegisteredName" value={abnLookup?.abnRegisteredName ?? ""} />
      <input type="hidden" name="abnGstRegistered" value={abnLookup ? String(abnLookup.abnGstRegistered) : ""} />
      <input type="hidden" name="asicStatus" value={abnLookup?.asicStatus ?? "NOT_CHECKED"} />
      <input type="hidden" name="postalSameAsStreet" value={String(postalSame)} />
      <input type="hidden" name="isActive" value={String(isActive)} />

      {/* ── Company Identity ── */}
      <section>
        <h3 className="text-sm font-semibold text-zinc-700 mb-4 pb-2 border-b border-gray-100">
          Company Identity
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-zinc-600 mb-1">
              Company Name <span className="text-red-500">*</span>
            </label>
            <input
              name="name"
              defaultValue={company?.name ?? ""}
              required
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Trading name"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-zinc-600 mb-1">Legal Name</label>
            <input
              name="legalName"
              defaultValue={company?.legalName ?? ""}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Registered legal name (if different)"
            />
          </div>
        </div>

        {/* Company Types */}
        <div className="mt-4">
          <label className="block text-xs font-medium text-zinc-600 mb-2">Company Type(s)</label>
          <div className="flex flex-wrap gap-3">
            {COMPANY_TYPES.map(({ value, label }) => (
              <label key={value} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="types"
                  value={value}
                  checked={selectedTypes.includes(value)}
                  onChange={() => toggleType(value)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-zinc-700">{label}</span>
              </label>
            ))}
          </div>
        </div>
      </section>

      {/* ── ABN & Compliance ── */}
      <section>
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-zinc-700">ABN &amp; Compliance</h3>
          {/* Mode toggle */}
          <div className="flex rounded-md border border-gray-200 overflow-hidden text-xs font-medium">
            <button
              type="button"
              onClick={() => { setSearchMode("abn"); setNameResults(null); setNameError(null); }}
              className={`px-3 py-1.5 transition-colors ${
                searchMode === "abn"
                  ? "bg-zinc-800 text-white"
                  : "bg-white text-zinc-600 hover:bg-gray-50"
              }`}
            >
              By ABN
            </button>
            <button
              type="button"
              onClick={() => { setSearchMode("name"); setTimeout(() => nameInputRef.current?.focus(), 50); }}
              className={`px-3 py-1.5 transition-colors border-l border-gray-200 ${
                searchMode === "name"
                  ? "bg-zinc-800 text-white"
                  : "bg-white text-zinc-600 hover:bg-gray-50"
              }`}
            >
              By Name
            </button>
          </div>
        </div>

        {/* ABN number mode */}
        {searchMode === "abn" && (
          <div className="space-y-2">
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="block text-xs font-medium text-zinc-600 mb-1">ABN</label>
                <input
                  name="abn"
                  value={abn}
                  onChange={(e) => {
                    setAbn(e.target.value);
                    setAbnLookup(null);
                    setLookupError(null);
                  }}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="12 345 678 901"
                  maxLength={14}
                />
              </div>
              <button
                type="button"
                onClick={handleAbnLookup}
                disabled={isAnyLookupPending || abn.replace(/\s/g, "").length < 11}
                className="px-4 py-2 bg-zinc-800 text-white text-sm font-medium rounded-md hover:bg-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLookingUpAbn ? "Looking up…" : "Lookup"}
              </button>
            </div>
            {lookupError && <p className="text-xs text-red-600">{lookupError}</p>}
          </div>
        )}

        {/* Name search mode */}
        {searchMode === "name" && (
          <div className="space-y-2">
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="block text-xs font-medium text-zinc-600 mb-1">
                  Company Name (ABR search)
                </label>
                <input
                  ref={nameInputRef}
                  value={nameQuery}
                  onChange={(e) => { setNameQuery(e.target.value); setNameResults(null); setNameError(null); }}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleNameSearch(); } }}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Acme Constructions"
                  autoComplete="off"
                />
              </div>
              <button
                type="button"
                onClick={handleNameSearch}
                disabled={isAnyLookupPending || nameQuery.trim().length < 3}
                className="px-4 py-2 bg-zinc-800 text-white text-sm font-medium rounded-md hover:bg-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSearchingName ? "Searching…" : "Search"}
              </button>
            </div>
            {nameError && <p className="text-xs text-red-600">{nameError}</p>}

            {/* Name search results */}
            {nameResults !== null && (
              <div className="border border-gray-200 rounded-md overflow-hidden">
                {nameResults.length === 0 ? (
                  <p className="text-xs text-zinc-400 px-3 py-3">No results found for &ldquo;{nameQuery}&rdquo;</p>
                ) : (
                  <ul className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
                    {nameResults.map((r) => (
                      <li key={r.abn}>
                        <button
                          type="button"
                          onClick={() => handleSelectResult(r)}
                          disabled={isAnyLookupPending}
                          className="w-full text-left px-3 py-2.5 hover:bg-blue-50 transition-colors disabled:opacity-50"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-zinc-800 truncate">{r.name}</p>
                              <p className="text-xs text-zinc-400 font-mono">{formatAbn(r.abn)}</p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {r.state && (
                                <span className="text-xs text-zinc-400">{r.state}</span>
                              )}
                              <span
                                className={`text-xs px-1.5 py-0.5 rounded-full ${
                                  r.abnStatus === "ACTIVE"
                                    ? "bg-green-100 text-green-700"
                                    : "bg-gray-100 text-gray-500"
                                }`}
                              >
                                {r.abnStatus === "ACTIVE" ? "Active" : "Cancelled"}
                              </span>
                            </div>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Show the selected ABN after picking from results */}
            {abn && !nameResults && (
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <span className="font-mono">{formatAbn(abn)}</span>
                {isSelectingResult && <span className="text-zinc-400">Fetching details…</span>}
                <button
                  type="button"
                  onClick={() => { setAbn(""); setAbnLookup(null); }}
                  className="text-zinc-400 hover:text-zinc-600 ml-1"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Hidden input carries the confirmed ABN into formData when in name mode */}
            {searchMode === "name" && <input type="hidden" name="abn" value={abn} />}
          </div>
        )}

        {/* Confirmation card — shown after any successful lookup */}
        {abnLookup && !isSelectingResult && (
          <div className="mt-3 bg-gray-50 rounded-lg border border-gray-200 p-3 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadge status={abnLookup.abnStatus} />
              <StatusBadge status={abnLookup.asicStatus} />
              <span className="text-xs text-zinc-400 bg-white border border-gray-200 px-2 py-0.5 rounded-full">
                CreditorWatch: Not Checked
              </span>
            </div>
            {abnLookup.abnRegisteredName && (
              <p className="text-sm font-medium text-zinc-800">{abnLookup.abnRegisteredName}</p>
            )}
            <p className="text-xs text-zinc-500">
              GST Registered: {abnLookup.abnGstRegistered ? "Yes" : "No"}
            </p>
          </div>
        )}
        {isSelectingResult && (
          <div className="mt-3 bg-gray-50 rounded-lg border border-gray-200 p-3 text-xs text-zinc-400 animate-pulse">
            Fetching ABN details…
          </div>
        )}

        {/* Existing lookup data on edit pages (when no re-lookup done) */}
        {!abnLookup && !isSelectingResult && company && company.abnStatus !== "NOT_VERIFIED" && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <StatusBadge status={company.abnStatus} />
            <StatusBadge status={company.asicStatus} />
          </div>
        )}
      </section>

      {/* ── Contact Details ── */}
      <section>
        <h3 className="text-sm font-semibold text-zinc-700 mb-4 pb-2 border-b border-gray-100">
          Contact Details
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Phone</label>
            <input
              name="phoneMain"
              defaultValue={company?.phoneMain ?? ""}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="(03) 9000 0000"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">General Email</label>
            <input
              name="emailGeneral"
              type="email"
              defaultValue={company?.emailGeneral ?? ""}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="info@company.com.au"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-zinc-600 mb-1">Website</label>
            <input
              name="website"
              type="url"
              defaultValue={company?.website ?? ""}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://www.company.com.au"
            />
          </div>
        </div>
      </section>

      {/* ── Street Address ── */}
      <section>
        <h3 className="text-sm font-semibold text-zinc-700 mb-4 pb-2 border-b border-gray-100">
          Street Address
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-6">
          <div className="sm:col-span-6">
            <label className="block text-xs font-medium text-zinc-600 mb-1">Street</label>
            <input
              name="addressStreet"
              defaultValue={company?.addressStreet ?? ""}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="123 Example Street"
            />
          </div>
          <div className="sm:col-span-3">
            <label className="block text-xs font-medium text-zinc-600 mb-1">Suburb</label>
            <input
              name="addressSuburb"
              defaultValue={company?.addressSuburb ?? ""}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-zinc-600 mb-1">State</label>
            <select
              name="addressState"
              defaultValue={company?.addressState ?? "VIC"}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">—</option>
              {AU_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="sm:col-span-1">
            <label className="block text-xs font-medium text-zinc-600 mb-1">Postcode</label>
            <input
              name="addressPostcode"
              defaultValue={company?.addressPostcode ?? ""}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="3000"
              maxLength={4}
            />
          </div>
        </div>
      </section>

      {/* ── Postal Address ── */}
      <section>
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-zinc-700">Postal Address</h3>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={postalSame}
              onChange={(e) => setPostalSame(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-xs text-zinc-600">Same as street address</span>
          </label>
        </div>
        {!postalSame && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-6">
            <div className="sm:col-span-6">
              <label className="block text-xs font-medium text-zinc-600 mb-1">Street / PO Box</label>
              <input
                name="postalStreet"
                defaultValue={company?.postalStreet ?? ""}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="PO Box 123"
              />
            </div>
            <div className="sm:col-span-3">
              <label className="block text-xs font-medium text-zinc-600 mb-1">Suburb</label>
              <input
                name="postalSuburb"
                defaultValue={company?.postalSuburb ?? ""}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-zinc-600 mb-1">State</label>
              <select
                name="postalState"
                defaultValue={company?.postalState ?? "VIC"}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">—</option>
                {AU_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="sm:col-span-1">
              <label className="block text-xs font-medium text-zinc-600 mb-1">Postcode</label>
              <input
                name="postalPostcode"
                defaultValue={company?.postalPostcode ?? ""}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="3000"
                maxLength={4}
              />
            </div>
          </div>
        )}
      </section>

      {/* ── Settings ── */}
      <section>
        <h3 className="text-sm font-semibold text-zinc-700 mb-4 pb-2 border-b border-gray-100">
          Settings
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Payment Terms</label>
            <select
              name="paymentTerms"
              defaultValue={company?.paymentTerms ?? defaultPaymentTerm}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— Select —</option>
              {paymentTerms.map((pt) => (
                <option key={pt.id} value={pt.name}>
                  {pt.name}{pt.isDefault ? " (default)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center">
            <label className="flex items-center gap-3 cursor-pointer mt-5">
              <button
                type="button"
                role="switch"
                aria-checked={isActive}
                onClick={() => setIsActive((v) => !v)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  isActive ? "bg-blue-600" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isActive ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
              <span className="text-sm text-zinc-700">{isActive ? "Active" : "Inactive"}</span>
            </label>
          </div>
        </div>
      </section>

      {/* ── Submit ── */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
        >
          {company ? "Save Changes" : "Add Company"}
        </button>
        <a
          href={company ? `/crm/companies/${company.id}` : "/crm/companies"}
          className="px-5 py-2 text-sm text-zinc-600 hover:text-zinc-900"
        >
          Cancel
        </a>
      </div>
    </form>
  );
}
