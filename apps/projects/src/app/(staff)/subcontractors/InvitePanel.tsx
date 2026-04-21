'use client';
import { useState } from 'react';
import SlidePanel from '@/components/SlidePanel';
import { inviteSubcontractor } from './actions';
import { showToast } from '@/components/Toast';

type Company = { id: string; name: string };

export default function InvitePanel({ companies }: { companies: Company[] }) {
  const [open, setOpen] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleSubmit = async (fd: FormData) => {
    setPending(true);
    const result = await inviteSubcontractor(fd);
    setPending(false);
    if (!result.ok) {
      showToast(result.error ?? 'Failed', 'error');
      return;
    }
    if (result.emailSent) {
      showToast('Invitation email sent');
      setOpen(false);
    } else {
      setInviteUrl(result.registrationUrl ?? null);
      showToast('Invitation created — email unavailable, copy the link below', 'error');
    }
  };

  return (
    <>
      <button
        onClick={() => { setOpen(true); setInviteUrl(null); }}
        className="inline-flex items-center px-4 py-2 bg-brand text-white text-sm font-medium rounded-md hover:opacity-90 transition-opacity"
      >
        + Invite Subcontractor
      </button>

      <SlidePanel isOpen={open} onClose={() => setOpen(false)} title="Invite Subcontractor">
        <form action={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Company <span className="text-red-500">*</span></label>
            <select name="companyId" required defaultValue=""
              className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand">
              <option value="">— Select subcontractor —</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Contact Name</label>
            <input name="contactName" placeholder="e.g. John Smith"
              className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Email <span className="text-red-500">*</span></label>
            <input name="email" type="email" required placeholder="contact@company.com.au"
              className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>

          {inviteUrl && (
            <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
              <p className="text-xs font-medium text-amber-700 mb-1">Email not sent — share this link manually:</p>
              <a href={inviteUrl} className="text-xs text-brand break-all hover:underline">{inviteUrl}</a>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={pending}
              className="flex-1 px-4 py-2 bg-brand text-white text-sm font-medium rounded-md hover:opacity-90 disabled:opacity-50">
              {pending ? 'Sending…' : 'Send Invitation'}
            </button>
            <button type="button" onClick={() => setOpen(false)}
              className="px-4 py-2 text-sm font-medium text-zinc-600 bg-white border border-zinc-300 rounded-md hover:bg-zinc-50">
              Cancel
            </button>
          </div>
        </form>
      </SlidePanel>
    </>
  );
}
