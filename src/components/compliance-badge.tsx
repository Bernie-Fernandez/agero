import type { RagStatus } from "@/lib/compliance";

export function ComplianceBadge({
  status,
  reasons,
}: {
  status: RagStatus;
  reasons?: string[];
}) {
  const styles: Record<RagStatus, string> = {
    green:
      "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800",
    amber:
      "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
    red: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800",
  };

  const labels: Record<RagStatus, string> = {
    green: "Compliant",
    amber: "Action needed",
    red: "Non-compliant",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}
      title={reasons?.join("\n")}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {labels[status]}
    </span>
  );
}
