'use client';

import { useState } from 'react';
import { saveXeroWipSettings } from '@/lib/month-end/actions';

export function XeroWipSettingsClient({
  initial,
}: {
  initial: { openingWipAccountCode: string; closingWipAccountCode: string };
}) {
  const [opening, setOpening] = useState(initial.openingWipAccountCode);
  const [closing, setClosing] = useState(initial.closingWipAccountCode);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  async function handleSave() {
    setSaving(true);
    setResult(null);
    const res = await saveXeroWipSettings({
      openingWipAccountCode: opening.trim(),
      closingWipAccountCode: closing.trim(),
    });
    setSaving(false);
    setResult({ ok: res.ok, msg: res.ok ? 'Settings saved.' : (res.error ?? 'Failed to save.') });
  }

  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-6 space-y-5">
      <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700">
        These are Agero&apos;s confirmed Xero WIP accounts (June 2026 chart of accounts).<br />
        Do NOT change unless your accountant advises a different code.
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-zinc-700 block mb-1">
            Opening WIP account code
          </label>
          <p className="text-xs text-zinc-400 mb-2">330 — Opening WIP (Direct Costs, P&L)</p>
          <input
            type="text"
            value={opening}
            onChange={(e) => setOpening(e.target.value)}
            className="border border-zinc-300 rounded-lg px-3 py-2 text-sm w-full"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-zinc-700 block mb-1">
            Closing WIP account code
          </label>
          <p className="text-xs text-zinc-400 mb-2">370 — Closing WIP (Direct Costs, P&L)</p>
          <input
            type="text"
            value={closing}
            onChange={(e) => setClosing(e.target.value)}
            className="border border-zinc-300 rounded-lg px-3 py-2 text-sm w-full"
          />
        </div>
      </div>

      {result && (
        <p className={`text-sm ${result.ok ? 'text-green-700' : 'text-red-600'}`}>{result.msg}</p>
      )}

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
