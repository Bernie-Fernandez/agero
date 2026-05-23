'use client';
import { useState } from 'react';
import { previewCascade } from '@/lib/crm/cascade';
import { stageLabel, ALL_STAGES } from '@/lib/crm/stage-labels';

type User = { id: string; firstName: string; lastName: string };
type Lead = Record<string, unknown>;

function fmtDate(v: unknown): string {
  if (!v) return '';
  const d = new Date(v as string);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3 mt-5">{children}</h3>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <label className="text-xs text-zinc-500 block mb-1">{label}</label>
      {children}
    </div>
  );
}

const inputClass = "w-full border border-zinc-200 rounded px-2.5 py-1.5 text-sm outline-none focus:ring-1 focus:ring-brand";

export default function LeadDetailPanel({
  lead,
  users,
  portalId,
  onClose,
  onSave,
}: {
  lead: Lead;
  users: User[];
  portalId: string | null;
  onClose: () => void;
  onSave: (updated: Lead) => void;
}) {
  const isNew = !lead.id;
  const [form, setForm] = useState<Record<string, unknown>>({ ...lead });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cascadePreview, setCascadePreview] = useState<Array<{ field: string; from: unknown; to: unknown }>>([]);

  const DATE_FIELDS = ['goNoGoDate','decisionDate','contractDate','startDate','completionDate','leaseExpiryDate'];

  function handleChange(field: string, value: unknown) {
    setForm((prev) => ({ ...prev, [field]: value }));

    if (DATE_FIELDS.slice(0, 5).includes(field)) {
      const currentDates = {
        goNoGoDate: form.goNoGoDate ? new Date(form.goNoGoDate as string) : null,
        decisionDate: form.decisionDate ? new Date(form.decisionDate as string) : null,
        contractDate: form.contractDate ? new Date(form.contractDate as string) : null,
        startDate: form.startDate ? new Date(form.startDate as string) : null,
        completionDate: form.completionDate ? new Date(form.completionDate as string) : null,
        leaseExpiryDate: form.leaseExpiryDate ? new Date(form.leaseExpiryDate as string) : null,
        durationMonths: form.durationMonths as number | null,
      };
      const newVal = value ? new Date(value as string) : null;
      const preview = previewCascade(currentDates, field as 'contractDate', newVal, { contractToStartOffsetDays: 14 });
      setCascadePreview(preview);
    } else {
      setCascadePreview([]);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const url = isNew ? '/api/crm/leads' : `/api/crm/leads/${lead.id}`;
      const method = isNew ? 'POST' : 'PATCH';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Save failed');
        return;
      }
      const updated = await res.json();
      onSave(updated);
      setCascadePreview([]);
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  }

  const syncLogs = (lead.syncLogs as Array<Record<string, unknown>> | undefined) ?? [];
  const hubspotUrl = portalId && lead.hubspotDealId && !String(lead.hubspotDealId).startsWith('erponly-')
    ? `https://app.hubspot.com/contacts/${portalId}/deal/${lead.hubspotDealId}`
    : null;

  return (
    <div className="w-full md:w-[480px] xl:w-[560px] border-l border-zinc-200 bg-white flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200">
        <div>
          <h2 className="font-semibold text-zinc-900 text-sm truncate max-w-[280px]">
            {isNew ? 'New Lead' : (form.leadName as string) || 'Lead Detail'}
          </h2>
          {!isNew && (
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                form.syncStatus === 'SYNCED' ? 'bg-green-100 text-green-700' :
                form.syncStatus === 'CONFLICT' ? 'bg-yellow-100 text-yellow-700' :
                form.syncStatus === 'ERROR' ? 'bg-red-100 text-red-700' :
                'bg-zinc-100 text-zinc-600'
              }`}>{form.syncStatus as string}</span>
              {hubspotUrl && (
                <a href={hubspotUrl} target="_blank" rel="noreferrer" className="text-xs text-brand hover:underline">
                  Open in HubSpot ↗
                </a>
              )}
            </div>
          )}
        </div>
        <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 p-1">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Scrollable form */}
      <div className="flex-1 overflow-y-auto px-5 py-2">
        {error && <p className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}

        <SectionTitle>Identity</SectionTitle>
        <Field label="Lead Name">
          <input className={inputClass} value={(form.leadName as string) ?? ''} onChange={(e) => handleChange('leadName', e.target.value)} />
        </Field>
        <Field label="Stage">
          <select className={inputClass} value={(form.stage as string) ?? 'RESEARCH'} onChange={(e) => handleChange('stage', e.target.value)}>
            {ALL_STAGES.map((s) => <option key={s} value={s}>{stageLabel(s)}</option>)}
          </select>
        </Field>
        <Field label="Owner">
          <select className={inputClass} value={(form.ownerUserId as string) ?? ''} onChange={(e) => handleChange('ownerUserId', e.target.value || null)}>
            <option value="">No owner</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
          </select>
        </Field>
        <Field label="Location">
          <input className={inputClass} value={(form.projectLocation as string) ?? ''} onChange={(e) => handleChange('projectLocation', e.target.value)} />
        </Field>
        <Field label="Service Type">
          <input className={inputClass} value={(form.serviceType as string) ?? ''} onChange={(e) => handleChange('serviceType', e.target.value)} />
        </Field>
        <Field label="Deal Classification">
          <input className={inputClass} value={(form.dealClassification as string) ?? ''} onChange={(e) => handleChange('dealClassification', e.target.value)} />
        </Field>
        <Field label="Client Type">
          <input className={inputClass} value={(form.clientType as string) ?? ''} onChange={(e) => handleChange('clientType', e.target.value)} />
        </Field>

        <SectionTitle>Financials</SectionTitle>
        <Field label="Contract Value ($)">
          <input type="number" className={inputClass} value={(form.contractValue as string) ?? ''} onChange={(e) => handleChange('contractValue', e.target.value || null)} />
        </Field>
        <Field label="Entry GP %">
          <input type="number" step="0.01" className={inputClass} value={(form.entryGpPct as string) ?? ''} onChange={(e) => handleChange('entryGpPct', e.target.value || null)} />
        </Field>
        <Field label="Confidence Rating">
          <select className={inputClass} value={(form.confidenceRating as string) ?? ''} onChange={(e) => handleChange('confidenceRating', e.target.value || null)}>
            <option value="">No rating</option>
            <option value="GREEN">Green (High)</option>
            <option value="YELLOW">Yellow (Medium)</option>
            <option value="RED">Red (Low)</option>
          </select>
        </Field>
        <Field label="Probability %">
          <input type="number" step="0.01" min="0" max="1" className={inputClass} value={(form.probabilityPct as string) ?? ''} onChange={(e) => handleChange('probabilityPct', e.target.value || null)} placeholder="e.g. 0.75 for 75%" />
        </Field>
        <Field label="Floor Area (m²)">
          <input type="number" className={inputClass} value={(form.floorAreaM2 as string) ?? ''} onChange={(e) => handleChange('floorAreaM2', e.target.value || null)} />
        </Field>
        <Field label="Duration (months)">
          <input type="number" className={inputClass} value={(form.durationMonths as number) ?? ''} onChange={(e) => handleChange('durationMonths', e.target.value ? parseInt(e.target.value) : null)} />
        </Field>

        <SectionTitle>Dates</SectionTitle>
        {cascadePreview.length > 0 && (
          <div className="mb-3 px-3 py-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
            <strong>Cascade preview:</strong> These dates will be recalculated:{' '}
            {cascadePreview.map((c) => c.field).join(', ')}
          </div>
        )}
        {(['goNoGoDate','decisionDate','contractDate','startDate','completionDate','leaseExpiryDate'] as const).map((field) => (
          <Field key={field} label={field === 'goNoGoDate' ? 'Go / No Go' : field === 'leaseExpiryDate' ? 'Lease Expiry (independent)' : field.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())}>
            <input
              type="date"
              className={inputClass}
              value={fmtDate(form[field])}
              onChange={(e) => handleChange(field, e.target.value || null)}
            />
          </Field>
        ))}

        <SectionTitle>Address</SectionTitle>
        <Field label="Current Address">
          <input className={inputClass} value={(form.currentAddress as string) ?? ''} onChange={(e) => handleChange('currentAddress', e.target.value)} />
        </Field>
        <Field label="Future / Project Address">
          <input className={inputClass} value={(form.futureAddress as string) ?? ''} onChange={(e) => handleChange('futureAddress', e.target.value)} />
        </Field>

        <SectionTitle>Notes</SectionTitle>
        <textarea
          rows={3}
          className={`${inputClass} resize-none`}
          value={(form.notes as string) ?? ''}
          onChange={(e) => handleChange('notes', e.target.value)}
          placeholder="Internal notes — not synced to HubSpot"
        />

        {syncLogs.length > 0 && (
          <>
            <SectionTitle>Recent Sync Events</SectionTitle>
            <div className="space-y-1.5 mb-4">
              {syncLogs.map((log, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-zinc-500 border-b border-zinc-50 pb-1.5">
                  <span className={`font-medium ${log.status === 'SUCCESS' ? 'text-green-600' : log.status === 'ERROR' ? 'text-red-500' : 'text-yellow-500'}`}>
                    {log.status as string}
                  </span>
                  <span>{log.direction as string} · {log.operation as string}</span>
                  <span className="ml-auto">{new Date(log.syncedAt as string).toLocaleString('en-AU')}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-zinc-200 px-5 py-3 flex gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 bg-brand text-white text-sm py-2 rounded font-medium hover:bg-brand/90 disabled:opacity-50"
        >
          {saving ? 'Saving…' : isNew ? 'Create Lead' : 'Save & Sync to HubSpot'}
        </button>
        <button onClick={onClose} className="px-4 py-2 text-sm text-zinc-500 hover:text-zinc-700">
          Cancel
        </button>
      </div>
    </div>
  );
}
