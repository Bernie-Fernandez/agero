import { portalLogin } from '../actions';

export default async function PortalLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const errorMsg = error === 'invalid' ? 'Email or password is incorrect.'
    : error === 'missing' ? 'Please enter your email and password.'
    : null;

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
      <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-8 w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="inline-flex flex-col leading-none mb-2">
            <span className="text-xl font-bold text-zinc-900 tracking-tight">AGERO</span>
            <span className="text-[10px] font-medium text-zinc-400 tracking-widest uppercase">Subcontractor Portal</span>
          </div>
          <p className="text-sm text-zinc-500 mt-2">Sign in to manage your workers and documents</p>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">{errorMsg}</div>
        )}

        <form action={portalLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Email</label>
            <input name="email" type="email" required autoComplete="email"
              className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Password</label>
            <input name="password" type="password" required autoComplete="current-password"
              className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
          <button type="submit"
            className="w-full px-4 py-2.5 bg-brand text-white text-sm font-medium rounded-md hover:opacity-90 transition-opacity">
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
