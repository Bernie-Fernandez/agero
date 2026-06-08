import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ChecklistForm } from "./checklist-form";
import { submitChecklist } from "./actions";

export default async function MobChecklistPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const invitation = await prisma.workerInvitation.findUnique({
    where: { token },
    include: {
      project: { select: { name: true } },
      organisation: { select: { name: true } },
    },
  });

  if (!invitation) notFound();

  const isExpired = invitation.status === "PENDING" && new Date() > invitation.expiresAt;
  const isAccepted = invitation.status === "ACCEPTED";

  // Pre-fill from existing WorkerAccount if found
  const existing = await prisma.workerAccount.findUnique({
    where: { mobile: invitation.mobile },
    select: {
      firstName: true,
      lastName: true,
      whiteCardNumber: true,
      whiteCardExpiry: true,
      nokName: true,
      nokMobile: true,
      nokRelationship: true,
    },
  });

  const defaults = {
    firstName: existing?.firstName ?? "",
    lastName: existing?.lastName ?? "",
    whiteCardNo: existing?.whiteCardNumber ?? "",
    whiteCardExpiry: existing?.whiteCardExpiry
      ? existing.whiteCardExpiry.toISOString().slice(0, 10)
      : "",
    nokName: existing?.nokName ?? "",
    nokPhone: existing?.nokMobile ?? "",
    nokRelationship: existing?.nokRelationship ?? "",
  };

  const submitAction = submitChecklist.bind(null, token);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex h-14 max-w-lg items-center px-4">
          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Agero Safety</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg px-4 py-8">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Pre-Mobilisation Checklist
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {invitation.project.name} · {invitation.organisation.name}
        </p>

        {isAccepted ? (
          <div className="mt-8 rounded-xl border border-green-200 bg-green-50 p-6 dark:border-green-800 dark:bg-green-950/30">
            <p className="font-medium text-green-800 dark:text-green-300">Already submitted</p>
            <p className="mt-1 text-sm text-green-700 dark:text-green-400">
              You have already completed your pre-mobilisation checklist for this project.
            </p>
          </div>
        ) : isExpired ? (
          <div className="mt-8 rounded-xl border border-red-200 bg-red-50 p-6 dark:border-red-900 dark:bg-red-950/30">
            <p className="font-medium text-red-800 dark:text-red-300">Link expired</p>
            <p className="mt-1 text-sm text-red-700 dark:text-red-400">
              This invitation link has expired. Please contact your supervisor to request a new one.
            </p>
          </div>
        ) : (
          <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
              Please provide your details before your start date. This information is required for
              site access under Victorian OHS regulations.
            </p>
            <ChecklistForm submitAction={submitAction} defaults={defaults} />
          </div>
        )}
      </main>
    </div>
  );
}
