'use client';
import { useState, useTransition } from 'react';
import Link from 'next/link';
import {
  toggleUserActive, updateUserProfile, updateUserPermissions,
  resetToRolePreset, addTrainingRecord, deleteTrainingRecord,
} from '../actions';

const MODULE_LABELS: Record<string, string> = {
  admin: 'Admin Panel', finance: 'Finance & Cost Control', estimating: 'Estimating & Leads',
  crm: 'CRM & Subcontractor Register', delivery: 'Project Delivery', safety: 'Safety', marketing: 'Marketing & Bid Mgmt',
};
const MODULE_KEYS = ['admin', 'finance', 'estimating', 'crm', 'delivery', 'safety', 'marketing'] as const;
const MAF_KEYS = ['subcontract_award', 'supplier_order', 'subcontract_variation', 'subcontract_claim', 'client_variation', 'head_contract', 'tender_submission'] as const;
const MAF_LABELS: Record<string, string> = {
  subcontract_award: 'Subcontract Award', supplier_order: 'Supplier Order',
  subcontract_variation: 'Subcontract Variation', subcontract_claim: 'Subcontract Claim',
  client_variation: 'Client Variation', head_contract: 'Head Contract', tender_submission: 'Tender Submission',
};

type PermissionSet = { modules: Record<string, string>; maf: Record<string, { state: string; limit: number }> };
type RoleItem = { value: string; label: string; tier: string; stream: string };
type RoleMeta = { label: string; tier: string; stream: string } | undefined;

type TrainingRecord = {
  id: string; trainingName: string; completedDate: Date | null;
  expiryDate: Date | null; notes: string | null;
};

type User = {
  id: string; firstName: string; lastName: string; email: string; role: string;
  isActive: boolean; avatarUrl: string | null; initials: string | null;
  phone: string | null; mobile: string | null; signatureUrl: string | null;
  employmentType: string | null; startDate: Date | null; normalRate: unknown;
  overtimeRate: unknown; contractUrl: string | null; contractReviewDate: Date | null;
  probationEndDate: Date | null; hrNotes: string | null;
  safetyInductionNo: string | null; safetyLevel: string | null; safetyExpiry: Date | null;
  licenceNo: string | null; licenceType: string | null; licenceExpiry: Date | null;
  whiteCardNo: string | null; whiteCardExpiry: Date | null;
  nokName: string | null; nokRelationship: string | null; nokPhone: string | null;
  nok2Name: string | null; nok2Relationship: string | null; nok2Phone: string | null;
  medicalNotes: string | null; gmailConnected: boolean; gmailEmail: string | null;
  permissions: unknown; trainingRecords: TrainingRecord[];
};

function avatarBg(id: string) {
  const colors = ['bg-purple-500','bg-blue-500','bg-green-500','bg-amber-500','bg-rose-500','bg-indigo-500','bg-teal-500','bg-orange-500'];
  let hash = 0;
  for (const c of id) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
  return colors[Math.abs(hash) % colors.length];
}

function fmtDate(d: Date | null | undefined) {
  if (!d) return '';
  return new Date(d).toISOString().split('T')[0];
}

type Tab = 'profile' | 'access' | 'gmail' | 'employment' | 'safety' | 'emergency';

