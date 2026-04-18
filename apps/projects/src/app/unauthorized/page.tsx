import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-zinc-900 mb-2">Access Denied</h1>
        <p className="text-zinc-500 mb-6">You do not have permission to view this page.</p>
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          Return to home
        </Link>
      </div>
    </main>
  );
}
