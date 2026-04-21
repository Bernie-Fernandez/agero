import { prisma } from '@/lib/prisma';
import { PortalInvitationStatus } from '@/lib/prisma';
import { portalRegister } from '../../actions';

export default async function PortalRegisterPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;

  const invitation = await prisma.portalInvitation.findUnique({
    where: { token },
    include: { company: { select: { id: true, name: true } } },
  });

  const isValid = invitation && invitation.status === PortalInvitationStatus.PENDING && invitation.expiresAt >= new Date();

  const errorMsg = error === 'missing' ? 'Please fill in all required fields.'
    : error === 'password-mismatch' ? 'Passwords do not match.'
    : error === 'password-short' ? 'Password must be at least 8 characters.'
    : error === 'invalid-token' ? 'This invitation link is invalid or has expired.'
    : error === 'staff-account' ? 'This email is registered as an Agero staff account. Contact your Agero representative.'
    : null;

  if (!isValid) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-8 w-full max-w-sm text-center">
          <h1 className="text-lg font-bold text-zinc-900 mb-2">Invitation invalid</h1>
          <p className="text-sm text-zinc-500">This invitation link has expired or already been used.</p>
          <p className="text-sm text-zinc-500 mt-2">Please contact your Agero safety manager for a new invitation.</p>
        </div>
      </div>
    );
  }

  const registerWithToken = portalRegister.bind(null);

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
      <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-8 w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="inline-flex flex-col leading-none mb-2">
            <span className="text-xl font-bold text-zinc-900 tracking-tight">AGERO</span>
            <span className="text-[10px] font-medium text-zinc-400 tracking-widest uppercase">Subcontractor Portal</span>
          </div>
          <p className="text-sm font-medium text-zinc-900 mt-2">{invitation.company.name}</p>
          <p className="text-xs text-zinc-500 mt-1">Create your portal account</p>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">{errorMsg}</div>
        )}

        <form action={async (fd) => { fd.append('token', token); await registerWithToken(fd); }} className="space-y-4">
          <input type="hidden" name="token" value={token} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">First Name <span className="text-red-500">*</span></label>
              <input name="firstName" required className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">Last Name <span className="text-red-500">*</span></label>
              <input name="lastName" required className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Email <span className="text-red-500">*</span></label>
            <input name="email" type="email" required defaultValue={invitation.email}
              className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Mobile</label>
            <input name="mobile" type="tel" className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Password <span className="text-red-500">*</span></label>
            <input name="password" type="password" required autoComplete="new-password"
              className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Confirm Password <span className="text-red-500">*</span></label>
            <input name="passwordConfirm" type="password" required autoComplete="new-password"
              className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
          <button type="submit"
            className="w-full px-4 py-2.5 bg-brand text-white text-sm font-medium rounded-md hover:opacity-90 transition-opacity">
            Create account
          </button>
        </form>
      </div>
    </div>
  );
}
