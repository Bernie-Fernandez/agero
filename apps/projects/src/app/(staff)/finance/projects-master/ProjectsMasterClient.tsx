'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  listFinanceProjectsMaster,
  createFinanceProjectMaster,
  updateFinanceProjectMaster,
  softDeleteFinanceProjectMaster,
  restoreFinanceProjectMaster,
  ProjectMasterRow,
} from './actions';

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = 'active' | 'archived' | 'all';

const STATUSES = ['AWARDED', 'BACKLOG', 'DLP', 'CLOSED'] as const;

const STATUS_COLOURS: Record<string, string> = {
  AWARDED: 'bg-green-100 text-green-700',
  BACKLOG: 'bg-blue-100 text-blue-700',
  DLP: 'bg-amber-100 text-amber-700',
  CLOSED: 'bg-zinc-100 text-zinc-500',
};

const EMPTY_FORM = { jobNumber: '', projectName: '', status: 'AWARDED', notes: '' };

type FormData = typeof EMPTY_FORM;

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtMonth(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-AU', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

// ── Slide-in Form ─────────────────────────────────────────────────────────────

function ProjectSlideIn({
  editId,
  initialData,
  onSaved,
  onSaveAnother,
  onCancel,
}: {
  editId: string | null;
  initialData?: Partial<FormData>;
  onSaved: (project: ProjectMasterRow) => void;
  onSaveAnother: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<FormData>({ ...EMPTY_FORM, ...initialData });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(k: keyof FormData, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
    setError(null);
  }

  async function handleSave(addAnother: boolean) {
    setSaving(true);
    setError(null);
    const result = editId
      ? await updateFinanceProjectMaster(editId, form)
      : await createFinanceProjectMaster(form);
    setSaving(false);
    if (!result.ok) { setError(result.error ?? 'Save failed.'); return; }
    if (addAnother) {
      setForm(EMPTY_FORM);
      onSaveAnother();
    } else {
      onSaved(result.project!);
    }
  }

  const isEdit = !!editId;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30" onClick={onCancel} />
      <div className="w-full max-w-md bg-white shadow-xl flex flex-col h-full">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
          <h2 className="text-base font-semibold text-zinc-900">
            {isEdit ? 'Edit Finance Project' : 'Add Finance Project'}
          </h2>
          <button onClick={onCancel} className="text-zinc-400 hover:text-zinc-700">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">
              Job No <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.jobNumber}
              onChange={(e) => set('jobNumber', e.target.value)}
              disabled={isEdit}
              placeholder="e.g. 1263"
              className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 disabled:bg-zinc-50 disabled:text-zinc-400"
            />
            {!isEdit && (
              <p className="text-xs text-zinc-400 mt-1">Must match the Job No in the CAT export exactly.</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">
              Project Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.projectName}
              onChange={(e) => set('projectName', e.target.value)}
              className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Status</label>
            <select
              value={form.status}
              onChange={(e) => set('status', e.target.value)}
              className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
            >
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Notes (optional)</label>
            <textarea
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              rows={3}
              className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none resize-none"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-zinc-100 flex justify-between gap-2">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900">
            Cancel
          </button>
          <div className="flex gap-2">
            {!isEdit && (
              <button
                onClick={() => handleSave(true)}
                disabled={saving}
                className="px-4 py-2 text-sm border border-brand text-brand rounded-lg hover:bg-brand/5 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save & Add Another'}
              </button>
            )}
            <button
              onClick={() => handleSave(false)}
              disabled={saving}
              className="px-4 py-2 bg-brand hover:bg-brand/90 text-white text-sm font-medium rounded-lg disabled:opacity-50"
            >
              {saving ? 'Saving…' : (isEdit ? 'Update' : 'Save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Client Component ─────────────────────────────────────────────────────

export default function ProjectsMasterClient({
  initialProjects,
  initialTotal,
}: {
  initialProjects: ProjectMasterRow[];
  initialTotal: number;
}) {
  const [tab, setTab] = useState<Tab>('active');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [projects, setProjects] = useState(initialProjects);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formInitial, setFormInitial] = useState<Partial<typeof EMPTY_FORM> | undefined>(undefined);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const reload = useCallback(async (
    opts: { tab?: Tab; search?: string; status?: string; page?: number } = {}
  ) => {
    setLoading(true);
    const result = await listFinanceProjectsMaster({
      tab: opts.tab ?? tab,
      search: opts.search ?? search,
      status: opts.status ?? statusFilter,
      page: opts.page ?? page,
    });
    setProjects(result.projects);
    setTotal(result.total);
    setLoading(false);
  }, [tab, search, statusFilter, page]);

  // Reload when filters change
  useEffect(() => {
    reload({ tab, search, status: statusFilter, page });
  }, [tab, statusFilter, page]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => reload({ tab, search, status: statusFilter, page: 1 }), 300);
    return () => clearTimeout(t);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  function openAdd() {
    setEditId(null);
    setFormInitial(undefined);
    setShowForm(true);
  }

  function openEdit(p: ProjectMasterRow) {
    setEditId(p.id);
    setFormInitial({ jobNumber: p.jobNumber, projectName: p.projectName, status: p.status, notes: p.notes ?? '' });
    setShowForm(true);
  }

  function handleSaved(project: ProjectMasterRow) {
    setShowForm(false);
    reload();
  }

  function handleSaveAnother() {
    // Form stays open with cleared fields — just force a list reload
    reload();
  }

  async function handleDelete(id: string) {
    setDeleteError(null);
    const result = await softDeleteFinanceProjectMaster(id);
    if (!result.ok) { setDeleteError(result.error ?? 'Delete failed.'); return; }
    setDeleteId(null);
    reload();
  }

  async function handleRestore(id: string) {
    setRestoreError(null);
    const result = await restoreFinanceProjectMaster(id);
    if (!result.ok) { setRestoreError(result.error ?? 'Restore failed.'); return; }
    reload();
  }

  const totalPages = Math.max(1, Math.ceil(total / 50));

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Finance Projects (Master)</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Manage the list of projects recognised by the CAT import.
          </p>
        </div>
        <button
          onClick={openAdd}
          className="px-4 py-2 bg-brand hover:bg-brand/90 text-white text-sm font-medium rounded-lg"
        >
          + Add Project
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-zinc-200">
        {(['active', 'all', 'archived'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setPage(1); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t ? 'border-brand text-brand' : 'border-transparent text-zinc-500 hover:text-zinc-700'
            }`}
          >
            {t === 'active' ? 'Active' : t === 'archived' ? 'Archived' : 'All'}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <input
          type="text"
          placeholder="Search job no or project name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
        />
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="border border-zinc-200 rounded-lg px-3 py-2 text-sm text-zinc-700 focus:outline-none"
        >
          <option value="">All Statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white border border-zinc-200 rounded-xl overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 border-b border-zinc-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Job No</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Project Name</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Status</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Month</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wide">Created</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-zinc-400">
                  <div className="inline-block w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                </td>
              </tr>
            ) : projects.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-zinc-400">
                  {tab === 'archived' ? 'No archived projects.' : 'No projects found.'}
                  {tab === 'active' && (
                    <span> Click <strong>+ Add Project</strong> to get started.</span>
                  )}
                </td>
              </tr>
            ) : projects.map((p) => (
              <tr key={p.id} className="hover:bg-zinc-50">
                <td className="px-4 py-3 font-mono text-xs text-zinc-600">{p.jobNumber}</td>
                <td className="px-4 py-3 text-zinc-900 font-medium max-w-xs truncate">{p.projectName}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLOURS[p.status] ?? 'bg-zinc-100 text-zinc-500'}`}>
                    {p.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-zinc-500 text-xs">{fmtMonth(p.reportMonth)}</td>
                <td className="px-4 py-3 text-zinc-500 text-xs">{fmtDate(p.createdAt)}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-3">
                    {tab !== 'archived' && (
                      <>
                        <button
                          onClick={() => openEdit(p)}
                          className="text-xs text-brand hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => { setDeleteId(p.id); setDeleteError(null); }}
                          className="text-xs text-red-500 hover:underline"
                        >
                          Delete
                        </button>
                      </>
                    )}
                    {tab === 'archived' && (
                      <button
                        onClick={() => handleRestore(p.id)}
                        className="text-xs text-brand hover:underline"
                      >
                        Restore
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Restore error */}
      {restoreError && (
        <p className="mt-2 text-sm text-red-600">{restoreError}</p>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-zinc-600">
          <span>{total} projects total</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 border border-zinc-200 rounded-lg hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ← Previous
            </button>
            <span className="text-xs">{page} / {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 border border-zinc-200 rounded-lg hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* Add / Edit form */}
      {showForm && (
        <ProjectSlideIn
          editId={editId}
          initialData={formInitial}
          onSaved={handleSaved}
          onSaveAnother={handleSaveAnother}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Delete confirmation */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-base font-semibold text-zinc-900 mb-2">Archive project?</h2>
            <p className="text-sm text-zinc-500 mb-2">
              This project will be moved to the Archived tab. CAT imports will no longer
              recognise its Job No until it is restored.
            </p>
            {deleteError && (
              <p className="text-sm text-red-600 mb-2">{deleteError}</p>
            )}
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 text-sm text-zinc-600">
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteId)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg"
              >
                Archive
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
