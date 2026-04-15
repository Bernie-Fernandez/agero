"use client";

export function AttendanceDatePicker({
  projectId,
  value,
}: {
  projectId: string;
  value: string;
}) {
  return (
    <input
      type="date"
      defaultValue={value}
      onChange={(e) => {
        window.location.href = `/projects/${projectId}/attendance?date=${e.target.value}`;
      }}
      className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
    />
  );
}
