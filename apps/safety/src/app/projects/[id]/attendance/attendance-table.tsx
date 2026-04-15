"use client";

import { useState } from "react";
import { signOutWorker, verifyVisit } from "./actions";

type Visit = {
  id: string;
  signedInAt: Date;
  signedOutAt: Date | null;
  photoUrl: string | null;
  verified: boolean;
  verifiedBy: string | null;
  isUnknown: boolean;
  worker: {
    firstName: string;
    lastName: string;
    employingOrganisation: { name: string } | null;
  };
  alert: { alertedAt: Date; escalatedAt: Date | null } | null;
};

type Filter = "all" | "on_site" | "signed_out" | "unverified";

function formatTime(date: Date) {
  return new Date(date).toLocaleTimeString("en-AU", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Australia/Melbourne",
  });
}

export function AttendanceTable({
  visits,
  projectId,
}: {
  visits: Visit[];
  projectId: string;
}) {
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = visits.filter((v) => {
    if (filter === "on_site") return v.signedOutAt === null;
    if (filter === "signed_out") return v.signedOutAt !== null;
    if (filter === "unverified") return !v.verified;
    return true;
  });

  const counts = {
    all: visits.length,
    on_site: visits.filter((v) => v.signedOutAt === null).length,
    signed_out: visits.filter((v) => v.signedOutAt !== null).length,
    unverified: visits.filter((v) => !v.verified).length,
  };

  const tabs: { key: Filter; label: string }[] = [
    { key: "all", label: `All (${counts.all})` },
    { key: "on_site", label: `On site (${counts.on_site})` },
    { key: "signed_out", label: `Signed out (${counts.signed_out})` },
    { key: "unverified", label: `Unverified (${counts.unverified})` },
  ];

  return (
    <>
      {/* Filter tabs + print */}
      <div className="mt-4 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`rounded-md px-3 py-1.5 text-sm transition ${
                filter === tab.key
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => window.print()}
          className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 print:hidden"
        >
          Print / PDF
        </button>
      </div>

      {filtered.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-500">No records for this filter.</p>
      ) : (
        <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Worker</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Company</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Sign in</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Sign out</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 print:hidden">Photo</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 print:hidden">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {filtered.map((v) => (
                <tr key={v.id}>
                  <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">
                    {v.worker.firstName} {v.worker.lastName}
                    {v.isUnknown && (
                      <span className="ml-2 rounded-full bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700">
                        Unknown
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-500">
                    {v.worker.employingOrganisation?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{formatTime(v.signedInAt)}</td>
                  <td className="px-4 py-3 text-zinc-500">
                    {v.signedOutAt ? formatTime(v.signedOutAt) : <span className="text-zinc-300">—</span>}
                  </td>
                  <td className="px-4 py-3 print:hidden">
                    {v.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={v.photoUrl}
                        alt="Sign-in photo"
                        className="h-8 w-8 rounded-full object-cover"
                      />
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {v.verified ? (
                      <span className="text-xs text-green-600 dark:text-green-400">
                        Verified{v.verifiedBy ? ` · ${v.verifiedBy}` : ""}
                      </span>
                    ) : v.alert?.escalatedAt ? (
                      <span className="text-xs font-medium text-red-600 dark:text-red-400">Escalated</span>
                    ) : v.alert ? (
                      <span className="text-xs text-amber-600 dark:text-amber-400">Awaiting verification</span>
                    ) : (
                      <span className="text-xs text-zinc-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 print:hidden">
                    <div className="flex gap-2">
                      {v.signedOutAt === null && (
                        <form action={signOutWorker.bind(null, v.id, projectId)}>
                          <button
                            type="submit"
                            className="rounded border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
                          >
                            Sign out
                          </button>
                        </form>
                      )}
                      {!v.verified && (
                        <form action={verifyVisit.bind(null, v.id, projectId)}>
                          <button
                            type="submit"
                            className="rounded border border-green-200 bg-green-50 px-2 py-1 text-xs text-green-700 hover:bg-green-100 dark:border-green-800 dark:bg-green-950/30"
                          >
                            Verify
                          </button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
