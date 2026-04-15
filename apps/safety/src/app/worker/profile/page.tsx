import { redirect } from "next/navigation";
import Link from "next/link";
import { getWorkerSession } from "@/lib/worker-auth";
import { prisma } from "@/lib/prisma";
import { ProfileForm } from "./profile-form";
import { CertUpload } from "./cert-upload";

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
