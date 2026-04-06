import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { RegistrationForm } from "./registration-form";
import { completeRegistration, checkAbn } from "./actions";

export default async function RegisterPage({
  params,
}: {
  params: Promise<{ inviteToken: string }>;
}) {
  const { inviteToken } = await params;

  const invitation = await prisma.invitation.findUnique({
    where: { token: inviteToken },
  });

  if (!invitation) notFound();

  const isExpired = invitation.status === "expired" || new Date() > invitation.expiresAt;
  const isUsed = invitation.status === "registered";

  const registerAction = completeRegistration.bind(null, inviteToken);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex h-14 max-w-3xl items-center px-4">
          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Agero Safety</span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Register your company
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Complete your registration to join the Agero Safety platform.
        </p>

        {isUsed ? (
          <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="font-medium text-zinc-900 dark:text-zinc-50">Already registered</p>
            <p className="mt-1 text-sm text-zinc-500">
              {invitation.companyName} has already completed registration.
            </p>
          </div>
        ) : isExpired ? (
          <div className="mt-8 rounded-xl border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-950/30">
            <p className="font-medium text-red-800 dark:text-red-300">Invitation expired</p>
            <p className="mt-1 text-sm text-red-700 dark:text-red-400">
              This invitation link has expired. Please contact your head contractor to request a new one.
            </p>
          </div>
        ) : (
          <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
              You&apos;ve been invited by <span className="font-medium text-zinc-900 dark:text-zinc-50">{invitation.invitedBy}</span> to register <span className="font-medium text-zinc-900 dark:text-zinc-50">{invitation.companyName}</span>.
            </p>
            <RegistrationForm
              registerAction={registerAction}
              abnCheckAction={checkAbn}
              invitation={{
                companyName: invitation.companyName,
                contactName: invitation.contactName,
                email: invitation.email,
              }}
            />
          </div>
        )}
      </main>
    </div>
  );
}
