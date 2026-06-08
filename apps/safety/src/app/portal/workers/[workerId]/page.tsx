import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AppNav } from "@/components/app-nav";
import { requireRole } from "@/lib/auth";
import { CredentialSection } from "@/app/projects/[id]/readiness/worker/[workerId]/credential-section";

export default async function PortalWorkerPage({
  params,
}: {
  params: Promise<{ workerId: string }>;
}) {
  const { workerId } = await params;
  const appUser = await requireRole(["subcontractor_admin"]);

  const worker = await prisma.worker.findUnique({
    where: { id: workerId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      trade: true,
      employingOrganisationId: true,
      projectId: true,
      credentials: {
        select: {
          id: true,
          credentialType: true,
          credentialNumber: true,
          issuingBody: true,
          issueDate: true,
          expiryDate: true,
          isVerified: true,
          photoUrl: true,
          notes: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!worker) notFound();

  // Enforce org ownership — subcontractor_admin can only see their own workers
  if (worker.employingOrganisationId !== appUser.organisationId) {
    notFound();
  }

  // Look up SafetyProject for revalidation in credential-actions
  const safetyProject = await prisma.safetyProject.findUnique({
    where: { erpProjectId: worker.projectId },
    select: { id: true },
  });

  return (
    <div className="min-h-full flex-1 bg-zinc-50 dark:bg-zinc-950">
      <AppNav currentPath="/portal" userRole={appUser.role} />
      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <Link
          href="/portal"
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          ← Workers
        </Link>
        <div className="mt-2">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            {worker.firstName} {worker.lastName}
          </h1>
          {worker.trade && (
            <p className="mt-1 text-sm text-zinc-500">{worker.trade}</p>
          )}
        </div>

        <CredentialSection
          workerId={worker.id}
          safetyProjectId={safetyProject?.id ?? ""}
          initialCredentials={worker.credentials}
          canEdit={true}
        />
      </main>
    </div>
  );
}
