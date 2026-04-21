import { SignIn } from '@clerk/nextjs';

export default async function PortalLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ registered?: string }>;
}) {
  const { registered } = await searchParams;

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center px-4">
      <div className="mb-6 text-center">
        <div className="inline-flex flex-col leading-none mb-1">
          <span className="text-2xl font-bold text-zinc-900 tracking-tight">AGERO</span>
          <span className="text-[10px] font-medium text-zinc-400 tracking-widest uppercase">Subcontractor Portal</span>
        </div>
        <p className="text-sm text-zinc-500 mt-2">Sign in to manage your workers and documents</p>
      </div>

      {registered && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-700 max-w-sm w-full text-center">
          Account created. Please sign in below.
        </div>
      )}

      <SignIn
        forceRedirectUrl="/portal/dashboard"
        appearance={{
          elements: {
            rootBox: 'mx-auto',
            card: 'shadow-sm border border-zinc-200',
            headerTitle: 'hidden',
            headerSubtitle: 'hidden',
            socialButtonsBlockButton: 'border border-zinc-300 hover:bg-zinc-50',
            formButtonPrimary: 'bg-[#534AB7] hover:bg-[#4840a0] text-white',
            footerActionLink: 'text-[#534AB7]',
          },
        }}
      />
    </div>
  );
}
