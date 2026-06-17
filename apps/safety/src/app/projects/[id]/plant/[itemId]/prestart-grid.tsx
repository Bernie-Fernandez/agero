"use client";

import { useActionState, useState } from "react";
import type { PlantState, PlantPreStartDay } from "../actions";

interface Props {
  weekDates: { date: string; weekday: string }[];
  initialDays: PlantPreStartDay[];
  faulted: boolean;
  submitAction: (prev: PlantState, fd: FormData) => Promise<PlantState>;
}

export function PreStartGrid({ weekDates, initialDays, faulted, submitAction }: Props) {
  const [state, formAction, pending] = useActionState(submitAction, {});
  const [days, setDays] = useState<PlantPreStartDay[]>(() =>
    weekDates.map((wd) => {
      const found = initialDays.find((d) => d.date === wd.date);
      return (
        found ?? {
          date: wd.date,
          weekday: wd.weekday,
          completed: false,
          operatorName: "",
          faultFound: false,
          notes: "",
        }
      );
    }),
  );

  function update(i: number, patch: Partial<PlantPreStartDay>) {
    setDays((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const hidden = e.currentTarget.elements.namedItem("days") as HTMLInputElement | null;
    if (hidden) hidden.value = JSON.stringify(days);
  }

  return (
    <form action={formAction} onSubmit={handleSubmit} className="space-y-4">
      {state.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-800/40 dark:bg-red-950/20 dark:text-red-300">
          {state.error}
        </div>
      )}
      {state.ok && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-700 dark:border-green-800/40 dark:bg-green-950/20 dark:text-green-300">
          Pre-start checks saved.
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
              <th className="px-3 py-2 text-left text-xs font-medium text-zinc-500">Day</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-zinc-500">Pre-start done</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-zinc-500">Operator</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-zinc-500">Fault?</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-zinc-500">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 bg-white dark:divide-zinc-800 dark:bg-zinc-900">
            {days.map((d, i) => (
              <tr key={d.date} className={d.faultFound ? "bg-red-50/40 dark:bg-red-950/10" : ""}>
                <td className="px-3 py-2">
                  <p className="font-medium text-zinc-900 dark:text-zinc-50">{d.weekday}</p>
                  <p className="text-xs text-zinc-400">{new Date(d.date).toLocaleDateString("en-AU")}</p>
                </td>
                <td className="px-3 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={d.completed}
                    onChange={(e) => update(i, { completed: e.target.checked })}
                    className="h-4 w-4"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={d.operatorName}
                    onChange={(e) => update(i, { operatorName: e.target.value })}
                    className="w-full rounded-lg border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-800"
                  />
                </td>
                <td className="px-3 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={d.faultFound}
                    onChange={(e) => update(i, { faultFound: e.target.checked })}
                    className="h-4 w-4 accent-red-600"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={d.notes}
                    onChange={(e) => update(i, { notes: e.target.value })}
                    placeholder={d.faultFound ? "Describe the fault…" : ""}
                    className="w-full rounded-lg border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-800"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-zinc-500">
        Recording a fault on any day automatically flags this plant as faulted — it cannot be used until a
        manager resolves the fault.
      </p>

      <input type="hidden" name="days" />
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 disabled:opacity-60"
      >
        {pending ? "Saving…" : faulted ? "Save (plant currently faulted)" : "Save pre-start checks"}
      </button>
    </form>
  );
}
