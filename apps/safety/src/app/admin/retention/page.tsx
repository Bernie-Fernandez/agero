import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AppNav } from "@/components/app-nav";
import { requireRole } from "@/lib/auth";
import { RetentionActions } from "./retention-actions";
import { DeletionRequestActions } from "./deletion-request-actions";

export default async function RetentionPage() {
  const user = await requireRole(["admin"]);

  const [flags, deletionRequests, auditLog] = await Promise.all([
    prisma.retentionFlag.findMany({
      where: { resolution: null },
      orderBy: { flaggedAt: "asc" },
      include: {
        workerAccount: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            mobile: true,
            lastActiveAt: true,
            createdAt: true,
          },
        },
      },
    }),
    prisma.dataDeletionRequest.findMany({
      where: { status: "PENDING" },
      orderBy: { requestedAt: "asc" },
      include: { workerAccount: { select: { firstName: true, lastName: true, mobile: true } } },
    }),
    prisma.dataRetentionLog.findMany({
      orderBy: { occurredAt: "desc" },
      take: 25,
    }),
  ]);

  return (
    <div className="min-h-full flex-1 bg-zinc-50 dark:bg-zinc-950">
      <AppNav currentPath="/admin" userRole={user.role} />
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <Link href="/admin" className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
          ← Admin
        </Link>

        <div className="mt-2">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Data Retention Review</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Workers inactive for 2+ years flagged for review under APP 11 (Privacy Act 1988).
            Anonymise to remove personal information while retaining the OHS audit trail, or Dismiss if retention is justified.
          </p>
        </div>

        {/* Worker-initiated deletion requests */}
        {deletionRequests.length > 0 && (
          <div className="mt-8">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Worker deletion requests ({deletionRequests.length})
            </h2>
            <p className="mt-0.5 text-xs text-zinc-500">Worker-initiated under APP 11 — approve to anonymise now.</p>
            <div className="mt-3 space-y-3">
              {deletionRequests.map((r) => {
                const w = r.workerAccount;
                const masked = w.mobile.length > 7 ? w.mobile.slice(0, 4) + "*".repeat(w.mobile.length - 7) + w.mobile.slice(-3) : "*".repeat(w.mobile.length);
                return (
                  <div key={r.id} className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-amber-800 dark:bg-amber-950/20">
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{w.firstName} {w.lastName}</p>
                      <p className="font-mono text-xs text-zinc-500">{masked}</p>
                      <p className="text-xs text-zinc-400">Requested {r.requestedAt.toLocaleDateString("en-AU")}{r.reason ? ` · ${r.reason}` : ""}</p>
                    </div>
                    <DeletionRequestActions requestId={r.id} />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {flags.length === 0 ? (
          <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">No workers pending review</p>
            <p className="mt-1 text-sm text-zinc-500">
              The nightly job will flag workers when they reach 2 years of inactivity.
            </p>
          </div>
        ) : (
          <div className="mt-8 space-y-3">
            {flags.map((flag) => {
              const w = flag.workerAccount;
              const lastActive = w.lastActiveAt
                ? w.lastActiveAt.toLocaleDateString("en-AU")
                : `Never (registered ${w.createdAt.toLocaleDateString("en-AU")})`;
              const maskedMobile =
                w.mobile.length > 7
                  ? w.mobile.slice(0, 4) + "*".repeat(w.mobile.length - 7) + w.mobile.slice(-3)
                  : "*".repeat(w.mobile.length);

              return (
                <div
                  key={flag.id}
                  className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                      {w.firstName} {w.lastName}
                    </p>
                    <p className="font-mono text-xs text-zinc-500">{maskedMobile}</p>
                    <p className="text-xs text-zinc-400">Last active: {lastActive}</p>
                    <p className="text-xs text-zinc-400">
                      Flagged: {flag.flaggedAt.toLocaleDateString("en-AU")}
                    </p>
                  </div>
                  <RetentionActions flagId={flag.id} workerName={`${w.firstName} ${w.lastName}`} />
                </div>
              );
            })}
          </div>
        )}

        {/* Audit trail */}
        <div className="mt-10">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Retention audit trail</h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            Full record of anonymisation and deletion actions. A quarterly summary is emailed to Directors automatically.
          </p>
          {auditLog.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">No retention actions recorded yet.</p>
          ) : (
            <div className="mt-3 overflow-hidden rounded-xl border border-zinc-200 bg-white divide-y divide-zinc-100 dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
              {auditLog.map((l) => (
                <div key={l.id} className="flex items-center justify-between px-5 py-2.5 text-xs">
                  <div>
                    <span
                      className={`mr-2 rounded-full px-2 py-0.5 font-medium ${
                        l.action === "ANONYMISED"
                          ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                          : l.action === "DISMISSED"
                            ? "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                      }`}
                    >
                      {l.action}
                    </span>
                    <span className="font-mono text-zinc-500">{l.subjectLabel}</span>
                    <span className="ml-2 text-zinc-400">{l.source.replace(/_/g, " ").toLowerCase()}</span>
                  </div>
                  <span className="text-zinc-400">
                    {l.performedByName} · {l.occurredAt.toLocaleDateString("en-AU")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-10 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">What does Anonymise do?</h2>
          <ul className="mt-2 space-y-1 text-sm text-zinc-500">
            <li>· Replaces name, mobile, address, date of birth, NOK details, and medical information with placeholder values</li>
            <li>· Deletes all uploaded credential documents and active sessions</li>
            <li>· Anonymises project sign-in records (Worker rows) while preserving timestamps for the OHS audit trail</li>
            <li>· This action is irreversible</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
