'use client';

import { useState, useTransition } from 'react';
import { saveAdminFYSettings, type FYSettingsRow } from './actions';

const MONTHS = [
  { value: 1, label: 'January' }, { value: 2, label: 'February' },
  { value: 3, label: 'March' }, { value: 4, label: 'April' },
  { value: 5, label: 'May' }, { value: 6, label: 'June' },
  { value: 7, label: 'July' }, { value: 8, label: 'August' },
  { value: 9, label: 'September' }, { value: 10, label: 'October' },
  { value: 11, label: 'November' }, { value: 12, label: 'December' },
];

export default function FYSettingsClient({ settings, isDirector }: { settings: FYSettingsRow; isDirector: boolean }) {
  const [currentFY, setCurrentFY] = useState(settings.currentFY);
  const [draftOpenMonth, setDraftOpenMonth] = useState(settings.draftOpenMonth);
  const [draftOpenDay, setDraftOpenDay] = useState(settings.draftOpenDay);
  const [lockOpenMonth, setLockOpenMonth] = useState(settings.lockOpenMonth);
  const [lockOpenDay, setLockOpenDay] = useState(settings.lockOpenDay);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();

  function handleSave() {
    setError(null);
    setSaved(false);
    startSave(async () => {
      const res = await saveAdminFYSettings({ currentFY, draftOpenMonth, draftOpenDay, lockOpenMonth, lockOpenDay });
      if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 3000); }
      else setError(res.error ?? 'Save failed.');
    });
  }

  const fieldClass = 'text-sm border border-zinc-300 rounded px-2 py-1.5 bg-white disabled:bg-zinc-50 disabled:text-zinc-400';

  return (
    <div className="bg-white border border-zinc-200 rounded-lg p-5 space-y-5">
      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">Current Financial Year</label>
        <input
          type="text"
          value={currentFY}
          onChange={(e) => setCurrentFY(e.target.value)}
          disabled={!isDirector}
          placeholder="e.g. FY27"
          className={fieldClass + ' w-32'}
        />
        <p className="text-xs text-zinc-400 mt-1">The FY being budgeted for. Changing this does not delete existing records.</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-2">Draft window opens</label>
        <div className="flex items-center gap-2">
          <input
            type="number" min={1} max={31}
            value={draftOpenDay}
            onChange={(e) => setDraftOpenDay(Number(e.target.value))}
            disabled={!isDirector}
            className={fieldClass + ' w-16'}
          />
          <select
            value={draftOpenMonth}
            onChange={(e) => setDraftOpenMonth(Number(e.target.value))}
            disabled={!isDirector}
            className={fieldClass}
          >
            {MONTHS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
        <p className="text-xs text-zinc-400 mt-1">Default: 1 April. Backlog Budget page enters Draft mode on this date.</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-2">Lock window opens</label>
        <div className="flex items-center gap-2">
          <input
            type="number" min={1} max={31}
            value={lockOpenDay}
            onChange={(e) => setLockOpenDay(Number(e.target.value))}
            disabled={!isDirector}
            className={fieldClass + ' w-16'}
          />
          <select
            value={lockOpenMonth}
            onChange={(e) => setLockOpenMonth(Number(e.target.value))}
            disabled={!isDirector}
            className={fieldClass}
          >
            {MONTHS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
        <p className="text-xs text-zinc-400 mt-1">Default: 1 July. Backlog Budget page enters Ready to Lock mode on this date.</p>
      </div>

      {isDirector ? (
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="text-sm bg-blue-600 text-white font-medium px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
          {saved && <span className="text-sm text-emerald-600">Saved ✓</span>}
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>
      ) : (
        <p className="text-xs text-zinc-400">Only Directors can edit these settings.</p>
      )}
    </div>
  );
}
