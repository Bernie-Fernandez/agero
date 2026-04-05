import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { AppNav } from "@/components/app-nav";
import { ComplianceBadge } from "@/components/compliance-badge";
import { calcOrgCompliance } from "@/lib/compliance";
import { DocumentType } from "@/generated/prisma/client";
import { requireRole, AGERO_ROLES } from "@/lib/auth";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const appUser = await requireRole(AGERO_ROLES);

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      documents: true,
      subcontractors: {
        include: {
          subcontractorOrg: {
            include: {
              documents: true,
            },
          },
        },
      },
      inductionTemplates: { where: { isActive: true } },
      _count: { select: { workers: true, siteVisits: true } },
    },
  });

  if (!project || project.organisationId !== appUser.organisationId) notFound();

  const host = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const qrUrl = `${host}/site/${project.token}`;
  const qrDataUrl = await QRCode.toDataURL(qrUrl, { width: 200, margin: 2 });

  const swms = project.documents.find((d) => d.type === DocumentType.swms);

  const siteInduction = project.inductionTemplates.find(
    (t) => t.type === "site_specific",
  );

  return (
    <div className="min-h-full flex-1 bg-zinc-50 dark:bg-zinc-950">
      <AppNav currentPath="/projects" userRole={appUser.role} />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div className="flex items-start justify-between">
          <div>
            <Link href="/projects" className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
              ← Projects
            </Link>
            <h1 className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{project.name}</h1>
            {project.address && (
              <p className="mt-1 text-sm text-zinc-500">{project.address}</p>
            )}
          </div>
          <div className="flex gap-2">
            <Link
              href={`/projects/${id}/attendance`}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
            >
              Attendance
            </Link>
            <Link
              href={`/projects/${id}/induction`}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
            >
              Site induction
            </Link>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          {/* QR Code */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Site QR code</h2>
            <p className="mt-1 text-xs text-zinc-500">Workers scan to sign in</p>
            <div className="mt-4 flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt="Site QR code" className="rounded-lg" width={160} height={160} />
            </div>
            <p className="mt-3 text-center text-xs text-zinc-400 break-all">{qrUrl}</p>
          </div>

          {/* SWMS */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">SWMS</h2>
            <p className="mt-1 text-xs text-zinc-500">Safe Work Method Statement</p>
            {swms ? (
              <div className="mt-3 space-y-2">
                <a
                  href={swms.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-sm text-blue-600 hover:underline dark:text-blue-400"
                >
                  View document →
                </a>
                {swms.expiryDate && (
                  <p className="text-xs text-zinc-500">
                    Expires {new Date(swms.expiryDate).toLocaleDateString("en-AU")}
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">No SWMS uploaded</p>
            )}
            <Link
              href={`/projects/${id}/induction`}
              className="mt-3 block text-xs text-zinc-500 hover:text-zinc-700"
            >
              Upload SWMS via induction page →
            </Link>
          </div>

          {/* Stats */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Overview</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-zinc-500">Workers</dt>
                <dd className="font-medium text-zinc-900 dark:text-zinc-50">{project._count.workers}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-500">Site sign-ins</dt>
                <dd className="font-medium text-zinc-900 dark:text-zinc-50">{project._count.siteVisits}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-500">Subcontractors</dt>
                <dd className="font-medium text-zinc-900 dark:text-zinc-50">{project.subcontractors.length}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-500">Site induction</dt>
                <dd>{siteInduction ? (
                  <span className="text-green-600 dark:text-green-400">Active</span>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400">Not set up</span>
                )}</dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Subcontractors on this project */}
        <div className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">Subcontractors on this project</h2>
          </div>
          {project.subcontractors.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">None yet. Add subcontractors from the{" "}
              <Link href="/organisations" className="text-blue-600 hover:underline">Subcontractors</Link> page.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {project.subcontractors.map(({ subcontractorOrg }) => {
                const { status, reasons } = calcOrgCompliance(subcontractorOrg);
                return (
                  <li key={subcontractorOrg.id} className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-5 py-3 dark:border-zinc-800 dark:bg-zinc-900">
                    <div>
                      <Link href={`/organisations/${subcontractorOrg.id}`} className="font-medium text-zinc-900 hover:underline dark:text-zinc-50">
                        {subcontractorOrg.name}
                      </Link>
                      {subcontractorOrg.tradeCategory && (
                        <p className="text-xs text-zinc-500">{subcontractorOrg.tradeCategory}</p>
                      )}
                    </div>
                    <ComplianceBadge status={status} reasons={reasons} />
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
