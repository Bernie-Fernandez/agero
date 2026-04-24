'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createUser } from './actions';

const MODULE_LABELS: Record<string, string> = {
  admin: 'Admin Panel', finance: 'Finance & Cost Control', estimating: 'Estimating & Leads',
  crm: 'CRM & Subcontractor Register', delivery: 'Project Delivery', safety: 'Safety', marketing: 'Marketing & Bid Mgmt',
};

type RoleItem = { value: string; label: string; tier: string; stream: string };
type PresetMap = Record<string, { modules: Record<string, string>; maf: Record<string, { state: string; limit: number }> }>;

export default function AddUserWizard({ onClose, roles, allPresets }: { onClose: () => void; roles: RoleItem[]; allPresets: PresetMap }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', role: 'PROJECT_COORDINATOR', employmentType: '' });
  const [error, setError] = useState('');

  const meta = roles.find((r) => r.value === form.role);
  const preset = allPresets[form.role] ?? { modules: {}, maf: {} };

  function handleStep1() {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) {
      setError('First name, last name and email are required.');
      return;
    }
    if (!form.email.includes('@')) { setError('Enter a valid email address.'); return; }
    setError('');
    setStep(2);
  }

  function handleStep2() { setStep(3); }

  function handleSubmit() {
    startTransition(async () => {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.set(k, v));
      const userId = await createUser(fd);
      onClose();
      router.push(`/admin/users/${userId}`);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">Add user</h2>
            <p className="text-xs text-zinc-400 mt-0.5">Step {step} of 3</p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Steps indicator */}
        <div className="flex px-6 pt-4 gap-2">
          {[1,2,3].map((s) => (
            <div key={s} className={`h-1 flex-1 rounded-full ${s <= step ? 'bg-brand' : 'bg-zinc-100'}`} />
          ))}
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Step 1 — Identity */}
          {step === 1 && (
            <>
              <p className="text-sm font-medium text-zinc-700">Staff member details</p>
              {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-1">First name *</label>
                  <input value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-1">Last name *</label>
                  <input value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Email address *</label>
                <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30" />
              </div>
            </>
          )}

          {/* Step 2 — Role & Access */}
          {step === 2 && (
            <>
              <p className="text-sm font-medium text-zinc-700">Role &amp; Access</p>
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Role / Position</label>
                <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30">
                  {roles.map((r) => <option key={r.value} value={r.value}>{r.label} ({r.tier})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Employment type</label>
                <select value={form.employmentType} onChange={(e) => setForm((f) => ({ ...f, employmentType: e.target.value }))} className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30">
                  <option value="">Select…</option>
                  <option value="SALARIED">Salaried</option>
                  <option value="CONTRACT">Contract</option>
                  <option value="WAGES">Wages</option>
                </select>
              </div>
              {meta && (
                <div className="bg-zinc-50 rounded-lg p-3 text-xs text-zinc-600 space-y-1">
                  <p className="font-medium text-zinc-800">{meta.label}</p>
                  <p>Tier: {meta.tier} · Stream: {meta.stream}</p>
                  <p className="font-medium text-zinc-700 mt-2">Module access preset:</p>
                  {Object.entries(preset.modules).map(([mod, level]) => (
                    <div key={mod} className="flex justify-between">
                      <span>{MODULE_LABELS[mod] ?? mod}</span>
                      <span className={`font-medium ${level === 'full' ? 'text-green-600' : level === 'own' ? 'text-blue-600' : level === 'read' ? 'text-amber-600' : 'text-zinc-400'}`}>{level}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Step 3 — Confirm */}
          {step === 3 && (
            <>
              <p className="text-sm font-medium text-zinc-700">Confirm &amp; create</p>
              <div className="bg-zinc-50 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-zinc-500">Name</span><span className="font-medium">{form.firstName} {form.lastName}</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Email</span><span>{form.email}</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Role</span><span>{meta?.label}</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Tier</span><span>{meta?.tier}</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Stream</span><span>{meta?.stream}</span></div>
                {form.employmentType && <div className="flex justify-between"><span className="text-zinc-500">Employment</span><span className="capitalize">{form.employmentType.toLowerCase()}</span></div>}
              </div>
              <p className="text-xs text-zinc-400">The user record will be created immediately. Ask them to sign in via Clerk to link their account.</p>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-100">
          <button onClick={() => step > 1 ? setStep(step - 1) : onClose()} className="px-4 py-2 text-sm text-zinc-600 border border-zinc-200 rounded-lg hover:bg-zinc-50">
            {step === 1 ? 'Cancel' : 'Back'}
          </button>
          {step === 1 && <button onClick={handleStep1} className="px-4 py-2 text-sm bg-brand text-white rounded-lg hover:bg-brand/90">Next</button>}
          {step === 2 && <button onClick={handleStep2} className="px-4 py-2 text-sm bg-brand text-white rounded-lg hover:bg-brand/90">Next</button>}
          {step === 3 && (
            <button onClick={handleSubmit} disabled={pending} className="px-4 py-2 text-sm bg-brand text-white rounded-lg hover:bg-brand/90 disabled:opacity-50">
              {pending ? 'Creating…' : 'Create user'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
