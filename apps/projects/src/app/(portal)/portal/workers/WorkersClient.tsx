'use client';
import { useState, useTransition } from 'react';
import { addPortalWorker } from '../actions';

type Worker = {
  id: string;
  firstName: string;
  lastName: string;
  mobile: string | null;
  email: string | null;
  trade: string | null;
  project: { name: string };
};

export default function WorkersClient({
  workers,
  companyId,
}: {
  workers: Worker[];
  companyId: string;
}) {
  const [list, setList] = useState(workers);
  const [showPanel, setShowPanel] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const res = await addPortalWorker(fd, companyId);
      if (!res.ok) {
        setError(res.error ?? 'Failed to add worker');
      } else {
        setSuccess(true);
        setShowPanel(false);
        // Optimistic add for display (full reload not needed)
        const first = fd.get('firstName') as string;
        const last = fd.get('lastName') as string;
        const mobile = fd.get('mobile') as string;
        const email = (fd.get('email') as string) || null;
        const trade = (fd.get('trade') as string) || null;
        setList((prev) => [
          ...prev,
          { id: crypto.randomUUID(), firstName: first, lastName: last, mobile, email, trade, project: { name: '—' } },
        ]);
        setTimeout(() => setSuccess(false), 3000);
        (e.target as HTMLFormElement).reset();
      }
    });
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 mb-1">Workers</h1>
          <p className="text-sm text-zinc-500">{list.length} registered</p>
        </div>
        <button
          onClick={() => { setShowPanel(true); setError(null); }}
          className="px-4 py-2 bg-brand text-white text-sm font-medium rounded-md hover:opacity-90 transition-opacity"
        >
          + Add worker
        </button>
      </div>

      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-700">
          Worker added successfully.
        </div>
      )}

      {list.length === 0 ? (
        <div className="bg-white rounded-lg border border-zinc-200 p-10 text-center">
          <p className="text-sm text-zinc-500">No workers registered yet.</p>
          <p className="text-xs text-zinc-400 mt-1">Add workers so they can access Agero Safety sites.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Mobile</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Email</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Trade</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Project</th>
              </tr>
            </thead>
            <tbody>
              {list.map((w) => (
                <tr key={w.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50">
                  <td className="px-4 py-3 font-medium text-zinc-900">{w.firstName} {w.lastName}</td>
                  <td className="px-4 py-3 text-zinc-600">{w.mobile ?? '—'}</td>
                  <td className="px-4 py-3 text-zinc-600">{w.email ?? '—'}</td>
                  <td className="px-4 py-3 text-zinc-600">{w.trade ?? '—'}</td>
                  <td className="px-4 py-3 text-zinc-500 text-xs">{w.project.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add worker slide-in panel */}
      {showPanel && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/30" onClick={() => setShowPanel(false)} />
          <div className="w-[380px] bg-white h-full overflow-y-auto shadow-xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200">
              <h2 className="text-base font-semibold text-zinc-900">Add worker</h2>
              <button onClick={() => setShowPanel(false)} className="text-zinc-400 hover:text-zinc-600 text-xl leading-none">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="flex-1 p-5 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">{error}</div>
              )}
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
                <label className="block text-xs font-medium text-zinc-600 mb-1">Mobile <span className="text-red-500">*</span></label>
                <input name="mobile" type="tel" required placeholder="04xx xxx xxx" className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Email</label>
                <input name="email" type="email" className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Trade</label>
                <input name="trade" placeholder="e.g. Carpenter, Electrician" className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
              </div>
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full px-4 py-2.5 bg-brand text-white text-sm font-medium rounded-md hover:opacity-90 transition-opacity disabled:opacity-60"
                >
                  {isPending ? 'Adding…' : 'Add worker'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
