'use client';
import { useState, useTransition } from 'react';
import { assignSubcontractor, removeSubcontractor } from './actions';
import { showToast } from '@/components/Toast';
import SlidePanel from '@/components/SlidePanel';

type Assignment = {
  id: string;
  company: { id: string; name: string };
  assignedAt: Date;
};

type Company = { id: string; name: string };

export default function SubcontractorsTab({
  projectId,
  assignments,
  availableCompanies,
}: {
  projectId: string;
  assignments: Assignment[];
  availableCompanies: Company[];
}) {
  const [list, setList] = useState(assignments);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const handleAssign = async (fd: FormData) => {
    const companyId = fd.get('companyId') as string;
    if (!companyId) return;
    startTransition(async () => {
      const result = await assignSubcontractor(projectId, companyId);
      if (!result.ok) { showToast(result.error ?? 'Failed', 'error'); return; }
      setList((prev) => [
        ...prev,
        { id: result.id!, company: { id: companyId, name: availableCompanies.find((c) => c.id === companyId)?.name ?? '' }, assignedAt: new Date() },
      ]);
      setOpen(false);
      showToast('Subcontractor assigned');
    });
  };

  const handleRemove = (assignmentId: string) => {
    startTransition(async () => {
      await removeSubcontractor(assignmentId);
      setList((prev) => prev.filter((a) => a.id !== assignmentId));
      showToast('Removed');
    });
  };

  const unassigned = availableCompanies.filter((c) => !list.some((a) => a.company.id === c.id));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-zinc-600">{list.length} subcontractor{list.length !== 1 ? 's' : ''} assigned to this project</p>
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center px-4 py-2 bg-brand text-white text-sm font-medium rounded-md hover:opacity-90"
        >
          Assign Subcontractor
        </button>
      </div>

      {list.length === 0 ? (
        <div className="text-center py-12 text-zinc-400">
          <p className="text-sm">No subcontractors assigned. Click &#34;Assign&#34; to add one.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50">
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Company</th>
                <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Assigned</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {list.map((a, idx) => (
                <tr key={a.id} className={idx < list.length - 1 ? 'border-b border-zinc-100' : ''}>
                  <td className="px-4 py-3 font-medium text-zinc-900">{a.company.name}</td>
                  <td className="px-4 py-3 text-xs text-zinc-500">
                    {new Date(a.assignedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => handleRemove(a.id)} disabled={pending}
                      className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50">
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <SlidePanel isOpen={open} onClose={() => setOpen(false)} title="Assign Subcontractor">
        <form action={handleAssign} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Subcontractor <span className="text-red-500">*</span></label>
            <select name="companyId" required defaultValue=""
              className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand">
              <option value="">— Select subcontractor —</option>
              {unassigned.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          {unassigned.length === 0 && (
            <p className="text-sm text-zinc-500">All available subcontractors are already assigned to this project.</p>
          )}
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={pending || unassigned.length === 0}
              className="flex-1 px-4 py-2 bg-brand text-white text-sm font-medium rounded-md hover:opacity-90 disabled:opacity-50">
              {pending ? 'Assigning…' : 'Assign'}
            </button>
            <button type="button" onClick={() => setOpen(false)}
              className="px-4 py-2 text-sm font-medium text-zinc-600 bg-white border border-zinc-300 rounded-md hover:bg-zinc-50">
              Cancel
            </button>
          </div>
        </form>
      </SlidePanel>
    </div>
  );
}
