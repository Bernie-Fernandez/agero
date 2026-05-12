'use client';
import { useState, useTransition } from 'react';
import { uploadTakeoffCsv, confirmTakeoffImport } from './actions';

type Measurement = {
  id: string;
  bluebeamToolName: string;
  ageroRef: string | null;
  measurementValue: number;
  unit: string;
  drawingSheet: string | null;
  mappingStatus: string;
  referenceItem: { displayName: string; tradeSectionCode: string } | null;
};

type Import = {
  id: string;
  csvFilename: string;
  importStatus: string;
  rowCount: number | null;
  mappedCount: number | null;
  unmappedCount: number | null;
  createdAt: string;
  measurements: Measurement[];
};

type RefItem = { id: string; ageroRef: string; displayName: string; tradeSectionCode: string };

export default function TakeoffClient({
  estimateId,
  questionnaireRequired,
  imports,
  refItems,
}: {
  estimateId: string;
  questionnaireRequired: boolean;
  imports: Import[];
  refItems: RefItem[];
}) {
  const [isPending, startTransition] = useTransition();
  const [activeImport, setActiveImport] = useState<Import | null>(imports[0] ?? null);

  const pendingImport = activeImport?.importStatus === 'pending' ? activeImport : null;

  if (questionnaireRequired) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
          <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>
        <div className="text-center">
          <h2 className="text-lg font-semibold text-zinc-900 mb-1">Drawing Questionnaire Required</h2>
          <p className="text-sm text-zinc-500 max-w-md">
            Complete the drawing questionnaire on the Documents tab before importing a takeoff.
          </p>
        </div>
        <a href={`/leads/${estimateId}/documents`} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700">
          Go to Documents
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 bg-white shrink-0">
        <h2 className="text-lg font-semibold text-zinc-900">Takeoff Import</h2>
        <form action={async (fd: FormData) => {
          const result = await uploadTakeoffCsv(estimateId, fd);
          if ('importId' in result) {
            window.location.reload();
          }
        }}>
          <label className="cursor-pointer inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700">
            Upload Bluebeam CSV
            <input name="csv" type="file" accept=".csv" className="hidden" onChange={(e) => e.target.form?.requestSubmit()} />
          </label>
        </form>
      </div>

      {imports.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-3">
          <p className="text-sm text-zinc-500">No takeoff imports yet. Upload a Bluebeam CSV to begin.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          {/* Import selector */}
          {imports.length > 1 && (
            <div className="flex gap-2 px-6 py-3 border-b border-zinc-100">
              {imports.map((imp) => (
                <button
                  key={imp.id}
                  onClick={() => setActiveImport(imp)}
                  className={`text-xs px-3 py-1.5 rounded-full ${activeImport?.id === imp.id ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600'}`}
                >
                  {imp.csvFilename}
                </button>
              ))}
            </div>
          )}

          {activeImport && (
            <div className="p-6">
              {/* Summary bar */}
              <div className="flex items-center gap-6 mb-5 px-4 py-3 bg-zinc-50 rounded-lg border border-zinc-200 text-sm">
                <div>
                  <span className="font-semibold text-zinc-900">{activeImport.rowCount ?? 0}</span>
                  <span className="text-zinc-500 ml-1">total rows</span>
                </div>
                <div>
                  <span className="font-semibold text-green-700">{activeImport.mappedCount ?? 0}</span>
                  <span className="text-zinc-500 ml-1">mapped</span>
                </div>
                <div>
                  <span className="font-semibold text-amber-600">{activeImport.unmappedCount ?? 0}</span>
                  <span className="text-zinc-500 ml-1">unmapped</span>
                </div>
                <span className={`ml-auto text-xs px-2 py-1 rounded-full font-medium ${
                  activeImport.importStatus === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {activeImport.importStatus === 'confirmed' ? 'Confirmed' : 'Pending Review'}
                </span>
              </div>

              {/* Measurements table */}
              <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden mb-5">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100 bg-zinc-50">
                      <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Bluebeam Tool Name</th>
                      <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Agero Ref</th>
                      <th className="text-right px-4 py-2.5 font-medium text-zinc-500 text-xs">Qty</th>
                      <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Unit</th>
                      <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Sheet</th>
                      <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Mapped to</th>
                      <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeImport.measurements.map((m, idx) => (
                      <tr
                        key={m.id}
                        className={`${idx < activeImport.measurements.length - 1 ? 'border-b border-zinc-100' : ''} ${
                          m.mappingStatus === 'mapped' ? 'bg-green-50/30' : m.mappingStatus === 'ignored' ? 'opacity-40' : 'bg-amber-50/30'
                        }`}
                      >
                        <td className="px-4 py-2 text-zinc-800">{m.bluebeamToolName}</td>
                        <td className="px-4 py-2 font-mono text-xs text-zinc-600">{m.ageroRef ?? '—'}</td>
                        <td className="px-4 py-2 text-right font-mono text-xs">{m.measurementValue.toFixed(2)}</td>
                        <td className="px-4 py-2 text-xs text-zinc-500">{m.unit}</td>
                        <td className="px-4 py-2 text-xs text-zinc-400">{m.drawingSheet ?? '—'}</td>
                        <td className="px-4 py-2 text-xs text-zinc-700">
                          {m.referenceItem ? (
                            <span>{m.referenceItem.tradeSectionCode} — {m.referenceItem.displayName}</span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            m.mappingStatus === 'mapped' ? 'bg-green-100 text-green-700' :
                            m.mappingStatus === 'ignored' ? 'bg-zinc-100 text-zinc-500' :
                            'bg-amber-100 text-amber-700'
                          }`}>
                            {m.mappingStatus}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Confirm button */}
              {activeImport.importStatus === 'pending' && (
                <div className="flex justify-end">
                  <button
                    onClick={() => startTransition(() => confirmTakeoffImport(activeImport.id, estimateId))}
                    disabled={isPending}
                    className="px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isPending ? 'Confirming...' : 'Confirm Import & Populate Cost Plan'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
