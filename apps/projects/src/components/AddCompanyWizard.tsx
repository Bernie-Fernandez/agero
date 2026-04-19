"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  lookupAbn,
  searchAbnByName,
  retrieveCompanyData,
  createCompanyFromWizard,
} from "@/app/(staff)/crm/companies/actions";
import type {
  AbnNameResult,
  RetrievedCompanyData,
} from "@/app/(staff)/crm/companies/actions";

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4 | 5 | 6;
type SearchMode = "abn" | "name";

interface PaymentTermOption {
  id: string;
  name: string;
  isDefault: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const COMPANY_TYPES = [
  { value: "SUBCONTRACTOR", label: "Subcontractor" },
  { value: "CLIENT", label: "Client" },
  { value: "CONSULTANT", label: "Consultant" },
  { value: "SUPPLIER", label: "Supplier" },
];

const AU_STATES = ["ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA"];

function formatAbn(abn: string): string {
  const c = abn.replace(/\s/g, "");
  if (c.length !== 11) return abn;
  return `${c.slice(0, 2)} ${c.slice(2, 5)} ${c.slice(5, 8)} ${c.slice(8, 11)}`;
}

function isRegisteredUnder2Years(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const regDate = new Date(dateStr);
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
  return regDate > twoYearsAgo;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AddCompanyWizard({
  paymentTerms,
}: {
  paymentTerms: PaymentTermOption[];
}) {
  const router = useRouter();

  // ── Step ────────────────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>(1);

  // ── Step 1: Search ──────────────────────────────────────────────────────────
  const [mode, setMode] = useState<SearchMode>("abn");
  const [abnInput, setAbnInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [step1Error, setStep1Error] = useState("");
  const [isSearching, startSearch] = useTransition();

  // ── Step 2: Results ─────────────────────────────────────────────────────────
  const [searchResults, setSearchResults] = useState<AbnNameResult[]>([]);

  // ── Step 3/4: Retrieve ──────────────────────────────────────────────────────
  const [retrieved, setRetrieved] = useState<RetrievedCompanyData | null>(null);
  const [retrieveError, setRetrieveError] = useState("");
  const [isRetrieving, startRetrieve] = useTransition();

  // ── Step 4: Review ──────────────────────────────────────────────────────────
  const [types, setTypes] = useState<string[]>([]);
  const [tradingName, setTradingName] = useState("");
  const [insolvencyAcknowledged, setInsolvencyAcknowledged] = useState(false);

  // ── Step 5: Addresses ───────────────────────────────────────────────────────
  const [asicAddress, setAsicAddress] = useState("");
  const [tradingStreet, setTradingStreet] = useState("");
  const [tradingSuburb, setTradingSuburb] = useState("");
  const [tradingState, setTradingState] = useState("");
  const [tradingPostcode, setTradingPostcode] = useState("");
  const [selectedPaymentTerms, setSelectedPaymentTerms] = useState(
    () => paymentTerms.find((p) => p.isDefault)?.id ?? ""
  );

  // ── Step 6: Directors ───────────────────────────────────────────────────────
  const [selectedDirectors, setSelectedDirectors] = useState<Set<number>>(new Set());
  const [isCreating, startCreate] = useTransition();
  const [createError, setCreateError] = useState("");

  // ── Handlers ────────────────────────────────────────────────────────────────

  function handleAbnSearch() {
    setStep1Error("");
    startSearch(async () => {
      const res = await lookupAbn(abnInput);
      if (!res.ok) {
        setStep1Error(res.error ?? "Lookup failed");
        return;
      }
      setSearchResults([
        {
          abn: abnInput.replace(/\s/g, ""),
          abnStatus: res.abnStatus === "ACTIVE" ? "ACTIVE" : "CANCELLED",
          name: res.abnRegisteredName ?? "",
          state: "",
          postcode: "",
        },
      ]);
      setStep(2);
    });
  }

  function handleNameSearch() {
    setStep1Error("");
    startSearch(async () => {
      const res = await searchAbnByName(nameInput);
      if (!res.ok) {
        setStep1Error(res.error ?? "Search failed");
        return;
      }
      if (!res.results?.length) {
        setStep1Error("No results found. Try a different search term.");
        return;
      }
      setSearchResults(res.results);
      setStep(2);
    });
  }

  function handleSelectResult(result: AbnNameResult) {
    setRetrieveError("");
    setStep(3);
    startRetrieve(async () => {
      const res = await retrieveCompanyData(result.abn, result.name);
      if (!res.ok || !res.data) {
        setRetrieveError(res.error ?? "Failed to retrieve company data");
        return;
      }
      const data = res.data;
      setRetrieved(data);
      setTradingName(data.abnRegisteredName || result.name);
      setAsicAddress(data.asicRegisteredAddress ?? "");
      setTradingStreet(data.asicRegisteredAddress ?? "");
      setSelectedDirectors(new Set(data.asicDirectors.map((_, i) => i)));
      setStep(4);
    });
  }

  function toggleType(type: string) {
    setTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  }

  function toggleDirector(index: number) {
    setSelectedDirectors((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function canProceedStep4(): boolean {
    if (types.length === 0) return false;
    if (!tradingName.trim()) return false;
    if (
      retrieved?.insolvencyCheckResult === "CONCERNS" &&
      !insolvencyAcknowledged
    )
      return false;
    return true;
  }

  function handleCreateCompany() {
    if (!retrieved) return;
    setCreateError("");
    const directorsToAdd = retrieved.asicDirectors.filter((_, i) =>
      selectedDirectors.has(i)
    );
    startCreate(async () => {
      try {
        const result = await createCompanyFromWizard(
          {
            tradingName: tradingName.trim(),
            types,
            retrieved,
            asicRegisteredAddress: asicAddress,
            tradingAddressStreet: tradingStreet,
            tradingAddressSuburb: tradingSuburb,
            tradingAddressState: tradingState,
            tradingAddressPostcode: tradingPostcode,
            paymentTerms: selectedPaymentTerms || undefined,
          },
          directorsToAdd
        );
        router.push(`/crm/companies/${result.companyId}`);
      } catch (e) {
        setCreateError(
          e instanceof Error ? e.message : "Failed to create company"
        );
      }
    });
  }

  // ── Step labels for progress indicator ──────────────────────────────────────
  const stepLabels = ["Search", "Select", "Retrieve", "Review", "Details", "Contacts"];

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Progress indicator — show from step 2 onwards */}
      {step >= 2 && (
        <div className="flex items-center gap-1 mb-8">
          {stepLabels.map((label, i) => {
            const s = (i + 1) as Step;
            const done = s < step;
            const active = s === step;
            return (
              <div key={s} className="flex items-center">
                <div className="flex flex-col items-center gap-1">
                  <div
                    className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium
                      ${done || active ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-400"}`}
                  >
                    {done ? "✓" : s}
                  </div>
                  <span className={`text-xs hidden sm:block ${active ? "text-zinc-700 font-medium" : "text-zinc-400"}`}>
                    {label}
                  </span>
                </div>
                {i < stepLabels.length - 1 && (
                  <div
                    className={`w-6 h-px mx-1 mb-4 ${done ? "bg-zinc-400" : "bg-zinc-200"}`}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── STEP 1: Search ──────────────────────────────────────────────────── */}
      {step === 1 && (
        <div>
          {/* Mode toggle */}
          <div className="flex gap-1 mb-6 bg-zinc-100 p-1 rounded-lg w-fit">
            {(["abn", "name"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  setStep1Error("");
                }}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors
                  ${mode === m
                    ? "bg-white text-zinc-900 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-700"
                  }`}
              >
                {m === "abn" ? "By ABN" : "By Name"}
              </button>
            ))}
          </div>

          {mode === "abn" ? (
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                ABN
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={abnInput}
                  onChange={(e) => setAbnInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAbnSearch()}
                  placeholder="e.g. 51 824 753 556"
                  className="flex-1 px-3 py-2 border border-zinc-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={handleAbnSearch}
                  disabled={isSearching || !abnInput.trim()}
                  className="px-4 py-2 bg-zinc-900 text-white rounded-md text-sm font-medium hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {isSearching ? "Looking up…" : "Look up ABN"}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                Company name
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleNameSearch()}
                  placeholder="Enter company or trading name"
                  className="flex-1 px-3 py-2 border border-zinc-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={handleNameSearch}
                  disabled={isSearching || nameInput.trim().length < 3}
                  className="px-4 py-2 bg-zinc-900 text-white rounded-md text-sm font-medium hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSearching ? "Searching…" : "Search"}
                </button>
              </div>
            </div>
          )}

          {step1Error && (
            <p className="mt-3 text-sm text-red-600">{step1Error}</p>
          )}

          <div className="mt-10 pt-6 border-t border-zinc-100">
            <Link
              href="/crm/companies/new?manual=1"
              className="text-sm text-zinc-500 hover:text-zinc-800"
            >
              Enter company details manually →
            </Link>
          </div>
        </div>
      )}

      {/* ── STEP 2: Results ─────────────────────────────────────────────────── */}
      {step === 2 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-zinc-500">
              {searchResults.length} result{searchResults.length !== 1 ? "s" : ""} found
            </p>
            <button
              type="button"
              onClick={() => {
                setStep(1);
                setSearchResults([]);
              }}
              className="text-sm text-zinc-500 hover:text-zinc-800"
            >
              ← Back to search
            </button>
          </div>
          <div className="space-y-2">
            {searchResults.map((result) => (
              <div
                key={result.abn}
                className="flex items-center justify-between p-4 border border-zinc-200 rounded-lg hover:border-zinc-400 transition-colors"
              >
                <div className="flex-1 min-w-0 mr-4">
                  <p className="text-sm font-semibold text-zinc-900 truncate">
                    {result.name || "—"}
                  </p>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className="text-xs text-zinc-500">
                      ABN {formatAbn(result.abn)}
                    </span>
                    <span
                      className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium
                        ${result.abnStatus === "ACTIVE"
                          ? "bg-green-50 text-green-700"
                          : "bg-red-50 text-red-700"
                        }`}
                    >
                      {result.abnStatus === "ACTIVE" ? "Active" : "Cancelled"}
                    </span>
                    {result.state && (
                      <span className="text-xs text-zinc-400">
                        {result.state}
                        {result.postcode ? ` ${result.postcode}` : ""}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleSelectResult(result)}
                  className="px-4 py-2 bg-zinc-900 text-white rounded-md text-sm font-medium hover:bg-zinc-700 whitespace-nowrap"
                >
                  Use These Details
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── STEP 3: Loading ─────────────────────────────────────────────────── */}
      {step === 3 && (
        <div className="py-12 flex flex-col items-center gap-6">
          {retrieveError ? (
            <div className="text-center space-y-3">
              <p className="text-sm text-red-600">{retrieveError}</p>
              <button
                type="button"
                onClick={() => {
                  setStep(2);
                  setRetrieveError("");
                }}
                className="text-sm text-zinc-500 hover:text-zinc-800"
              >
                ← Back to results
              </button>
            </div>
          ) : (
            <>
              <div className="w-8 h-8 border-2 border-zinc-200 border-t-zinc-900 rounded-full animate-spin" />
              <div className="text-center">
                <p className="text-sm font-medium text-zinc-700">
                  Retrieving company data…
                </p>
                <p className="text-xs text-zinc-400 mt-1">
                  Checking ABR, ASIC, and insolvency records
                </p>
              </div>
              <div className="space-y-2 w-full max-w-xs">
                {[
                  "ABR business register",
                  "ASIC company registration",
                  "Insolvency notices",
                ].map((label) => (
                  <div
                    key={label}
                    className="flex items-center gap-2 text-xs text-zinc-500"
                  >
                    <div className="w-3 h-3 border border-zinc-300 border-t-zinc-600 rounded-full animate-spin flex-shrink-0" />
                    {label}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── STEP 4: Review ──────────────────────────────────────────────────── */}
      {step === 4 && retrieved && (
        <div className="space-y-5">
          {/* ABN / ASIC details panel */}
          <div className="border border-zinc-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-zinc-50 border-b border-zinc-200">
              <h3 className="text-sm font-semibold text-zinc-900">
                ABN &amp; ASIC Details
              </h3>
            </div>
            <div className="px-4 py-4 grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
              <div>
                <p className="text-xs text-zinc-400 uppercase tracking-wide">
                  Registered name
                </p>
                <p className="font-medium text-zinc-900 mt-0.5">
                  {retrieved.abnRegisteredName || "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-400 uppercase tracking-wide">ABN</p>
                <p className="font-medium text-zinc-900 mt-0.5">
                  {formatAbn(retrieved.abn)}
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-400 uppercase tracking-wide">
                  ABN status
                </p>
                <p
                  className={`font-medium mt-0.5 ${retrieved.abnStatus === "ACTIVE" ? "text-green-700" : "text-red-700"}`}
                >
                  {retrieved.abnStatus === "ACTIVE" ? "Active" : "Cancelled"}
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-400 uppercase tracking-wide">
                  ABN registered
                </p>
                <p className="font-medium text-zinc-900 mt-0.5">
                  {formatDate(retrieved.abnRegisteredDate)}
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-400 uppercase tracking-wide">
                  Entity type
                </p>
                <p className="font-medium text-zinc-900 mt-0.5">
                  {retrieved.abnEntityType || "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-400 uppercase tracking-wide">
                  GST registered
                </p>
                <p
                  className={`font-medium mt-0.5 ${retrieved.abnGstRegistered ? "text-green-700" : "text-zinc-500"}`}
                >
                  {retrieved.abnGstRegistered
                    ? `Yes${retrieved.gstRegisteredDate ? ` (since ${formatDate(retrieved.gstRegisteredDate)})` : ""}`
                    : "No"}
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-400 uppercase tracking-wide">
                  ASIC status
                </p>
                <p
                  className={`font-medium mt-0.5 ${
                    retrieved.asicStatus === "REGISTERED"
                      ? "text-green-700"
                      : retrieved.asicStatus === "DEREGISTERED"
                        ? "text-red-700"
                        : "text-zinc-500"
                  }`}
                >
                  {retrieved.asicStatus === "REGISTERED"
                    ? "Registered"
                    : retrieved.asicStatus === "DEREGISTERED"
                      ? "Deregistered"
                      : "Not checked"}
                </p>
              </div>
              {retrieved.anzsicCode && (
                <div>
                  <p className="text-xs text-zinc-400 uppercase tracking-wide">
                    ANZSIC code
                  </p>
                  <p className="font-medium text-zinc-900 mt-0.5">
                    {retrieved.anzsicCode}
                  </p>
                </div>
              )}
              {retrieved.asicDirectors.length > 0 && (
                <div className="col-span-2">
                  <p className="text-xs text-zinc-400 uppercase tracking-wide mb-1">
                    ASIC directors
                  </p>
                  <p className="text-zinc-700 text-sm">
                    {retrieved.asicDirectors
                      .map((d) => `${d.firstName} ${d.lastName}`.trim() || d.fullName)
                      .join(", ")}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Amber: < 2 years registered */}
          {isRegisteredUnder2Years(retrieved.abnRegisteredDate) && (
            <div className="flex gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg">
              <span className="text-amber-500 mt-0.5 flex-shrink-0">⚠</span>
              <div>
                <p className="text-sm font-medium text-amber-800">
                  Recently registered entity
                </p>
                <p className="text-xs text-amber-700 mt-0.5">
                  This ABN was registered on {formatDate(retrieved.abnRegisteredDate)} — less than 2
                  years ago. Consider verifying the company&apos;s trading history before
                  engaging.
                </p>
              </div>
            </div>
          )}

          {/* Red: insolvency concerns */}
          {retrieved.insolvencyCheckResult === "CONCERNS" && (
            <div className="px-4 py-4 bg-red-50 border border-red-200 rounded-lg space-y-3">
              <div className="flex gap-3">
                <span className="text-red-500 flex-shrink-0 mt-0.5">⚠</span>
                <div>
                  <p className="text-sm font-semibold text-red-800">
                    Insolvency concerns detected
                  </p>
                  <p className="text-sm text-red-700 mt-1">
                    {retrieved.insolvencyCheckSummary}
                  </p>
                </div>
              </div>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={insolvencyAcknowledged}
                  onChange={(e) => setInsolvencyAcknowledged(e.target.checked)}
                  className="mt-0.5 rounded"
                />
                <span className="text-sm text-red-800">
                  I acknowledge this insolvency concern and confirm this company
                  should still be added.
                </span>
              </label>
            </div>
          )}

          {/* Green: insolvency clear */}
          {retrieved.insolvencyCheckResult === "CLEAR" && (
            <div className="flex gap-3 px-4 py-3 bg-green-50 border border-green-200 rounded-lg">
              <span className="text-green-600 text-sm flex-shrink-0">✓</span>
              <p className="text-sm text-green-800">
                <span className="font-medium">Insolvency check clear. </span>
                {retrieved.insolvencyCheckSummary}
              </p>
            </div>
          )}

          {/* Grey: insolvency not checked */}
          {retrieved.insolvencyCheckResult === "NOT_CHECKED" && (
            <div className="flex gap-3 px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-lg">
              <span className="text-zinc-400 text-sm flex-shrink-0">—</span>
              <p className="text-sm text-zinc-600">
                <span className="font-medium">Insolvency check not completed. </span>
                {retrieved.insolvencyCheckSummary}
              </p>
            </div>
          )}

          {/* Trading name */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              Trading name{" "}
              <span className="text-zinc-400 font-normal">
                (how the company trades day-to-day)
              </span>
            </label>
            <input
              type="text"
              value={tradingName}
              onChange={(e) => setTradingName(e.target.value)}
              placeholder="Trading name"
              className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
            />
            <p className="text-xs text-zinc-400 mt-1">
              Legal/registered name:{" "}
              <span className="text-zinc-600">{retrieved.abnRegisteredName || "—"}</span>
            </p>
          </div>

          {/* Company types */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">
              Company type{" "}
              <span className="text-zinc-400 font-normal">(select all that apply)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {COMPANY_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => toggleType(t.value)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors
                    ${types.includes(t.value)
                      ? "bg-zinc-900 text-white border-zinc-900"
                      : "bg-white text-zinc-600 border-zinc-300 hover:border-zinc-500"
                    }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {types.length === 0 && (
              <p className="text-xs text-red-500 mt-1">
                Select at least one type to continue
              </p>
            )}
          </div>

          <div className="flex justify-between pt-2">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="text-sm text-zinc-500 hover:text-zinc-800"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={() => setStep(5)}
              disabled={!canProceedStep4()}
              className="px-5 py-2 bg-zinc-900 text-white rounded-md text-sm font-medium hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next: Address Details →
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 5: Addresses ───────────────────────────────────────────────── */}
      {step === 5 && retrieved && (
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              Trading name
            </label>
            <input
              type="text"
              value={tradingName}
              onChange={(e) => setTradingName(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              ASIC registered address
            </label>
            <input
              type="text"
              value={asicAddress}
              onChange={(e) => setAsicAddress(e.target.value)}
              placeholder="ASIC registered address"
              className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
            />
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium text-zinc-700">Trading address</p>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Street</label>
              <input
                type="text"
                value={tradingStreet}
                onChange={(e) => setTradingStreet(e.target.value)}
                placeholder="Street address"
                className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
              />
            </div>
            <div className="grid grid-cols-5 gap-3">
              <div className="col-span-2">
                <label className="block text-xs text-zinc-500 mb-1">Suburb</label>
                <input
                  type="text"
                  value={tradingSuburb}
                  onChange={(e) => setTradingSuburb(e.target.value)}
                  placeholder="Suburb"
                  className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-zinc-500 mb-1">State</label>
                <select
                  value={tradingState}
                  onChange={(e) => setTradingState(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent bg-white"
                >
                  <option value="">State</option>
                  {AU_STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Postcode</label>
                <input
                  type="text"
                  value={tradingPostcode}
                  onChange={(e) => setTradingPostcode(e.target.value)}
                  placeholder="3000"
                  maxLength={4}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {paymentTerms.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                Payment terms
              </label>
              <select
                value={selectedPaymentTerms}
                onChange={(e) => setSelectedPaymentTerms(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent bg-white"
              >
                <option value="">— Select payment terms —</option>
                {paymentTerms.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex justify-between pt-2">
            <button
              type="button"
              onClick={() => setStep(4)}
              className="text-sm text-zinc-500 hover:text-zinc-800"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={() => setStep(6)}
              disabled={!tradingName.trim()}
              className="px-5 py-2 bg-zinc-900 text-white rounded-md text-sm font-medium hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next: Directors →
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 6: Directors ───────────────────────────────────────────────── */}
      {step === 6 && retrieved && (
        <div className="space-y-5">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">
              Directors as contacts
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Select directors to add as contacts for this company. You can add
              more contacts after creation.
            </p>
          </div>

          {retrieved.asicDirectors.length === 0 ? (
            <div className="px-4 py-8 border border-zinc-200 rounded-lg text-center">
              <p className="text-sm text-zinc-500">
                No director data retrieved from ASIC.
              </p>
              <p className="text-xs text-zinc-400 mt-1">
                You can add contacts manually after creating the company.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {retrieved.asicDirectors.map((director, i) => (
                <label
                  key={i}
                  className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors
                    ${selectedDirectors.has(i)
                      ? "border-zinc-400 bg-zinc-50"
                      : "border-zinc-200 hover:border-zinc-300"
                    }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedDirectors.has(i)}
                    onChange={() => toggleDirector(i)}
                    className="rounded flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-900">
                      {[director.firstName, director.lastName]
                        .filter(Boolean)
                        .join(" ") || director.fullName}
                    </p>
                    {director.fullName &&
                      director.fullName !==
                        `${director.firstName} ${director.lastName}`.trim() && (
                        <p className="text-xs text-zinc-400 mt-0.5">
                          Full name: {director.fullName}
                        </p>
                      )}
                    {director.appointmentDate && (
                      <p className="text-xs text-zinc-400">
                        Appointed {formatDate(director.appointmentDate)}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded flex-shrink-0">
                    Director
                  </span>
                </label>
              ))}
            </div>
          )}

          {createError && (
            <p className="text-sm text-red-600">{createError}</p>
          )}

          <div className="flex justify-between pt-2">
            <button
              type="button"
              onClick={() => setStep(5)}
              className="text-sm text-zinc-500 hover:text-zinc-800"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={handleCreateCompany}
              disabled={isCreating}
              className="px-5 py-2 bg-zinc-900 text-white rounded-md text-sm font-medium hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreating ? "Creating company…" : "Create Company"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
