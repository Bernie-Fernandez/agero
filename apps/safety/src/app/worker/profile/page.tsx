import { redirect } from "next/navigation";
import Link from "next/link";
import { getWorkerSession } from "@/lib/worker-auth";
import { prisma } from "@/lib/prisma";
import { ProfileForm } from "./profile-form";
import { CredentialCapture } from "./credential-capture";
import { DataDeletion } from "./data-deletion";
import type { CredDoc } from "./credential-capture";
import { DEFAULT_CREDENTIAL_CONFIG } from "@/lib/credential-config";
import type { CredentialConfigData } from "@/lib/credential-config";

function mobReadiness(
  account: { nokName: string | null; nokMobile: string | null },
  certs: { docType: string; expiryDate: Date | null }[],
  config: CredentialConfigData,
): { issues: string[]; warnings: string[] } {
  const issues: string[] = [];
  const warnings: string[] = [];

  if (!account.nokName || !account.nokMobile) {
    issues.push("Emergency contact details incomplete");
  }

  const hasIdentity = certs.some((c) => config.acceptableIdentityTypes.includes(c.docType));
  if (!hasIdentity) {
    const types = config.acceptableIdentityTypes
      .map((v) => v.replace(/_/g, " "))
      .join(", ");
    issues.push(`Identity document required (${types})`);
  }

  const hasWhiteCard = certs.some((c) => c.docType === "white_card");
  if (!hasWhiteCard) {
    issues.push("White card not on file");
  } else {
    const wc = certs.find((c) => c.docType === "white_card");
    if (wc?.expiryDate) {
      const days = (wc.expiryDate.getTime() - Date.now()) / 86400000;
      if (days < 0) issues.push("White card expired");
      else if (days < config.expiryWarnDays) warnings.push("White card expiring soon");
    }
  }

  return { issues, warnings };
}

export default async function WorkerProfilePage() {
  const session = await getWorkerSession();
  if (!session) redirect("/worker/login");

  const account = await prisma.workerAccount.findUnique({
    where: { id: session.workerAccountId },
    select: {
      mobile: true,
      firstName: true,
      lastName: true,
      trades: true,
      dateOfBirth: true,
      addressStreet: true,
      addressSuburb: true,
      addressState: true,
      addressPostcode: true,
      nokName: true,
      nokRelationship: true,
      nokMobile: true,
      medicalConditions: true,
      certDocuments: {
        select: {
          id: true,
          docType: true,
          url: true,
          credentialNumber: true,
          issuingBody: true,
          issueDate: true,
          expiryDate: true,
          aiExtractedExpiry: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!account) redirect("/worker/login");

  const pendingDeletion = await prisma.dataDeletionRequest.findFirst({
    where: { workerAccountId: session.workerAccountId, status: "PENDING" },
    select: { requestedAt: true },
  });

  // Load org credential config (global, first record); fall back to defaults
  const configRow = await prisma.credentialConfig.findFirst();
  const config: CredentialConfigData = configRow
    ? {
        acceptableIdentityTypes: configRow.acceptableIdentityTypes,
        expiryRequiredTypes: configRow.expiryRequiredTypes,
        expiryWarnDays: configRow.expiryWarnDays,
        expiryUrgentDays: configRow.expiryUrgentDays,
      }
    : DEFAULT_CREDENTIAL_CONFIG;

  const { issues: mobIssues, warnings: mobWarnings } = mobReadiness(
    account,
    account.certDocuments,
    config,
  );

  const credDocs: CredDoc[] = account.certDocuments.map((d) => ({
    id: d.id,
    docType: d.docType,
    credentialNumber: d.credentialNumber,
    issuingBody: d.issuingBody,
    issueDate: d.issueDate,
    expiryDate: d.expiryDate,
    aiExtractedExpiry: d.aiExtractedExpiry,
    url: d.url,
    createdAt: d.createdAt,
  }));

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Profile</h1>
        <Link
          href="/worker/dashboard"
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          ← Dashboard
        </Link>
      </div>

      {/* Mobilisation readiness banner */}
      {(mobIssues.length > 0 || mobWarnings.length > 0) && (
        <div
          className={`rounded-xl border p-4 ${
            mobIssues.length > 0
              ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30"
              : "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30"
          }`}
        >
          <p
            className={`text-sm font-semibold ${
              mobIssues.length > 0
                ? "text-red-700 dark:text-red-300"
                : "text-amber-700 dark:text-amber-300"
            }`}
          >
            {mobIssues.length > 0
              ? "Pre-mobilisation requirements incomplete"
              : "Pre-mobilisation action needed"}
          </p>
          <ul className="mt-1 space-y-0.5">
            {mobIssues.map((i) => (
              <li key={i} className="text-sm text-red-600 dark:text-red-400">
                · {i}
              </li>
            ))}
            {mobWarnings.map((w) => (
              <li key={w} className="text-sm text-amber-600 dark:text-amber-400">
                · {w}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-zinc-500">
            Complete the sections below to clear this warning.
          </p>
        </div>
      )}

      <ProfileForm account={account} />

      {/* Credentials & identity */}
      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            Credentials &amp; Identity
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            <strong className="font-medium">Why we collect this:</strong> OHS Regs 2017 require
            verification of licences before high-risk work. Identity documents are required for site
            access. Certificate numbers are used for compliance auditing only.
          </p>
        </div>
        <CredentialCapture docs={credDocs} config={config} />
      </section>

      <DataDeletion
        pending={!!pendingDeletion}
        pendingRequestedAt={pendingDeletion ? pendingDeletion.requestedAt.toISOString() : null}
      />
    </div>
  );
}
