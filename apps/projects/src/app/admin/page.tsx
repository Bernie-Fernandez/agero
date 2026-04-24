import Link from "next/link";
import { prisma } from "@/lib/prisma";

const SECTIONS = [
  {
    title: "Cost Codes",
    href: "/admin/cost-codes",
    description: "Manage cost code structure loaded from CAT Cloud. Used for job costing and trade categories.",
  },
  {
    title: "Insurance Types",
    href: "/admin/insurance-types",
    description: "Define insurance policy types required from subcontractors (e.g. Public Liability, Workers Compensation).",
  },
  {
    title: "Payment Terms",
    href: "/admin/payment-terms",
    description: "Manage payment term options used when creating company records.",
  },
  {
    title: "Alert Thresholds",
    href: "/admin/thresholds",
    description: "Set how many days before expiry to trigger insurance and document alerts.",
  },
  {
    title: "Contact Types",
    href: "/admin/contact-types",
    description: "Manage contact type and sub-type dropdown options used when creating contact records.",
  },
  {
    title: "Association Labels",
    href: "/admin/association-labels",
    description: "Manage labels that describe how a contact relates to a company, project, or another contact.",
  },
  {
    title: "Expertise Tags",
    href: "/admin/expertise-tags",
    description: "Manage supplier expertise tags used to classify company capabilities (grouped by category).",
  },
  {
    title: "Users",
    href: "/admin/users",
    description: "Manage staff accounts, roles, and access within Agero ERP.",
  },
  {
    title: "Audit Trail",
    href: "/admin/audit",
    description: "View all system events — creates, updates, deletes, permission changes.",
  },
];

export default async function AdminPage() {
  const [costCodeCount, insTypeCount, ptCount, thresholdCount, contactTypeCount, assocLabelCount, expertiseTagCount, userCount, auditCount] = await Promise.all([
    prisma.costCode.count(),
    prisma.insurancePolicyType.count(),
    prisma.paymentTerm.count(),
    prisma.alertThreshold.count(),
    prisma.contactType.count(),
    prisma.associationLabel.count(),
    prisma.expertiseTag.count(),
    prisma.user.count(),
    prisma.auditLog.count(),
  ]);

  const counts: Record<string, number> = {
    "Cost Codes": costCodeCount,
    "Insurance Types": insTypeCount,
    "Payment Terms": ptCount,
    "Alert Thresholds": thresholdCount,
    "Contact Types": contactTypeCount,
    "Association Labels": assocLabelCount,
    "Expertise Tags": expertiseTagCount,
    "Users": userCount,
    "Audit Trail": auditCount,
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-900 mb-1">Admin Panel</h1>
      <p className="text-sm text-zinc-500 mb-8">Director-only settings for Agero ERP.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {SECTIONS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="block bg-white border border-gray-200 rounded-lg p-5 hover:border-blue-400 hover:shadow-sm transition-all"
          >
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold text-zinc-900 text-sm">{s.title}</h2>
              {counts[s.title] !== undefined && (
                <span className="text-xs bg-zinc-100 text-zinc-600 rounded-full px-2 py-0.5 font-medium">
                  {counts[s.title]}
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed">{s.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
