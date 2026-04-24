'use client';
import { useState, useTransition } from 'react';
import { updateMyProfile } from '@/app/admin/users/actions';

type PermissionSet = { modules: Record<string, string>; maf: Record<string, { state: string; limit: number }> };

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

type UserLike = {
  id: string; firstName: string; lastName: string; email: string; role: string;
  initials: string | null; avatarUrl: string | null; phone: string | null; mobile: string | null;
  safetyInductionNo: string | null; safetyLevel: string | null; safetyExpiry: Date | null;
  licenceNo: string | null; licenceType: string | null; licenceExpiry: Date | null;
  whiteCardNo: string | null; whiteCardExpiry: Date | null;
  nokName: string | null; nokRelationship: string | null; nokPhone: string | null;
  nok2Name: string | null; nok2Relationship: string | null; nok2Phone: string | null;
  gmailConnected: boolean; gmailEmail: string | null;
};

type RoleMeta = { label: string; tier: string; stream: string } | undefined;

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

type Tab = 'profile' | 'access' | 'safety' | 'emergency';

export default function ProfileClient({ user, meta, perm }: { user: UserLike; meta: RoleMeta; perm: object }) {
  const [tab, setTab] = useState<Tab>('profile');
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState('');

  const initials = user.initials || `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();

  function flash() { setSaved('Saved'); setTimeout(() => setSaved(''), 2500); }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      await updateMyProfile(fd);
      flash();
    });
  }

  const permissions = perm as PermissionSet;

  const tabs: { key: Tab; label: string }[] = [
    { key: 'profile', label: 'My Profile' },
    { key: 'access', label: 'Access & Permissions' },
    { key: 'safety', label: 'Safety & Licences' },
    { key: 'emergency', label: 'Emergency Contact' },
  ];

  return (
    <div className="flex gap-6 min-h-screen">
      {/* Left panel */}
      <div className="w-64 shrink-0">
        <div className="bg-white rounded-xl border border-zinc-200 p-5 sticky top-6">
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
          {saved && <p className="text-xs text-green-600 text-center mt-2">{saved}</p>}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 min-w-0">
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

        {/* ── Profile ── */}
        {tab === 'profile' && (
          <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-zinc-200 p-6 space-y-5">
            <p className="text-sm font-semibold text-zinc-700">Personal details</p>
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
                <label className="block text-xs font-medium text-zinc-600 mb-1">Email (read-only)</label>
                <input value={user.email} disabled className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm bg-zinc-50 text-zinc-400" />
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
            <div className="flex justify-end">
              <button type="submit" disabled={pending} className="px-5 py-2 text-sm bg-brand text-white rounded-lg hover:bg-brand/90 disabled:opacity-50">
                {pending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        )}

        {/* ── Access & Permissions (read-only) ── */}
        {tab === 'access' && (
          <div className="bg-white rounded-xl border border-zinc-200 p-6 space-y-6">
            <div>
              <p className="text-sm font-semibold text-zinc-700 mb-3">Module access</p>
              <div className="space-y-2">
                {MODULE_KEYS.map((mod) => {
                  const level = (permissions.modules as Record<string, string>)?.[mod] ?? 'none';
                  return (
                    <div key={mod} className="flex items-center justify-between py-1.5 border-b border-zinc-50">
                      <span className="text-sm text-zinc-700">{MODULE_LABELS[mod]}</span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${level === 'full' ? 'bg-green-100 text-green-700' : level === 'own' ? 'bg-blue-100 text-blue-700' : level === 'read' ? 'bg-amber-100 text-amber-700' : 'bg-zinc-100 text-zinc-500'}`}>
                        {level}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-700 mb-3">MAF thresholds</p>
              <div className="space-y-2">
                {MAF_KEYS.map((cat) => {
                  const auth = (permissions.maf as Record<string, { state: string; limit: number }>)?.[cat];
                  return (
                    <div key={cat} className="flex items-center justify-between py-1.5 border-b border-zinc-50">
                      <span className="text-sm text-zinc-700">{MAF_LABELS[cat]}</span>
                      <span className="text-xs text-zinc-500">
                        {auth ? `${auth.state}${auth.limit > 0 ? ` / $${auth.limit.toLocaleString()}` : ' / unlimited'}` : 'none'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            <p className="text-xs text-zinc-400">Permission changes must be made by a Director via Admin &rsaquo; Users.</p>
          </div>
        )}

        {/* ── Safety & Licences ── */}
        {tab === 'safety' && (
          <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-zinc-200 p-6 space-y-5">
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
                <input name="safetyExpiry" type="date" defaultValue={fmtDate(user.safetyExpiry as Date | null)} className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30" />
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
                <input name="licenceExpiry" type="date" defaultValue={fmtDate(user.licenceExpiry as Date | null)} className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">White card no.</label>
                <input name="whiteCardNo" defaultValue={user.whiteCardNo ?? ''} className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30" />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">White card expiry</label>
                <input name="whiteCardExpiry" type="date" defaultValue={fmtDate(user.whiteCardExpiry as Date | null)} className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30" />
              </div>
            </div>
            <div className="flex justify-end">
              <button type="submit" disabled={pending} className="px-5 py-2 text-sm bg-brand text-white rounded-lg hover:bg-brand/90 disabled:opacity-50">
                {pending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        )}

        {/* ── Emergency Contact ── */}
        {tab === 'emergency' && (
          <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-zinc-200 p-6 space-y-5">
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
            <div className="flex justify-end">
              <button type="submit" disabled={pending} className="px-5 py-2 text-sm bg-brand text-white rounded-lg hover:bg-brand/90 disabled:opacity-50">
                {pending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
