import { prisma } from "@/lib/prisma";
import { requireAppUser, canDelete, canEdit } from "@/lib/auth";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TabNav } from "@/components/TabNav";
import { ConfirmForm } from "@/components/ConfirmForm";
import { BlacklistButton } from "@/components/BlacklistModal";
import { DeleteCompanyModal } from "@/components/DeleteCompanyModal";
import { AddContactDrawer } from "@/components/AddContactDrawer";
import { AddInsurancePolicyDrawer } from "@/components/AddInsurancePolicyDrawer";
import { UploadDocumentDrawer } from "@/components/UploadDocumentDrawer";
import {
  blacklistCompany,
  unblacklistCompany,
  addCompanyContactLink,
  removeCompanyContactLink,
  deleteCompanyWithContacts,
  verifyInsurancePolicy,
  deleteInsurancePolicy,
  verifyCompanyDocument,
  deleteCompanyDocument,
} from "../actions";

const TYPE_LABELS: Record<string, string> = {
  SUBCONTRACTOR: "Subcontractor",
  CLIENT: "Client",
  CONSULTANT: "Consultant",
  SUPPLIER: "Supplier",
};
const TYPE_COLORS: Record<string, string> = {
  SUBCONTRACTOR: "bg-orange-100 text-orange-700",
  CLIENT: "bg-blue-100 text-blue-700",
  CONSULTANT: "bg-purple-100 text-purple-700",
  SUPPLIER: "bg-green-100 text-green-700",
};
const ABN_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
  NOT_VERIFIED: "bg-gray-100 text-gray-500",
};
const ASIC_COLORS: Record<string, string> = {
  REGISTERED: "bg-green-100 text-green-700",
  DEREGISTERED: "bg-red-100 text-red-700",
  NOT_CHECKED: "bg-gray-100 text-gray-500",
};
const APPROVAL_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  APPROVED: "bg-green-100 text-green-700",
  SUSPENDED: "bg-red-100 text-red-700",
  INACTIVE: "bg-gray-100 text-gray-500",
};
const TIER_LABELS: Record<string, string> = {
  TIER_1: "Tier 1",
  TIER_2: "Tier 2",
  TIER_3: "Tier 3",
};
const TIER_COLORS: Record<string, string> = {
  TIER_1: "bg-indigo-100 text-indigo-700",
  TIER_2: "bg-sky-100 text-sky-700",
  TIER_3: "bg-zinc-100 text-zinc-600",
};
const PERFORMANCE_LABELS: Record<string, string> = {
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
  UNTESTED: "Untested",
};
const PERFORMANCE_COLORS: Record<string, string> = {
  HIGH: "bg-green-100 text-green-700",
  MEDIUM: "bg-yellow-100 text-yellow-700",
  LOW: "bg-red-100 text-red-700",
  UNTESTED: "bg-gray-100 text-gray-500",
};

function formatAbn(abn: string) {
  const d = abn.replace(/\s/g, "");
  if (d.length !== 11) return abn;
  return `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8)}`;
}

