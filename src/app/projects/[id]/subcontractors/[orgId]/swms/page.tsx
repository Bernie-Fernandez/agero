import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AppNav } from "@/components/app-nav";
import { SwmsUploadForm } from "./swms-upload-form";
import { ReviewForm } from "./review-form";
import { uploadSwmsForReview, approveSwms, rejectSwms } from "./actions";

export default async function SwmsPage({
  params,
}: {
  params: Promise<{ id: string; orgId: string }>;
}) {
  const { id: projectId, orgId } = await params;
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const appUser = await prisma.user.findUnique({ where: { clerkUserId: userId } });
  if (!appUser) redirect("/onboarding");

  const [project, org] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId } }),
    prisma.organisation.findUnique({ where: { id: orgId } }),
  ]);

  if (!project || !org) notFound();
  if (project.organisationId !== appUser.organisationId) notFound();

  const submissions = await prisma.swmsSubmission.findMany({
    where: { projectId, organisationId: orgId },
    orderBy: { versionNumber: "desc" },
  });

  const latest = submissions[0];

  const uploadAction = uploadSwmsForReview.bind(null, projectId, orgId);
  const approveAction = latest ? approveSwms.bind(null, latest.id, projectId, orgId) : null;
  const rejectAction = latest ? rejectSwms.bind(null, latest.id, projectId, orgId) : null;

  return (
    <div className="min-h-full flex-1 bg-zinc-50 dark:bg-zinc-950">
      <AppNav currentPath="/projects" />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Link href={`/projects/${projectId}`} className="text-sm text-zinc-500 hover:text-zinc-700">
          ← {project.name}
        </Link>
        <div className="mt-2 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">SWMS Review</h1>
            <p className="mt-1 text-sm text-zinc-500">{org.name} · {project.name}</p>
          </div>
          {latest && (
            <span className={`mt-1 rounded-full px-3 py-1 text-sm font-medium ${
              latest.status === "approved" ? "bg-green-100 text-green-700" :
              latest.status === "rejected" ? "bg-red-100 text-red-700" :
              "bg-amber-100 text-amber-700"
            }`}>
              {latest.status === "approved" ? "Approved" : latest.status === "rejected" ? "Rejected" : "Pending review"}
            </span>
          )}
        </div>

        {/* Upload form — always visible, used for initial submission and resubmissions */}
        <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-4">
            {latest ? `Submit new version (v${(latest.versionNumber ?? 0) + 1})` : "Upload SWMS"}
          </h2>
          <SwmsUploadForm uploadAction={uploadAction} />
        </div>

        {/* Latest submission review */}
        {latest && approveAction && rejectAction && (
          <div className="mt-6">
            <div className="mb-4 flex items-center gap-3">
              <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
                Version {latest.versionNumber}
              </h2>
              <span className="text-xs text-zinc-400">
                Submitted {new Date(latest.submittedAt).toLocaleDateString("en-AU")}
              </span>
              {latest.fileUrl && (
                <a href={latest.fileUrl} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline dark:text-blue-400">
                  View PDF →
                </a>
              )}
            </div>

            {/* Embedded PDF viewer */}
            {latest.fileUrl && (
              <div className="mb-6 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
                <iframe
                  src={latest.fileUrl}
                  className="w-full"
                  style={{ height: "600px" }}
                  title="SWMS document"
                />
              </div>
            )}

            <ReviewForm
              submission={{
                ...latest,
                reviewedAt: latest.reviewedAt,
              }}
              approveAction={approveAction}
              rejectAction={rejectAction}
            />
          </div>
        )}

        {/* Version history */}
        {submissions.length > 1 && (
          <div className="mt-8">
            <h2 className="text-sm font-medium text-zinc-500 mb-3">Previous versions</h2>
            <ul className="space-y-2">
              {submissions.slice(1).map((s) => (
                <li key={s.id} className="flex items-center gap-3 rounded-lg border border-zinc-100 bg-white px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-900">
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">v{s.versionNumber}</span>
                  <span className="text-zinc-400">{new Date(s.submittedAt).toLocaleDateString("en-AU")}</span>
                  <span className={`rounded px-1.5 py-0.5 text-xs ${
                    s.status === "approved" ? "bg-green-100 text-green-700" :
                    s.status === "rejected" ? "bg-red-100 text-red-700" :
                    "bg-amber-100 text-amber-700"
                  }`}>{s.status}</span>
                  {s.fileUrl && (
                    <a href={s.fileUrl} target="_blank" rel="noopener noreferrer"
                      className="ml-auto text-xs text-blue-600 hover:underline">PDF →</a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </div>
  );
}
