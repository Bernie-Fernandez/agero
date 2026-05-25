import Link from "next/link";

const MODULE_LABELS: Record<string, string> = {
  admin: "Admin",
  finance: "Finance",
  estimating: "Estimating",
  crm: "CRM",
  project_delivery: "Project Delivery",
  safety: "Safety",
  marketing: "Marketing",
  design_studio: "Design Studio",
};

export default async function UnauthorizedPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string; module?: string }>;
}) {
  const sp = await searchParams;
  const isModuleDisabled = sp.reason === "module_disabled";
  const moduleLabel = sp.module ? (MODULE_LABELS[sp.module] ?? sp.module) : null;

  if (isModuleDisabled) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-zinc-900 mb-2">
            This module is not yet available.
          </h1>
          <p className="text-zinc-500 mb-6">
            {moduleLabel
              ? `The ${moduleLabel} module is currently disabled.`
              : "This module is currently disabled."}{" "}
            If you believe you need access, contact the Director.
          </p>
          <Link href="/" className="text-sm text-blue-600 hover:underline">
            Return to home
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-zinc-900 mb-2">Access Denied</h1>
        <p className="text-zinc-500 mb-6">
          You do not have permission to view this page. Contact the Director if
          you believe this is incorrect.
        </p>
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          Return to home
        </Link>
      </div>
    </main>
  );
}