function formatDate(d: Date | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

function formatFileSize(bytes: number | null | undefined) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function CompanyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await requireAppUser();
  const { id } = await params;
  const sp = await searchParams;
  const activeTab = sp.tab ?? "overview";

  const userCanDelete = canDelete(user.role);
  const userCanEdit = canEdit(user.role);

  const org = await prisma.organisation.findFirst({ select: { id: true } });

  const company = await prisma.company.findUnique({
    where: { id },
    include: {
      companyContacts: {
        include: {
          contact: true,
          associationLabel: true,
        },
        orderBy: [{ isPrimary: "desc" }, { contact: { lastName: "asc" } }],
      },
      trades: {
        include: { costCode: true },
        orderBy: { isPrimaryTrade: "desc" },
      },
      insurancePolicies: {
        include: { policyType: true },
        orderBy: { expiryDate: "asc" },
      },
      documents: {
        orderBy: { createdAt: "desc" },
      },
      notes: {
        include: { createdBy: true },
        orderBy: { createdAt: "desc" },
      },
      communications: {
        orderBy: { sentAt: "desc" },
        take: 50,
      },
      subcontractorProfile: true,
      expertiseTags: {
        include: { expertiseTag: true },
        orderBy: { expertiseTag: { name: "asc" } },
      },
      createdBy: { select: { firstName: true, lastName: true } },
    },
  });

  if (!company) notFound();

  const isSubcontractor = company.types.includes("SUBCONTRACTOR");
  const primaryTrade = company.trades.find((t) => t.isPrimaryTrade);

  // For inline contacts quick-add: load contacts NOT already linked, and association labels
  const linkedContactIds = company.companyContacts.map((cc) => cc.contactId);
  const [unlinkedContacts, associationLabels, policyTypes] = await Promise.all([
    org
      ? prisma.contact.findMany({
          where: {
            organisationId: org.id,
            isActive: true,
            id: { notIn: linkedContactIds.length > 0 ? linkedContactIds : ["00000000-0000-0000-0000-000000000000"] },
          },
          select: { id: true, firstName: true, lastName: true, jobTitle: true },
          orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        })
      : Promise.resolve([]),
    org
      ? prisma.associationLabel.findMany({
          where: { organisationId: org.id, isActive: true, associationType: "COMPANY" },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
    org
      ? prisma.insurancePolicyType.findMany({
          where: { organisationId: org.id, isActive: true },
          orderBy: { displayOrder: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const TABS = [
    { id: "overview", label: "Overview" },
    { id: "contacts", label: `Contacts (${company.companyContacts.length})` },
    { id: "trades", label: `Trade Categories (${company.trades.length})` },
    { id: "insurance", label: `Insurance (${company.insurancePolicies.length})` },
    { id: "documents", label: `Documents (${company.documents.length})` },
    { id: "communications", label: `Comms (${company.communications.length})` },
    { id: "notes", label: `Notes (${company.notes.length})` },
    { id: "performance", label: "Performance" },
    { id: "projects", label: "Projects" },
    ...(isSubcontractor ? [{ id: "subcontractor", label: "Subcontractor" }] : []),
  ];

  // Compliance banner: check for missing/expired mandatory policies
  const today = new Date();
  const mandatoryTypes = policyTypes.filter((pt) => pt.isMandatory);
  const complianceIssues: string[] = [];
  for (const mt of mandatoryTypes) {
    const existing = company.insurancePolicies.filter((p) => p.policyTypeId === mt.id && p.isCurrent);
    if (existing.length === 0) {
      complianceIssues.push(`${mt.name} — no policy on file`);
    } else {
      const allExpired = existing.every((p) => new Date(p.expiryDate) < today);
      if (allExpired) complianceIssues.push(`${mt.name} — expired`);
    }
  }

  return (
    <div>
      {/* Breadcrumb */}
      <Link href="/crm/companies" className="text-xs text-zinc-500 hover:text-zinc-800 mb-3 inline-flex items-center gap-1">
        ← Companies
      </Link>

      {/* Compliance Alert Banner */}
      {complianceIssues.length > 0 && (
        <div className="mb-4 w-full bg-amber-50 border border-amber-200 rounded-lg px-5 py-3">
          <p className="font-semibold text-sm text-amber-800">Insurance Compliance Issues</p>
          <ul className="mt-1 space-y-0.5">
            {complianceIssues.map((issue) => (
              <li key={issue} className="text-xs text-amber-700">• {issue}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Blacklist Banner */}
      {company.isBlacklisted && (
        <div className="mb-4 w-full bg-red-600 text-white rounded-lg px-5 py-3 flex items-start gap-3">
          <span className="text-base font-bold shrink-0">⚠</span>
          <div>
            <p className="font-semibold text-sm">BLACKLISTED — This company is blacklisted and must not be engaged.</p>
            {company.blacklistReason && (
              <p className="text-sm mt-0.5 text-red-100">Reason: {company.blacklistReason}</p>
            )}
            {company.blacklistedAt && (
              <p className="text-xs mt-0.5 text-red-200">Blacklisted {formatDate(company.blacklistedAt)}</p>
            )}
          </div>
        </div>
      )}

      {/* Company Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-zinc-900">{company.name}</h1>
              {!company.isActive && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Inactive</span>
              )}
            </div>
            {company.legalName && company.legalName !== company.name && (
              <p className="text-sm text-zinc-500 mt-0.5">{company.legalName}</p>
            )}
            <div className="flex gap-1.5 mt-2 flex-wrap">
              {company.types.map((t) => (
                <span key={t} className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[t] ?? "bg-gray-100 text-gray-600"}`}>
                  {TYPE_LABELS[t] ?? t}
                </span>
              ))}
              {isSubcontractor && company.subcontractorProfile && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${APPROVAL_COLORS[company.subcontractorProfile.approvalStatus]}`}>
                  {company.subcontractorProfile.approvalStatus}
                </span>
              )}
              {primaryTrade && (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-zinc-100 text-zinc-700">
                  {primaryTrade.costCode.codeDescription}
                </span>
              )}
              {company.tier && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TIER_COLORS[company.tier]}`}>
                  {TIER_LABELS[company.tier]}
                </span>
              )}
              {company.isPreferred && (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-yellow-100 text-yellow-700">★ Preferred</span>
              )}
              {company.tempLabour && (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-zinc-100 text-zinc-600">Temp Labour</span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              {company.abn && (
                <span className="font-mono text-sm text-zinc-700">{formatAbn(company.abn)}</span>
              )}
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ABN_COLORS[company.abnStatus]}`}>
                {company.abnStatus === "ACTIVE" ? "ABN Active" : company.abnStatus === "CANCELLED" ? "ABN Cancelled" : "ABN Not Verified"}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ASIC_COLORS[company.asicStatus]}`}>
                {company.asicStatus === "REGISTERED" ? "ASIC Registered" : company.asicStatus === "DEREGISTERED" ? "ASIC Deregistered" : "ASIC check unavailable"}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-500">
                Not checked — CreditorWatch credentials pending
              </span>
            </div>
          </div>
          {userCanEdit && (
            <div className="flex items-center gap-2 shrink-0">
              <Link
                href={`/crm/companies/${id}/edit`}
                className="px-3 py-1.5 text-sm font-medium text-zinc-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
              >
                Edit
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <TabNav tabs={TABS} baseHref={`/crm/companies/${id}`} />

      {activeTab === "overview" && (
        <OverviewTab
          company={company}
          companyId={id}
          unlinkedContacts={unlinkedContacts}
          associationLabels={associationLabels}
          canDeleteFlag={userCanDelete}
          canEditFlag={userCanEdit}
        />
      )}
      {activeTab === "contacts" && (
        <ContactsTab contacts={company.companyContacts} companyId={id} associationLabels={associationLabels} canDeleteFlag={userCanDelete} canEditFlag={userCanEdit} />
      )}
      {activeTab === "trades" && (
        <TradesTab trades={company.trades} companyId={id} />
      )}
      {activeTab === "insurance" && (
        <InsuranceTab
          policies={company.insurancePolicies}
          companyId={id}
          policyTypes={policyTypes}
          canEditFlag={userCanEdit}
          canDeleteFlag={userCanDelete}
        />
      )}
      {activeTab === "documents" && (
        <DocumentsTab
          documents={company.documents}
          companyId={id}
          canEditFlag={userCanEdit}
          canDeleteFlag={userCanDelete}
        />
      )}
      {activeTab === "communications" && (
        <CommunicationsTab communications={company.communications} />
      )}
      {activeTab === "notes" && (
        <NotesTab notes={company.notes} />
      )}
      {activeTab === "performance" && <PerformanceTab />}
      {activeTab === "projects" && <ProjectsTab />}
      {activeTab === "subcontractor" && isSubcontractor && (
        <SubcontractorTab
          profile={company.subcontractorProfile}
          companyId={id}
          isBlacklisted={company.isBlacklisted}
          blacklistReason={company.blacklistReason}
          blacklistedAt={company.blacklistedAt}
        />
      )}
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

type CompanyFull = Awaited<ReturnType<typeof prisma.company.findUniqueOrThrow>>;

type OverviewCompany = CompanyFull & {
  expertiseTags: Array<{ expertiseTag: { id: string; name: string; category: string } }>;
  trades: Array<{ id: string; isPrimaryTrade: boolean; costCode: { catCode: string; codeDescription: string; groupName: string } }>;
  companyContacts: Array<{
    id: string;
    companyId: string;
    contactId: string;
    position: string | null;
    isPrimary: boolean;
    isAccountContact: boolean;
    isEstimatingContact: boolean;
    associationLabelId: string | null;
    associationLabel: { id: string; name: string } | null;
    contact: {
      id: string;
      firstName: string;
      lastName: string;
      email: string | null;
      mobile: string | null;
      phoneDdi: string | null;
      jobTitle: string | null;
    };
  }>;
};

function OverviewTab({
  company,
  companyId,
  unlinkedContacts,
  associationLabels,
  canDeleteFlag,
  canEditFlag,
}: {
  company: OverviewCompany;
  companyId: string;
  unlinkedContacts: Array<{ id: string; firstName: string; lastName: string; jobTitle: string | null }>;
  associationLabels: Array<{ id: string; name: string }>;
  canDeleteFlag: boolean;
  canEditFlag: boolean;
}) {
  const addAction = addCompanyContactLink.bind(null, companyId);

  return (
    <div className="space-y-6">
      {/* Info grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {/* Contact Info */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">Contact</h3>
          <dl className="space-y-2 text-sm">
            <Row label="Phone" value={company.phoneMain} />
            <Row label="Email" value={company.emailGeneral} />
            <Row label="Website" value={company.website} isLink />
            <Row label="Payment Terms" value={company.paymentTerms} />
          </dl>
        </div>

        {/* Address */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">Address</h3>
          <dl className="space-y-2 text-sm">
            <Row
              label="Street"
              value={
                [company.addressStreet, company.addressSuburb, company.addressState, company.addressPostcode]
                  .filter(Boolean).join(", ") || null
              }
            />
            <Row
              label="Postal"
              value={
                company.postalSameAsStreet
                  ? "Same as street"
                  : [company.postalStreet, company.postalSuburb, company.postalState, company.postalPostcode]
                      .filter(Boolean).join(", ") || null
              }
            />
          </dl>
        </div>

        {/* Compliance */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">Compliance</h3>
          <dl className="space-y-2 text-sm">
            {company.abn && <Row label="ABN" value={formatAbn(company.abn)} mono />}
            {company.abnRegisteredName && <Row label="Registered Name" value={company.abnRegisteredName} />}
            <Row label="ABN Status" value={company.abnStatus} />
            <Row label="GST Registered" value={company.abnGstRegistered === true ? "Yes" : company.abnGstRegistered === false ? "No" : null} />
            <Row
              label="ASIC Status"
              value={
                company.asicStatus === "REGISTERED"
                  ? "Registered"
                  : company.asicStatus === "DEREGISTERED"
                  ? "Deregistered"
                  : "ASIC check unavailable"
              }
            />
            {company.abnVerifiedAt && <Row label="ABN Verified" value={formatDate(company.abnVerifiedAt)} />}
          </dl>
        </div>

        {/* Supplier Profile */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">Supplier Profile</h3>
          <dl className="space-y-2 text-sm">
            <Row label="Tier" value={company.tier ? TIER_LABELS[company.tier] ?? company.tier : null} />
            <Row label="Cost Level" value={company.costLevel ? { HIGH: "High", MID: "Mid", LOW: "Low" }[company.costLevel] ?? company.costLevel : null} />
            <Row label="Performance" value={company.performanceRating ? PERFORMANCE_LABELS[company.performanceRating] ?? company.performanceRating : null} />
            <div className="flex gap-2">
              <dt className="text-zinc-500 w-32 shrink-0">Preferred</dt>
              <dd className="text-zinc-800">{company.isPreferred ? "★ Yes" : "No"}</dd>
            </div>
          </dl>
          {company.expertiseTags.length > 0 && (
            <div className="mt-3">
              <p className="text-xs text-zinc-500 mb-2">Expertise Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {company.expertiseTags.map((et) => (
                  <span key={et.expertiseTag.id} className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                    {et.expertiseTag.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Meta */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">Record</h3>
          <dl className="space-y-2 text-sm">
            <Row label="Data Source" value={company.dataSource} />
            <Row label="Created" value={formatDate(company.createdAt)} />
            <Row label="Last Updated" value={formatDate(company.updatedAt)} />
          </dl>
        </div>
      </div>

      {/* Inline Contacts Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Contacts ({company.companyContacts.length})
          </h3>
          {canEditFlag && (
            <AddContactDrawer companyId={companyId} associationLabels={associationLabels} />
          )}
        </div>

        {/* Quick add row */}
        {canEditFlag && unlinkedContacts.length > 0 && (
          <form action={addAction} className="flex items-center gap-2 px-4 py-2.5 border-b border-dashed border-gray-200 bg-blue-50/30">
            <select
              name="contactId"
              className="flex-1 border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
              defaultValue=""
            >
              <option value="" disabled>Link existing contact…</option>
              {unlinkedContacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.firstName} {c.lastName}{c.jobTitle ? ` — ${c.jobTitle}` : ""}
                </option>
              ))}
            </select>
            <input
              name="position"
              placeholder="Position"
              className="w-28 border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {associationLabels.length > 0 && (
              <select
                name="associationLabelId"
                className="w-36 border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                defaultValue=""
              >
                <option value="">Label…</option>
                {associationLabels.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            )}
            <label className="flex items-center gap-1 text-xs text-zinc-600 cursor-pointer">
              <input type="checkbox" name="isAccountContact" value="true" className="rounded border-gray-300" />
              ACC
            </label>
            <label className="flex items-center gap-1 text-xs text-zinc-600 cursor-pointer">
              <input type="checkbox" name="isEstimatingContact" value="true" className="rounded border-gray-300" />
              EST
            </label>
            <button type="submit" className="px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors">
              Add
            </button>
          </form>
        )}

        {company.companyContacts.length === 0 ? (
          <div className="px-4 py-8 text-center text-zinc-400 text-sm">No contacts linked.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-2 font-medium text-zinc-500 text-xs">Name</th>
                <th className="text-left px-4 py-2 font-medium text-zinc-500 text-xs">Position</th>
                <th className="text-left px-4 py-2 font-medium text-zinc-500 text-xs">DDI</th>
                <th className="text-left px-4 py-2 font-medium text-zinc-500 text-xs">Mobile</th>
                <th className="text-left px-4 py-2 font-medium text-zinc-500 text-xs">Email</th>
                <th className="px-4 py-2 font-medium text-zinc-500 text-xs text-center">ACC</th>
                <th className="px-4 py-2 font-medium text-zinc-500 text-xs text-center">EST</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {company.companyContacts.map((cc, idx) => (
                <tr key={cc.id} className={idx < company.companyContacts.length - 1 ? "border-b border-gray-100" : ""}>
                  <td className="px-4 py-2.5">
                    <Link href={`/crm/contacts/${cc.contact.id}`} className="font-medium text-zinc-800 hover:text-blue-600">
                      {cc.contact.firstName} {cc.contact.lastName}
                    </Link>
                    {cc.isPrimary && (
                      <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">Primary</span>
                    )}
                    {cc.associationLabel && (
                      <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full bg-zinc-100 text-zinc-500">
                        {cc.associationLabel.name}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-zinc-500 text-xs">{cc.position || cc.contact.jobTitle || "—"}</td>
                  <td className="px-4 py-2.5 text-zinc-600 text-xs">{cc.contact.phoneDdi || "—"}</td>
                  <td className="px-4 py-2.5 text-zinc-600 text-xs">{cc.contact.mobile || "—"}</td>
                  <td className="px-4 py-2.5 text-zinc-600 text-xs">{cc.contact.email || "—"}</td>
                  <td className="px-4 py-2.5 text-center">
                    {cc.isAccountContact ? (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">ACC</span>
                    ) : (
                      <span className="text-zinc-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {cc.isEstimatingContact ? (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-medium">EST</span>
                    ) : (
                      <span className="text-zinc-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center gap-2 justify-end">
                      {canEditFlag && (
                        <Link
                          href={`/crm/companies/${companyId}/contacts/${cc.id}/edit`}
                          className="text-zinc-400 hover:text-blue-600 text-xs"
                          title="Edit link"
                        >
                          ✎
                        </Link>
                      )}
                      {canDeleteFlag && (
                        <ConfirmForm
                          action={removeCompanyContactLink.bind(null, companyId, cc.contactId)}
                          message={`Unlink ${cc.contact.firstName} ${cc.contact.lastName} from this company?`}
                        >
                          <button type="submit" className="text-zinc-300 hover:text-red-500 text-sm" title="Remove link">×</button>
                        </ConfirmForm>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Trade Categories */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Trade Categories</h3>
          <Link href={`/crm/companies/${companyId}?tab=trades`} className="text-xs text-blue-600 hover:underline">Manage →</Link>
        </div>
        {company.trades.length === 0 ? (
          <p className="text-xs text-zinc-400">No trade categories assigned.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {company.trades.map((t) => (
              <span
                key={t.id}
                className={`text-xs px-2.5 py-1 rounded-full border font-medium ${t.isPrimaryTrade ? "bg-orange-50 text-orange-700 border-orange-200" : "bg-zinc-50 text-zinc-600 border-zinc-200"}`}
              >
                {t.isPrimaryTrade && <span className="mr-1">★</span>}
                {t.costCode.codeDescription}
                <span className="ml-1.5 font-mono text-zinc-400">{t.costCode.catCode}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Delete Company — Director only */}
      {canDeleteFlag && (
        <div className="border border-red-200 rounded-lg p-4 bg-red-50">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-red-400 mb-2">Danger Zone</h3>
          <p className="text-xs text-zinc-600 mb-3">
            Permanently delete this company and all associated records. Contacts with no other company links will also be removed.
          </p>
          <DeleteCompanyModal
            companyId={companyId}
            companyName={company.name}
            onDelete={deleteCompanyWithContacts}
          />
        </div>
      )}
    </div>
  );
}

// ─── Shared Row helper ────────────────────────────────────────────────────────

function Row({
  label,
  value,
  mono,
  isLink,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
  isLink?: boolean;
}) {
  return (
    <div className="flex gap-2">
      <dt className="text-zinc-500 w-32 shrink-0">{label}</dt>
      <dd className={mono ? "font-mono text-zinc-700" : "text-zinc-800"}>
        {value
          ? isLink
            ? <a href={value} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate">{value}</a>
            : value
          : <span className="text-zinc-300">—</span>}
      </dd>
    </div>
  );
}

// ─── Contacts Tab ─────────────────────────────────────────────────────────────

type CompanyContactFull = {
  id: string;
  companyId: string;
  contactId: string;
  isPrimary: boolean;
  isAccountContact: boolean;
  isEstimatingContact: boolean;
  position: string | null;
  associationLabel: { id: string; name: string } | null;
  contact: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    mobile: string | null;
    jobTitle: string | null;
  };
};

function ContactsTab({
  contacts,
  companyId,
  associationLabels,
  canDeleteFlag,
  canEditFlag,
}: {
  contacts: CompanyContactFull[];
  companyId: string;
  associationLabels: Array<{ id: string; name: string }>;
  canDeleteFlag: boolean;
  canEditFlag: boolean;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-zinc-500">{contacts.length} contact{contacts.length !== 1 ? "s" : ""}</p>
        {canEditFlag && (
          <AddContactDrawer
            companyId={companyId}
            associationLabels={associationLabels}
            buttonLabel="+ Add Contact"
            buttonClassName="text-sm text-blue-600 hover:underline"
          />
        )}
      </div>
      {contacts.length === 0 ? (
        <EmptyState message="No contacts linked to this company." />
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Name</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Position</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Email</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Mobile</th>
                <th className="px-4 py-2.5 font-medium text-zinc-500 text-xs text-center">Flags</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((cc, idx) => (
                <tr key={cc.id} className={idx < contacts.length - 1 ? "border-b border-gray-100" : ""}>
                  <td className="px-4 py-2.5">
                    <Link href={`/crm/contacts/${cc.contact.id}`} className="font-medium text-zinc-800 hover:text-blue-600">
                      {cc.contact.firstName} {cc.contact.lastName}
                    </Link>
                    {cc.isPrimary && (
                      <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">Primary</span>
                    )}
                    {cc.associationLabel && (
                      <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full bg-zinc-100 text-zinc-500">
                        {cc.associationLabel.name}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-zinc-500 text-xs">{cc.position || cc.contact.jobTitle || "—"}</td>
                  <td className="px-4 py-2.5 text-zinc-600 text-xs">{cc.contact.email || "—"}</td>
                  <td className="px-4 py-2.5 text-zinc-600 text-xs">{cc.contact.mobile || "—"}</td>
                  <td className="px-4 py-2.5 text-center">
                    <div className="flex gap-1 justify-center">
                      {cc.isAccountContact && <span className="text-xs px-1 py-0.5 rounded bg-blue-100 text-blue-700">ACC</span>}
                      {cc.isEstimatingContact && <span className="text-xs px-1 py-0.5 rounded bg-purple-100 text-purple-700">EST</span>}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center gap-2 justify-end">
                      {canEditFlag && (
                        <Link href={`/crm/companies/${companyId}/contacts/${cc.id}/edit`} className="text-xs text-blue-600 hover:underline">Edit</Link>
                      )}
                      {canDeleteFlag && (
                        <ConfirmForm
                          action={removeCompanyContactLink.bind(null, companyId, cc.contactId)}
                          message={`Unlink ${cc.contact.firstName} ${cc.contact.lastName}?`}
                        >
                          <button type="submit" className="text-xs text-red-500 hover:text-red-700">Unlink</button>
                        </ConfirmForm>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Trades Tab ───────────────────────────────────────────────────────────────

type Trade = {
  id: string;
  isPrimaryTrade: boolean;
  costCode: { id: string; catCode: string; codeDescription: string; groupName: string };
};

function TradesTab({ trades, companyId }: { trades: Trade[]; companyId: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-zinc-500">{trades.length} trade{trades.length !== 1 ? "s" : ""}</p>
        <Link href={`/crm/companies/${companyId}/trades/add`} className="text-sm text-blue-600 hover:underline">
          + Add Trade
        </Link>
      </div>
      {trades.length === 0 ? (
        <EmptyState message="No trades assigned to this company." />
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">CAT Code</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Description</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Group</th>
                <th className="px-4 py-2.5 font-medium text-zinc-500 text-xs">Primary</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((t, idx) => (
                <tr key={t.id} className={idx < trades.length - 1 ? "border-b border-gray-100" : ""}>
                  <td className="px-4 py-2.5 font-mono text-xs text-zinc-700">{t.costCode.catCode}</td>
                  <td className="px-4 py-2.5 text-zinc-800">{t.costCode.codeDescription}</td>
                  <td className="px-4 py-2.5 text-xs text-zinc-500">{t.costCode.groupName}</td>
                  <td className="px-4 py-2.5 text-center">
                    {t.isPrimaryTrade && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700">Primary</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Insurance Tab ────────────────────────────────────────────────────────────

type InsurancePolicy = {
  id: string;
  insurerName: string | null;
  policyNumber: string | null;
  policyTypeId: string;
  expiryDate: Date;
  onFile: boolean;
  isCurrent: boolean;
  isVerified: boolean;
  certificateUrl: string | null;
  coverageAmount: { toString(): string } | null;
  policyType: { name: string; isMandatory: boolean };
};

function InsuranceTab({
  policies,
  companyId,
  policyTypes,
  canEditFlag,
  canDeleteFlag,
}: {
  policies: InsurancePolicy[];
  companyId: string;
  policyTypes: Array<{ id: string; name: string; isMandatory: boolean }>;
  canEditFlag: boolean;
  canDeleteFlag: boolean;
}) {
  const today = new Date();

  // Missing mandatory policy types
  const missingMandatory = policyTypes.filter(
    (pt) => pt.isMandatory && !policies.some((p) => p.policyTypeId === pt.id && p.isCurrent),
  );

  return (
    <div>
      {missingMandatory.length > 0 && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-xs font-semibold text-red-700 mb-1">Missing required insurance:</p>
          {missingMandatory.map((pt) => (
            <p key={pt.id} className="text-xs text-red-600">• {pt.name}</p>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-zinc-500">{policies.length} polic{policies.length !== 1 ? "ies" : "y"}</p>
        {canEditFlag && <AddInsurancePolicyDrawer companyId={companyId} policyTypes={policyTypes} />}
      </div>
      {policies.length === 0 ? (
        <EmptyState message="No insurance policies on file." />
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Type</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Insurer</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Policy #</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Expiry</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Coverage</th>
                <th className="px-4 py-2.5 font-medium text-zinc-500 text-xs">Status</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {policies.map((p, idx) => {
                const expiry = new Date(p.expiryDate);
                const daysLeft = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                const isExpired = daysLeft < 0;
                const isExpiringSoon = !isExpired && daysLeft <= 30;
                return (
                  <tr key={p.id} className={idx < policies.length - 1 ? "border-b border-gray-100" : ""}>
                    <td className="px-4 py-2.5">
                      <span className="text-zinc-800">{p.policyType.name}</span>
                      {p.policyType.isMandatory && (
                        <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full bg-red-50 text-red-600">Required</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-zinc-600">{p.insurerName || "—"}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-zinc-500">{p.policyNumber || "—"}</td>
                    <td className="px-4 py-2.5">
                      <span className={isExpired ? "text-red-600 font-medium" : isExpiringSoon ? "text-yellow-700 font-medium" : "text-zinc-700"}>
                        {formatDate(expiry)}
                      </span>
                      {isExpired && <span className="ml-1 text-xs text-red-500">● Expired</span>}
                      {isExpiringSoon && <span className="ml-1 text-xs text-amber-600">● {daysLeft}d</span>}
                      {!isExpired && !isExpiringSoon && <span className="ml-1 text-xs text-green-600">●</span>}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-zinc-500">
                      {p.coverageAmount ? `$${Number(p.coverageAmount.toString()).toLocaleString("en-AU")}` : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <div className="flex flex-col gap-1 items-center">
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${p.onFile ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                          {p.onFile ? "On file" : "No cert"}
                        </span>
                        {p.isVerified && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">Verified</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2 justify-end">
                        {p.certificateUrl && (
                          <a href={p.certificateUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">View</a>
                        )}
                        {canEditFlag && !p.isVerified && (
                          <form action={verifyInsurancePolicy.bind(null, p.id, companyId)}>
                            <button type="submit" className="text-xs text-zinc-500 hover:text-green-700">Verify</button>
                          </form>
                        )}
                        {canDeleteFlag && (
                          <form action={deleteInsurancePolicy.bind(null, p.id, companyId)}>
                            <button type="submit" className="text-xs text-red-400 hover:text-red-700">Delete</button>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Documents Tab ────────────────────────────────────────────────────────────

type CompanyDocument = {
  id: string; documentType: string; documentName: string; fileName: string;
  fileSizeBytes: number | null; expiryDate: Date | null; fileUrl: string; createdAt: Date;
  isVerified: boolean;
};

function DocumentsTab({
  documents,
  companyId,
  canEditFlag,
  canDeleteFlag,
}: {
  documents: CompanyDocument[];
  companyId: string;
  canEditFlag: boolean;
  canDeleteFlag: boolean;
}) {
  const today = new Date();
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-zinc-500">{documents.length} document{documents.length !== 1 ? "s" : ""}</p>
        {canEditFlag && <UploadDocumentDrawer companyId={companyId} />}
      </div>
      {documents.length === 0 ? (
        <EmptyState message="No documents uploaded." />
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Document</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Type</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Expiry</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Uploaded</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc, idx) => {
                const daysLeft = doc.expiryDate
                  ? Math.ceil((new Date(doc.expiryDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                  : null;
                const isExpired = daysLeft !== null && daysLeft < 0;
                const isExpiringSoon = daysLeft !== null && !isExpired && daysLeft <= 30;
                return (
                  <tr key={doc.id} className={idx < documents.length - 1 ? "border-b border-gray-100" : ""}>
                    <td className="px-4 py-2.5">
                      <p className="text-zinc-800 font-medium">{doc.documentName}</p>
                      <p className="text-xs text-zinc-400">{doc.fileName} {doc.fileSizeBytes ? `· ${formatFileSize(doc.fileSizeBytes)}` : ""}</p>
                      {doc.isVerified && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">Verified</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-zinc-500">{doc.documentType}</td>
                    <td className="px-4 py-2.5 text-xs">
                      {doc.expiryDate ? (
                        <span className={isExpired ? "text-red-600 font-medium" : isExpiringSoon ? "text-amber-600 font-medium" : "text-zinc-600"}>
                          {formatDate(doc.expiryDate)}
                          {isExpired && " ● Expired"}
                          {isExpiringSoon && ` ● ${daysLeft}d`}
                          {!isExpired && !isExpiringSoon && " ●"}
                        </span>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-zinc-400">{formatDate(doc.createdAt)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2 justify-end">
                        <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">View</a>
                        {canEditFlag && !doc.isVerified && (
                          <form action={verifyCompanyDocument.bind(null, doc.id, companyId)}>
                            <button type="submit" className="text-xs text-zinc-500 hover:text-green-700">Verify</button>
                          </form>
                        )}
                        {canDeleteFlag && (
                          <form action={deleteCompanyDocument.bind(null, doc.id, companyId)}>
                            <button type="submit" className="text-xs text-red-400 hover:text-red-700">Delete</button>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Communications Tab ───────────────────────────────────────────────────────

type Communication = {
  id: string; direction: string; subject: string; fromEmail: string; toEmail: string; sentAt: Date; isRead: boolean;
};

function CommunicationsTab({ communications }: { communications: Communication[] }) {
  return (
    <div>
      {communications.length === 0 ? (
        <EmptyState message="No communications recorded." />
      ) : (
        <div className="space-y-2">
          {communications.map((c) => (
            <div key={c.id} className="bg-white rounded-lg border border-gray-200 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium shrink-0 ${c.direction === "OUTBOUND" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>
                    {c.direction === "OUTBOUND" ? "Sent" : "Received"}
                  </span>
                  <p className="text-sm font-medium text-zinc-800 truncate">{c.subject}</p>
                </div>
                <span className="text-xs text-zinc-400 shrink-0">{formatDate(c.sentAt)}</span>
              </div>
              <p className="text-xs text-zinc-400 mt-1">
                {c.direction === "OUTBOUND" ? `To: ${c.toEmail}` : `From: ${c.fromEmail}`}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Notes Tab ────────────────────────────────────────────────────────────────

type Note = {
  id: string; content: string; createdAt: Date;
  createdBy: { firstName: string; lastName: string };
};

function NotesTab({ notes }: { notes: Note[] }) {
  return (
    <div>
      {notes.length === 0 ? (
        <EmptyState message="No notes yet." />
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <div key={note.id} className="bg-white rounded-lg border border-gray-200 px-4 py-3">
              <p className="text-sm text-zinc-800 whitespace-pre-wrap">{note.content}</p>
              <p className="text-xs text-zinc-400 mt-2">
                {note.createdBy.firstName} {note.createdBy.lastName} &middot; {formatDate(note.createdAt)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Performance Tab ──────────────────────────────────────────────────────────

function PerformanceTab() {
  const cards = [
    { title: "Quality Performance", body: "Quality scores will populate from ITP results and NCR history in Phase 2.", standard: "ISO 9001" },
    { title: "Safety Performance", body: "Safety scores will populate from incident history and audit results in Phase 3.", standard: "ISO 45001" },
    { title: "Environmental Performance", body: "Environmental scores will populate from environmental incident records in Phase 3.", standard: "ISO 14001" },
  ];
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {cards.map((card) => (
        <div key={card.title} className="bg-gray-50 border border-gray-200 rounded-lg p-5">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="text-sm font-semibold text-zinc-700">{card.title}</h3>
            <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-400 shrink-0 font-mono">{card.standard}</span>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">{card.body}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Projects Tab ─────────────────────────────────────────────────────────────

function ProjectsTab() {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
      <p className="text-sm font-medium text-zinc-600 mb-1">No Projects Yet</p>
      <p className="text-xs text-zinc-400 leading-relaxed max-w-sm mx-auto">
        Projects this company has been involved in will appear here in Phase 2.
      </p>
    </div>
  );
}

// ─── Subcontractor Tab ────────────────────────────────────────────────────────

type SubcontractorProfile = {
  approvalStatus: string;
  approvedAt: Date | null;
  approvalReviewDate: Date | null;
  capabilitiesStaff: boolean;
  capabilitiesAssessment: boolean;
  capabilitiesPurchases: boolean;
  capabilitiesSwms: boolean;
  portalAccessEnabled: boolean;
  portalLastLoginAt: Date | null;
} | null;

function SubcontractorTab({
  profile,
  companyId,
  isBlacklisted,
  blacklistReason,
  blacklistedAt,
}: {
  profile: SubcontractorProfile;
  companyId: string;
  isBlacklisted: boolean;
  blacklistReason: string | null;
  blacklistedAt: Date | null;
}) {
  if (!profile) return <EmptyState message="Subcontractor profile not found." />;
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">Approval</h3>
        <dl className="space-y-2 text-sm">
          <Row label="Status" value={profile.approvalStatus} />
          <Row label="Approved" value={formatDate(profile.approvedAt)} />
          <Row label="Review Date" value={formatDate(profile.approvalReviewDate)} />
        </dl>
      </div>
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">Safety Compliance</h3>
        <p className="text-xs text-zinc-400 leading-relaxed">Safety capability flags will be configured in Phase 2.</p>
      </div>
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">Portal Access</h3>
        <dl className="space-y-2 text-sm">
          <Row label="Enabled" value={profile.portalAccessEnabled ? "Yes" : "No"} />
          <Row label="Last Login" value={formatDate(profile.portalLastLoginAt)} />
        </dl>
        {!profile.portalAccessEnabled && (
          <Link href={`/crm/companies/${companyId}/portal/invite`} className="mt-3 inline-flex text-sm text-blue-600 hover:underline">
            Send portal invitation →
          </Link>
        )}
      </div>
      <div className={`rounded-lg border p-4 ${isBlacklisted ? "bg-red-50 border-red-200" : "bg-white border-gray-200"}`}>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">Blacklist</h3>
        {isBlacklisted ? (
          <div>
            <div className="flex items-start gap-2 mb-3">
              <span className="text-red-600 font-bold text-sm">BLACKLISTED</span>
            </div>
            {blacklistReason && <p className="text-xs text-zinc-600 mb-1"><span className="font-medium">Reason:</span> {blacklistReason}</p>}
            {blacklistedAt && <p className="text-xs text-zinc-400 mb-3">Since {formatDate(blacklistedAt)}</p>}
            <ConfirmForm action={unblacklistCompany.bind(null, companyId)} message="Remove this company from the blacklist?">
              <button type="submit" className="px-3 py-1.5 text-sm font-medium text-zinc-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">
                Remove from Blacklist
              </button>
            </ConfirmForm>
          </div>
        ) : (
          <div>
            <p className="text-xs text-zinc-400 leading-relaxed mb-3">
              Blacklisting prevents this company from being engaged on any project. A reason is required.
            </p>
            <BlacklistButton companyId={companyId} onBlacklist={blacklistCompany} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Shared ───────────────────────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-12 text-zinc-400">
      <p className="text-sm">{message}</p>
    </div>
  );
}