export default function UserDetailClient({ user, roleMeta, rolePreset, roles }: { user: User; roleMeta: RoleMeta; rolePreset: PermissionSet; roles: RoleItem[] }) {
  const [tab, setTab] = useState<Tab>('profile');
  const [pending, startTransition] = useTransition();
  const [activeTogglePending, startActiveToggle] = useTransition();
  const [showAddTraining, setShowAddTraining] = useState(false);
  const [saved, setSaved] = useState('');

  const meta = roleMeta;
  const initials = user.initials || `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();

  function flash(msg: string) { setSaved(msg); setTimeout(() => setSaved(''), 2500); }

  function handleProfileSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      await updateUserProfile(user.id, fd);
      flash('Profile saved');
    });
  }

  function handlePermissionsSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      await updateUserPermissions(user.id, fd);
      flash('Permissions saved');
    });
  }

  function handleResetPreset() {
    startTransition(async () => {
      await resetToRolePreset(user.id);
      flash('Reset to role preset');
    });
  }

  function handleToggleActive() {
    startActiveToggle(async () => {
      await toggleUserActive(user.id, !user.isActive);
    });
  }

  function handleAddTraining(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      await addTrainingRecord(user.id, fd);
      setShowAddTraining(false);
      flash('Training record added');
    });
  }

  function handleDeleteTraining(trainingId: string) {
    startTransition(async () => {
      await deleteTrainingRecord(trainingId, user.id);
    });
  }

  const perm = (user.permissions ?? rolePreset) as PermissionSet;
  const preset = rolePreset;

  const tabs: { key: Tab; label: string }[] = [
    { key: 'profile', label: 'Profile' },
    { key: 'access', label: 'Access & Permissions' },
    { key: 'gmail', label: 'Gmail & Integrations' },
    { key: 'employment', label: 'Employment & HR' },
    { key: 'safety', label: 'Safety & Licences' },
    { key: 'emergency', label: 'Emergency Contact' },
  ];

  return (
    <div className="flex gap-6 min-h-screen">
      {/* Left panel */}
      <div className="w-64 shrink-0">
        <div className="bg-white rounded-xl border border-zinc-200 p-5 sticky top-6">
          <Link href="/admin/users" className="text-xs text-zinc-400 hover:text-zinc-600 mb-4 block">&larr; All users</Link>
          <div className="flex flex-col items-center text-center mb-4">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt={initials} className="w-16 h-16 rounded-full object-cover mb-3" />
            ) : (
              <div className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold text-white mb-3 ${avatarBg(user.id)}`}>
                {initials}
              </div>
            )}
            <div className="font-semibold text-zinc-900">{user.firstName} {user.lastName}</div>
            <div className="text-xs text-zinc-500 mt-0.5">{user.email}</div>
            {meta && (
              <div className="mt-2 space-y-1">
                <span className="inline-block bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-medium">{meta.label}</span>
                <div className="text-xs text-zinc-400">{meta.stream} · {meta.tier}</div>
              </div>
            )}
          </div>
          <button
            onClick={handleToggleActive}
            disabled={activeTogglePending}
            className={`w-full text-sm py-1.5 rounded-lg border font-medium transition-colors ${user.isActive ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-green-200 text-green-700 hover:bg-green-50'}`}
          >
            {user.isActive ? 'Deactivate' : 'Activate'}
          </button>
          {saved && <p className="text-xs text-green-600 text-center mt-3">{saved}</p>}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 min-w-0">
        {/* Tabs */}
        <div className="flex gap-1 border-b border-zinc-200 mb-6">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === t.key ? 'border-brand text-brand' : 'border-transparent text-zinc-500 hover:text-zinc-800'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Tab: Profile ── */}
        {tab === 'profile' && (
          <form onSubmit={handleProfileSubmit} className="space-y-5 bg-white rounded-xl border border-zinc-200 p-6">
            <p className="text-sm font-semibold text-zinc-700">Staff member details</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">First name</label>
                <input name="firstName" defaultValue={user.firstName} className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30" />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Last name</label>
                <input name="lastName" defaultValue={user.lastName} className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Initials</label>
                <input name="initials" defaultValue={user.initials ?? ''} maxLength={4} className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-zinc-600 mb-1">Email</label>
                <input name="email" type="email" defaultValue={user.email} className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Phone</label>
                <input name="phone" defaultValue={user.phone ?? ''} className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30" />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Mobile</label>
                <input name="mobile" defaultValue={user.mobile ?? ''} className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">Role</label>
              <select name="role" defaultValue={user.role} className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30">
                {roles.map((r) => <option key={r.value} value={r.value}>{r.label} ({r.tier})</option>)}
              </select>
            </div>
            <input type="hidden" name="isActive" value={user.isActive ? 'true' : 'false'} />
            <div className="flex justify-end pt-2">
              <button type="submit" disabled={pending} className="px-5 py-2 text-sm bg-brand text-white rounded-lg hover:bg-brand/90 disabled:opacity-50">
                {pending ? 'Saving…' : 'Save profile'}
              </button>
            </div>
          </form>
        )}

        {/* ── Tab: Access & Permissions ── */}
        {tab === 'access' && (
          <form onSubmit={handlePermissionsSubmit} className="space-y-6 bg-white rounded-xl border border-zinc-200 p-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-zinc-700">Module access</p>
              <button type="button" onClick={handleResetPreset} disabled={pending} className="text-xs text-zinc-500 hover:text-zinc-800 border border-zinc-200 rounded px-3 py-1">
                Reset to role preset
              </button>
            </div>
            <div className="space-y-3">
              {MODULE_KEYS.map((mod) => (
                <div key={mod} className="flex items-center justify-between">
                  <span className="text-sm text-zinc-700">{MODULE_LABELS[mod]}</span>
                  <select
                    name={`module_${mod}`}
                    defaultValue={(perm.modules as Record<string, string>)[mod] ?? preset.modules[mod]}
                    className="border border-zinc-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
                  >
                    <option value="none">No access</option>
                    <option value="read">Read only</option>
                    <option value="own">Own records</option>
                    <option value="full">Full access</option>
                  </select>
                </div>
              ))}
            </div>

            <div>
              <p className="text-sm font-semibold text-zinc-700 mb-3">MAF thresholds</p>
              <div className="space-y-3">
                {MAF_KEYS.map((cat) => {
                  const cur = (perm.maf as Record<string, { state: string; limit: number }>)[cat] ?? preset.maf[cat];
                  return (
                    <div key={cat} className="flex items-center gap-3">
                      <span className="text-sm text-zinc-700 w-48 shrink-0">{MAF_LABELS[cat]}</span>
                      <select
                        name={`maf_${cat}_state`}
                        defaultValue={cur?.state ?? 'none'}
                        className="border border-zinc-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none"
                      >
                        <option value="none">None</option>
                        <option value="prepare">Prepare</option>
                        <option value="approve">Approve</option>
                      </select>
                      <input
                        name={`maf_${cat}_limit`}
                        type="number"
                        defaultValue={cur?.limit ?? 0}
                        min={0}
                        placeholder="0 = unlimited"
                        className="w-32 border border-zinc-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none"
                      />
                      <span className="text-xs text-zinc-400">0 = unlimited</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button type="submit" disabled={pending} className="px-5 py-2 text-sm bg-brand text-white rounded-lg hover:bg-brand/90 disabled:opacity-50">
                {pending ? 'Saving…' : 'Save permissions'}
              </button>
            </div>
          </form>
        )}

        {/* ── Tab: Gmail & Integrations ── */}
        {tab === 'gmail' && (
          <div className="bg-white rounded-xl border border-zinc-200 p-6 space-y-4">
            <p className="text-sm font-semibold text-zinc-700">Gmail integration</p>
            {user.gmailConnected ? (
              <div className="bg-green-50 rounded-lg p-4 flex items-center gap-3">
                <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                <div>
                  <p className="text-sm font-medium text-green-800">Gmail connected</p>
                  <p className="text-xs text-green-600">{user.gmailEmail}</p>
                </div>
              </div>
            ) : (
              <div className="bg-zinc-50 rounded-lg p-4">
                <p className="text-sm text-zinc-600 mb-3">No Gmail account connected. The user can connect their account from their profile page.</p>
                <span className="text-xs text-zinc-400">OAuth flow is initiated by the user from /profile.</span>
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Employment & HR ── */}
        {tab === 'employment' && (
          <div className="space-y-6">
            <form onSubmit={handleProfileSubmit} className="bg-white rounded-xl border border-zinc-200 p-6 space-y-5">
              <p className="text-sm font-semibold text-zinc-700">Employment details</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-1">Employment type</label>
                  <select name="employmentType" defaultValue={user.employmentType ?? ''} className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30">
                    <option value="">Select…</option>
                    <option value="SALARIED">Salaried</option>
                    <option value="CONTRACT">Contract</option>
                    <option value="WAGES">Wages</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-1">Start date</label>
                  <input name="startDate" type="date" defaultValue={fmtDate(user.startDate)} className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-1">Normal rate ($/hr)</label>
                  <input name="normalRate" type="number" step="0.01" defaultValue={user.normalRate != null ? String(user.normalRate) : ''} className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-1">Overtime rate ($/hr)</label>
                  <input name="overtimeRate" type="number" step="0.01" defaultValue={user.overtimeRate != null ? String(user.overtimeRate) : ''} className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-1">Contract review date</label>
                  <input name="contractReviewDate" type="date" defaultValue={fmtDate(user.contractReviewDate)} className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-1">Probation end date</label>
                  <input name="probationEndDate" type="date" defaultValue={fmtDate(user.probationEndDate)} className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">HR notes (Director only)</label>
                <textarea name="hrNotes" rows={3} defaultValue={user.hrNotes ?? ''} className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30" />
              </div>
              {/* Hidden fields to avoid overwriting other data */}
              <input type="hidden" name="firstName" value={user.firstName} />
              <input type="hidden" name="lastName" value={user.lastName} />
              <input type="hidden" name="email" value={user.email} />
              <input type="hidden" name="role" value={user.role} />
              <input type="hidden" name="isActive" value={user.isActive ? 'true' : 'false'} />
              <div className="flex justify-end">
                <button type="submit" disabled={pending} className="px-5 py-2 text-sm bg-brand text-white rounded-lg hover:bg-brand/90 disabled:opacity-50">
                  {pending ? 'Saving…' : 'Save employment details'}
                </button>
              </div>
            </form>

            {/* Training records */}
            <div className="bg-white rounded-xl border border-zinc-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-semibold text-zinc-700">Training records</p>
                <button onClick={() => setShowAddTraining(true)} className="text-xs bg-brand text-white px-3 py-1.5 rounded-lg hover:bg-brand/90">
                  + Add record
                </button>
              </div>
              {user.trainingRecords.length === 0 ? (
                <p className="text-sm text-zinc-400">No training records.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100">
                      <th className="text-left py-2 text-xs font-semibold text-zinc-500">Training</th>
                      <th className="text-left py-2 text-xs font-semibold text-zinc-500">Completed</th>
                      <th className="text-left py-2 text-xs font-semibold text-zinc-500">Expires</th>
                      <th className="py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {user.trainingRecords.map((t) => (
                      <tr key={t.id} className="border-b border-zinc-50">
                        <td className="py-2 text-zinc-800">{t.trainingName}</td>
                        <td className="py-2 text-zinc-500 text-xs">{fmtDate(t.completedDate) || '—'}</td>
                        <td className="py-2 text-zinc-500 text-xs">{fmtDate(t.expiryDate) || '—'}</td>
                        <td className="py-2 text-right">
                          <button onClick={() => handleDeleteTraining(t.id)} className="text-xs text-red-500 hover:text-red-700">Remove</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {showAddTraining && (
                <form onSubmit={handleAddTraining} className="mt-4 border-t border-zinc-100 pt-4 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 mb-1">Training name *</label>
                    <input name="trainingName" required className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-zinc-600 mb-1">Completed date</label>
                      <input name="completedDate" type="date" className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-600 mb-1">Expiry date</label>
                      <input name="expiryDate" type="date" className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 mb-1">Notes</label>
                    <input name="notes" className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" disabled={pending} className="px-4 py-2 text-sm bg-brand text-white rounded-lg hover:bg-brand/90 disabled:opacity-50">Add</button>
                    <button type="button" onClick={() => setShowAddTraining(false)} className="px-4 py-2 text-sm border border-zinc-200 text-zinc-600 rounded-lg hover:bg-zinc-50">Cancel</button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* ── Tab: Safety & Licences ── */}
        {tab === 'safety' && (
          <form onSubmit={handleProfileSubmit} className="bg-white rounded-xl border border-zinc-200 p-6 space-y-5">
            <p className="text-sm font-semibold text-zinc-700">Safety & licences</p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Safety induction no.</label>
                <input name="safetyInductionNo" defaultValue={user.safetyInductionNo ?? ''} className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30" />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Safety level</label>
                <input name="safetyLevel" defaultValue={user.safetyLevel ?? ''} className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30" />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Safety expiry</label>
                <input name="safetyExpiry" type="date" defaultValue={fmtDate(user.safetyExpiry)} className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Licence no.</label>
                <input name="licenceNo" defaultValue={user.licenceNo ?? ''} className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30" />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Licence type</label>
                <input name="licenceType" defaultValue={user.licenceType ?? ''} className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30" />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Licence expiry</label>
                <input name="licenceExpiry" type="date" defaultValue={fmtDate(user.licenceExpiry)} className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">White card no.</label>
                <input name="whiteCardNo" defaultValue={user.whiteCardNo ?? ''} className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30" />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">White card expiry</label>
                <input name="whiteCardExpiry" type="date" defaultValue={fmtDate(user.whiteCardExpiry)} className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30" />
              </div>
            </div>
            <input type="hidden" name="firstName" value={user.firstName} />
            <input type="hidden" name="lastName" value={user.lastName} />
            <input type="hidden" name="email" value={user.email} />
            <input type="hidden" name="role" value={user.role} />
            <input type="hidden" name="isActive" value={user.isActive ? 'true' : 'false'} />
            <div className="flex justify-end">
              <button type="submit" disabled={pending} className="px-5 py-2 text-sm bg-brand text-white rounded-lg hover:bg-brand/90 disabled:opacity-50">
                {pending ? 'Saving…' : 'Save safety details'}
              </button>
            </div>
          </form>
        )}

        {/* ── Tab: Emergency Contact ── */}
        {tab === 'emergency' && (
          <form onSubmit={handleProfileSubmit} className="bg-white rounded-xl border border-zinc-200 p-6 space-y-5">
            <p className="text-sm font-semibold text-zinc-700">Next of kin — Primary</p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Name</label>
                <input name="nokName" defaultValue={user.nokName ?? ''} className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30" />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Relationship</label>
                <input name="nokRelationship" defaultValue={user.nokRelationship ?? ''} className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30" />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Phone</label>
                <input name="nokPhone" defaultValue={user.nokPhone ?? ''} className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30" />
              </div>
            </div>

            <p className="text-sm font-semibold text-zinc-700 pt-2">Next of kin — Secondary</p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Name</label>
                <input name="nok2Name" defaultValue={user.nok2Name ?? ''} className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30" />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Relationship</label>
                <input name="nok2Relationship" defaultValue={user.nok2Relationship ?? ''} className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30" />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Phone</label>
                <input name="nok2Phone" defaultValue={user.nok2Phone ?? ''} className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">Medical notes (Director only)</label>
              <textarea name="medicalNotes" rows={3} defaultValue={user.medicalNotes ?? ''} className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30" />
            </div>
            <input type="hidden" name="firstName" value={user.firstName} />
            <input type="hidden" name="lastName" value={user.lastName} />
            <input type="hidden" name="email" value={user.email} />
            <input type="hidden" name="role" value={user.role} />
            <input type="hidden" name="isActive" value={user.isActive ? 'true' : 'false'} />
            <div className="flex justify-end">
              <button type="submit" disabled={pending} className="px-5 py-2 text-sm bg-brand text-white rounded-lg hover:bg-brand/90 disabled:opacity-50">
                {pending ? 'Saving…' : 'Save emergency contact'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
