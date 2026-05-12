'use client';
import { useState, useEffect } from 'react';
import SlidePanel from '@/components/SlidePanel';

type BuildUpRow = {
  id: string;
  buildUpType: string;
  description: string;
  unit: string;
  quantityPerBaseUnit: number;
  unitRate: number;
  calculatedCost: number;
  sortOrder: number;
};

type BuildUpData = {
  rows: BuildUpRow[];
  standardRate: number | null;
  displayName: string;
  tradeSectionCode: string;
};

const PRELIM_CODES = ['CP', 'IH', 'JC'];

export default function BuildUpPanel({
  isOpen,
  onClose,
  ageroRef,
  estimateId,
  onApply,
}: {
  isOpen: boolean;
  onClose: () => void;
  ageroRef: string;
  estimateId: string;
  onApply: (rate: number) => void;
}) {
  const [data, setData] = useState<BuildUpData | null>(null);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<BuildUpRow[]>([]);

  useEffect(() => {
    if (!isOpen || !ageroRef) return;
    setLoading(true);
    fetch(`/api/leads/${estimateId}/buildup?ageroRef=${encodeURIComponent(ageroRef)}`)
      .then((r) => r.json())
      .then((d: BuildUpData) => {
        setData(d);
        setRows(d.rows);
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [isOpen, ageroRef, estimateId]);

  const total = rows.reduce((sum, r) => sum + r.calculatedCost, 0);
  const tradeCode = ageroRef.split('.')[0];
  const isPrelim = PRELIM_CODES.includes(tradeCode);

  function updateRow(id: string, field: keyof BuildUpRow, value: string | number) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const updated = { ...r, [field]: value };
        if (field === 'quantityPerBaseUnit' || field === 'unitRate') {
          updated.calculatedCost = Number(updated.quantityPerBaseUnit) * Number(updated.unitRate);
        }
        return updated;
      })
    );
  }

  return (
    <SlidePanel isOpen={isOpen} onClose={onClose} title={`Build-up — ${data?.displayName ?? ageroRef}`}>
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {isPrelim && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-800">
              Preliminaries rates are typically calculated as a percentage of contract value or on a time basis.
              Enter your project-specific calculation here.
            </div>
          )}

          {rows.length === 0 ? (
            <div className="bg-zinc-50 border border-dashed border-zinc-300 rounded-lg p-8 text-center">
              <p className="text-sm text-zinc-500">No build-up defined for this item.</p>
              <p className="text-xs text-zinc-400 mt-1">Add rows below to build up the unit cost from first principles.</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50">
                    <th className="text-left px-3 py-2 font-medium text-zinc-500">Type</th>
                    <th className="text-left px-3 py-2 font-medium text-zinc-500">Description</th>
                    <th className="text-left px-3 py-2 font-medium text-zinc-500">Unit</th>
                    <th className="text-right px-3 py-2 font-medium text-zinc-500">Qty/Unit</th>
                    <th className="text-right px-3 py-2 font-medium text-zinc-500">Rate</th>
                    <th className="text-right px-3 py-2 font-medium text-zinc-500">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr key={row.id} className={idx < rows.length - 1 ? 'border-b border-zinc-100' : ''}>
                      <td className="px-3 py-2">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                          row.buildUpType === 'labour' ? 'bg-blue-100 text-blue-700' :
                          row.buildUpType === 'material' ? 'bg-green-100 text-green-700' :
                          'bg-zinc-100 text-zinc-600'
                        }`}>{row.buildUpType}</span>
                      </td>
                      <td className="px-3 py-2 text-zinc-800">{row.description}</td>
                      <td className="px-3 py-2 text-zinc-500">{row.unit}</td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          value={row.quantityPerBaseUnit}
                          onChange={(e) => updateRow(row.id, 'quantityPerBaseUnit', parseFloat(e.target.value) || 0)}
                          className="w-16 text-right border border-zinc-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          step="0.01"
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          value={row.unitRate}
                          onChange={(e) => updateRow(row.id, 'unitRate', parseFloat(e.target.value) || 0)}
                          className="w-20 text-right border border-zinc-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          step="0.01"
                        />
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-zinc-800">
                        ${row.calculatedCost.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-zinc-200 bg-zinc-50">
                    <td colSpan={5} className="px-3 py-2 text-xs font-semibold text-zinc-700 text-right">
                      Total build-up cost per unit
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-zinc-900">
                      ${total.toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {data?.standardRate != null && (
            <p className="text-xs text-zinc-400">Standard rate: ${data.standardRate.toFixed(2)}</p>
          )}

          <div className="flex gap-2 pt-2">
            <button
              onClick={() => onApply(total)}
              disabled={rows.length === 0}
              className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              Apply to cost plan (${total.toFixed(2)})
            </button>
            {data?.standardRate != null && (
              <button
                onClick={() => onApply(data.standardRate!)}
                className="px-4 py-2 text-sm border border-zinc-200 rounded-md hover:bg-zinc-50"
              >
                Reset to standard
              </button>
            )}
          </div>
        </div>
      )}
    </SlidePanel>
  );
}
