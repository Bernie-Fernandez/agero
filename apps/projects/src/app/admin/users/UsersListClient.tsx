'use client';
import { useState } from 'react';
import Link from 'next/link';
import AddUserWizard from './AddUserWizard';

type RoleItem = { value: string; label: string; tier: string; stream: string };
type PresetMap = Record<string, { modules: Record<string, string>; maf: Record<string, { state: string; limit: number }> }>;

type User = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  mobile: string | null;
  phone: string | null;
  role: string;
  isActive: boolean;
  avatarUrl: string | null;
  initials: string | null;
  employmentType: string | null;
  updatedAt: Date;
};

function avatarBg(id: string) {
  const colors = ['bg-purple-500','bg-blue-500','bg-green-500','bg-amber-500','bg-rose-500','bg-indigo-500','bg-teal-500','bg-orange-500'];
  let hash = 0;
  for (const c of id) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
  return colors[Math.abs(hash) % colors.length];
}

function Avatar({ user }: { user: User }) {
  const initials = user.initials || `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
  if (user.avatarUrl) return <img src={user.avatarUrl} alt={initials} className="w-8 h-8 rounded-full object-cover" />;
  return (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${avatarBg(user.id)}`}>
      {initials}
    </div>
  );
}

const TIER_COLORS: Record<string, string> = {
  Executive: 'bg-purple-100 text-purple-700',
  Senior: 'bg-blue-100 text-blue-700',
  Mid: 'bg-sky-100 text-sky-700',
  Operational: 'bg-green-100 text-green-700',
  Support: 'bg-zinc-100 text-zinc-600',
};

export default function UsersListClient({ users, roles, allPresets }: { users: User[]; roles: RoleItem[]; allPresets: PresetMap }) {
  const [search, setSearch] = useState('');
  const [streamFilter, setStreamFilter] = useState('ALL');
  const [tierFilter, setTierFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('active');
  const [showWizard, setShowWizard] = useState(false);

  const roleMap = Object.fromEntries(roles.map((r) => [r.value, r]));
  const streams = [...new Set(roles.map((r) => r.stream))].sort();
  const tiers = ['Executive', 'Senior', 'Mid', 'Operational', 'Support'];

  const filtered = users.filter((u) => {
    const meta = roleMap[u.role];
    if (statusFilter === 'active' && !u.isActive) return false;
    if (statusFilter === 'inactive' && u.isActive) return false;
    if (streamFilter !== 'ALL' && meta?.stream !== streamFilter) return false;
    if (tierFilter !== 'ALL' && meta?.tier !== tierFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const name = `${u.firstName} ${u.lastName}`.toLowerCase();
      return name.includes(q) || u.email.toLowerCase().includes(q) || (meta?.label ?? '').toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Users</h1>
          <p className="text-sm text-zinc-500 mt-1">
            {users.filter((u) => u.isActive).length} active · {users.length} total
          </p>
        </div>
        <button
          onClick={() => setShowWizard(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand text-white text-sm rounded-lg hover:bg-brand/90"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          Add user
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email or role…"
          className="flex-1 min-w-[200px] border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
        />
        <select value={streamFilter} onChange={(e) => setStreamFilter(e.target.value)} className="border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
          <option value="ALL">All streams</option>
          {streams.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={tierFilter} onChange={(e) => setTierFilter(e.target.value)} className="border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
          <option value="ALL">All tiers</option>
          {tiers.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="all">All</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500">Name</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500">Role</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500">Stream</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500">Tier</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500">Employment</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-zinc-400">No users found.</td></tr>
            )}
            {filtered.map((u) => {
              const meta = roleMap[u.role];
              return (
                <tr key={u.id} className={`border-b border-zinc-50 hover:bg-zinc-50/50 ${!u.isActive ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar user={u} />
                      <div>
                        <div className="font-medium text-zinc-900">{u.firstName} {u.lastName}</div>
                        <div className="text-xs text-zinc-400">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-700 text-xs">{meta?.label ?? u.role}</td>
                  <td className="px-4 py-3 text-xs text-zinc-500">{meta?.stream ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TIER_COLORS[meta?.tier ?? ''] ?? 'bg-zinc-100 text-zinc-600'}`}>
                      {meta?.tier ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-500 capitalize">
                    {u.employmentType ? u.employmentType.toLowerCase() : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-500'}`}>
                      {u.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/users/${u.id}`} className="text-xs text-brand hover:underline">View</Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showWizard && <AddUserWizard onClose={() => setShowWizard(false)} roles={roles} allPresets={allPresets} />}
    </div>
  );
}
