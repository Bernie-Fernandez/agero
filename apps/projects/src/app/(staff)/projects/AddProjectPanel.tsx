'use client';
import { useState } from 'react';
import SlidePanel from '@/components/SlidePanel';
import { createProject } from './actions';

type Company = { id: string; name: string };

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'ON_HOLD', label: 'On Hold' },
  { value: 'COMPLETED', label: 'Completed' },
];

export default function AddProjectPanel({ companies }: { companies: Company[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center px-4 py-2 bg-brand text-white text-sm font-medium rounded-md hover:opacity-90 transition-opacity"
      >
        + Add Project
      </button>

      <SlidePanel isOpen={open} onClose={() => setOpen(false)} title="Add Project">
        <form action={createProject} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">
              Project Name <span className="text-red-500">*</span>
            </label>
            <input
              name="name"
              required
              placeholder="e.g. L16/350 Queen St"
              className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Project Number</label>
            <input
              name="projectNumber"
              placeholder="e.g. AG-2024-001"
              className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Client</label>
            <select
              name="clientId"
              className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              defaultValue=""
            >
              <option value="">— Select client —</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Site Address</label>
            <input
              name="siteAddress"
              placeholder="e.g. 350 Queen Street, Melbourne VIC 3000"
              className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Status</label>
            <select
              name="status"
              defaultValue="ACTIVE"
              className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-600 mb-1">Budget Total ($)</label>
            <input
              name="contractValue"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">Start Date</label>
              <input
                name="startDate"
                type="date"
                className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">End Date</label>
              <input
                name="endDate"
                type="date"
                className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-brand text-white text-sm font-medium rounded-md hover:opacity-90 transition-opacity"
            >
              Create Project
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-4 py-2 text-sm font-medium text-zinc-600 bg-white border border-zinc-300 rounded-md hover:bg-zinc-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </SlidePanel>
    </>
  );
}
