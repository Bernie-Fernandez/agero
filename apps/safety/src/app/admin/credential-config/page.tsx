import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AppNav } from "@/components/app-nav";
import { requireRole } from "@/lib/auth";
import { DEFAULT_CREDENTIAL_CONFIG } from "@/lib/credential-config";
import type { CredentialConfigData } from "@/lib/credential-config";
import { CredentialConfigForm } from "./config-form";

export default async function CredentialConfigPage() {
  const user = await requireRole(["admin"]);

  const row = await prisma.credentialConfig.findUnique({
    where: { organisationId: user.organisationId },
  });

  const current: CredentialConfigData = row
    ? {
        acceptableIdentityTypes: row.acceptableIdentityTypes,
        expiryRequiredTypes: row.expiryRequiredTypes,
        expiryWarnDays: row.expiryWarnDays,
        expiryUrgentDays: row.expiryUrgentDays,
      }
    : DEFAULT_CREDENTIAL_CONFIG;

  return (
    <div className="min-h-full flex-1 bg-zinc-50 dark:bg-zinc-950">
      <AppNav currentPath="/admin" userRole={user.role} />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <Link
          href="/admin"
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          ← Admin
        </Link>

        <div className="mt-2">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Credential Settings
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Configure which identity documents are accepted, expiry alert thresholds, and
            which credential types require an expiry date. Changes apply to all worker profiles.
          </p>
        </div>

        <div className="mt-8">
          <CredentialConfigForm current={current} />
        </div>
      </main>
    </div>
  );
}
