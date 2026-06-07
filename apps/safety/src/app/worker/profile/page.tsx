import { redirect } from "next/navigation";
import Link from "next/link";
import { getWorkerSession } from "@/lib/worker-auth";
import { prisma } from "@/lib/prisma";
import { ProfileForm } from "./profile-form";
import { CertUpload } from "./cert-upload";

const WARN_MS = 30 * 24 * 60 * 60 * 1000;

function mobReadiness(account: {
  whiteCardNumber: string | null;
  whiteCardExpiry: Date | null;
  nokName: string | null;
  nokMobile: string | null;
}): { issues: string[]; warnings: string[] } {
  const issues: string[] = [];
  const warnings: string[] = [];
  if (!account.whiteCardNumber) issues.push("White card number not recorded");
  else if (account.whiteCardExpiry) {
    const ms = account.whiteCardExpiry.getTime() - Date.now();
    if (ms < 0) issues.push("White card expired");
    else if (ms < WARN_MS) warnings.push("White card expiring soon");
  }
  if (!account.nokName || !account.nokMobile) issues.push("Next-of-kin details incomplete");
  return { issues, warnings };
}

function certStatus(expiry: Date | null): "green" | "amber" | "red" {
  if (!expiry) return "red";
  const ms = expiry.getTime() - Date.now();
  if (ms < 0) return "red";
  if (ms < 30 * 24 * 60 * 60 * 1000) return "amber";
  return "green";
}

export default async function WorkerProfilePage() {
  const session = await getWorkerSession();
  if (!session) redirect("/worker/login");

  const account = await prisma.workerAccount.findUnique({
    where: { id: session.workerAccountId },
    include: { certDocuments: { orderBy: { createdAt: "desc" } } },
  });

  if (!account) redirect("/worker/login");

  const { issues: mobIssues, warnings: mobWarnings } = mobReadiness(account);

  const statusColour = {
    green: "text-green-700 dark:text-green-400",
    amber: "text-amber-700 dark:text-amber-400",
    red: "text-red-600 dark:text-red-400",
  };

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
        <div className={`rounded-xl border p-4 ${mobIssues.length > 0 ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30" : "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30"}`}>
          <p className={`text-sm font-semibold ${mobIssues.length > 0 ? "text-red-700 dark:text-red-300" : "text-amber-700 dark:text-amber-300"}`}>
            {mobIssues.length > 0 ? "Pre-mobilisation requirements incomplete" : "Pre-mobilisation action needed"}
          </p>
          <ul className="mt-1 space-y-0.5">
            {mobIssues.map((i) => (
              <li key={i} className="text-sm text-red-600 dark:text-red-400">· {i}</li>
            ))}
            {mobWarnings.map((w) => (
              <li key={w} className="text-sm text-amber-600 dark:text-amber-400">· {w}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-zinc-500">Complete the fields below to clear this warning.</p>
        </div>
      )}

      <ProfileForm account={account} />

      {/* Uploaded documents */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          Upload licence / certificate
        </h2>
        <CertUpload />

        {account.certDocuments.length > 0 && (
          <ul className="space-y-2">
            {account.certDocuments.map((doc) => {
              const status = certStatus(doc.expiryDate);
              return (
                <li
                  key={doc.id}
                  className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900"
                >
                  <div>
                    <p className="text-sm font-medium capitalize text-zinc-900 dark:text-zinc-50">
                      {doc.docType.replace(/_/g, " ")}
                    </p>
                    {doc.filename && (
                      <p className="text-xs text-zinc-400 dark:text-zinc-500">{doc.filename}</p>
                    )}
                    {doc.expiryDate && (
                      <p className={`text-xs font-medium ${statusColour[status]}`}>
                        {doc.aiExtractedExpiry ? "AI-extracted · " : ""}
                        Expires {new Date(doc.expiryDate).toLocaleDateString("en-AU")}
                      </p>
                    )}
                  </div>
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                  >
                    View
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
