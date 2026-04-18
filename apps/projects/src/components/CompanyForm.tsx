"use client";

import { useState, useTransition } from "react";
import { lookupAbn } from "@/app/(staff)/crm/companies/actions";

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

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
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
    NOT_VERIFIED: "Not Verified",
    REGISTERED: "ASIC Registered",
    DEREGISTERED: "ASIC Deregistered",
    NOT_CHECKED: "ASIC Not Checked",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${map[status] ?? "bg-gray-100 text-gray-500"}`}>
      {labels[status] ?? status}
    </span>
  );
}

export function CompanyForm({ company, paymentTerms, action }: Props) {
  const [isPending, startTransition] = useTransition();
  const [selectedTypes, setSelectedTypes] = useState<string[]>(company?.types ?? []);
  const [postalSame, setPostalSame] = useState(company?.postalSameAsStreet ?? true);
  const [abn, setAbn] = useState(company?.abn ?? "");
  const [abnLookup, setAbnLookup] = useState<{
    abnStatus: string;
    abnRegisteredName: string;
    abnGstRegistered: boolean;
    asicStatus: string;
  } | null>(
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
  const [isActive, setIsActive] = useState(company?.isActive ?? true);

  function toggleType(value: string) {
    setSelectedTypes((prev) =>
      prev.includes(value) ? prev.filter((t) => t !== value) : [...prev, value]
    );
  }

  function handleLookup() {
    setLookupError(null);
    startTransition(async () => {
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

  const defaultPaymentTerm = paymentTerms.find((p) => p.isDefault)?.name ?? "";

  return (
    <form action={action} className="space-y-8">
      {/* Hidden fields for ABN lookup results */}
      <input type="hidden" name="abnStatus" value={abnLookup?.abnStatus ?? "NOT_VERIFIED"} />
      <input type="hidden" name="abnRegisteredName" value={abnLookup?.abnRegisteredName ?? ""} />
      <input type="hidden" name="abnGstRegistered" value={abnLookup ? String(abnLookup.abnGstRegistered) : ""} />
      <input type="hidden" name="asicStatus" value={abnLookup?.asicStatus ?? "NOT_CHECKED"} />
      <input type="hidden" name="postalSameAsStreet" value={String(postalSame)} />
      <input type="hidden" name="isActive" value={String(isActive)} />

      {/* Company Identity */}
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
            <label className="block text-xs font-medium text-zinc-600 mb-1">
              Legal Name
            </label>
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
          <label className="block text-xs font-medium text-zinc-600 mb-2">
            Company Type(s)
          </label>
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

      {/* ABN Lookup */}
      <section>
        <h3 className="text-sm font-semibold text-zinc-700 mb-4 pb-2 border-b border-gray-100">
          ABN &amp; Compliance
        </h3>
        <div className="flex gap-2 items-end mb-3">
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
            onClick={handleLookup}
            disabled={isPending || abn.replace(/\s/g, "").length < 11}
            className="px-4 py-2 bg-zinc-800 text-white text-sm font-medium rounded-md hover:bg-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isPending ? "Looking up…" : "Lookup"}
          </button>
        </div>

        {lookupError && (
          <p className="text-xs text-red-600 mb-3">{lookupError}</p>
        )}

        {abnLookup && (
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-3 space-y-2 mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadge status={abnLookup.abnStatus} />
              <StatusBadge status={abnLookup.asicStatus} />
              <span className="text-xs text-zinc-500 bg-gray-100 px-2 py-0.5 rounded-full">
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

        {!abnLookup && company && company.abnStatus !== "NOT_VERIFIED" && (
          <div className="flex items-center gap-2 mb-3">
            <StatusBadge status={company.abnStatus} />
            <StatusBadge status={company.asicStatus} />
          </div>
        )}
      </section>

      {/* Contact Details */}
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

      {/* Street Address */}
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
              {AU_STATES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
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

      {/* Postal Address */}
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
                {AU_STATES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
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

      {/* Settings */}
      <section>
        <h3 className="text-sm font-semibold text-zinc-700 mb-4 pb-2 border-b border-gray-100">
          Settings
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">
              Payment Terms
            </label>
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
              <span className="text-sm text-zinc-700">
                {isActive ? "Active" : "Inactive"}
              </span>
            </label>
          </div>
        </div>
      </section>

      {/* Submit */}
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
