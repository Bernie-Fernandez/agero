'use client';
import { useState, useTransition } from 'react';
import SlidePanel from '@/components/SlidePanel';
import {
  addDocument,
  getSignedUrl,
  markSuperseded,
  markPricedAgainst,
  saveDrawingConvention,
  addElementCode,
  importElementCodesFromCsv,
  submitQuestionnaireAnswers,
} from './actions';

type Doc = {
  id: string;
  discipline: string;
  documentRef: string;
  documentTitle: string;
  revision: string;
  issueDate: string | null;
  issuedBy: string | null;
  status: string;
  pricedAgainst: boolean;
  storageUrl: string | null;
  uploadSizeBytes: number | null;
  uploadedAt: string | null;
};

type Convention = {
  spaceReferenceStyle: string;
  revisionFormat: string | null;
  drawingNumberFormat: string | null;
  architectFirm: string | null;
  notes: string | null;
} | null;

type ElementCode = {
  id: string;
  code: string;
  category: string;
  name: string;
  description: string | null;
  supplier: string | null;
  locationNotes: string | null;
  leadTime: string | null;
  status: string;
  sourceDocument: string | null;
};

type Question = { id: string; layer: string; questionText: string; isMandatory: boolean; answer: { id: string; answerText: string } | null };
type Report = { id: string; documentId: string; scanStatus: string; questionnaireCompleted: boolean; questions: Question[] };

const DISCIPLINES = [
  'Architectural', 'Structural', 'Mechanical', 'Electrical', 'Hydraulic',
  'Fire', 'FF&E Schedule', 'Finishes Schedule', 'Lighting Schedule', 'Specification', 'Other',
];
const ELEMENT_CATEGORIES = [
  'Floor Finish', 'Ceiling', 'Wall Finish', 'Partition', 'Lighting', 'Furniture', 'Joinery',
  'Sanitary', 'Kitchen', 'Signage', 'Other',
];

export default function DocumentsClient({
  estimateId,
  documents,
  convention,
  elementCodes,
  reports,
}: {
  estimateId: string;
  documents: Doc[];
  convention: Convention;
  elementCodes: ElementCode[];
  reports: Report[];
}) {
  const [activeSection, setActiveSection] = useState<'register' | 'codes'>('register');
  const [showAddDoc, setShowAddDoc] = useState(false);
  const [showConvention, setShowConvention] = useState(false);
  const [showAddCode, setShowAddCode] = useState(false);
  const [showQuestionnaire, setShowQuestionnaire] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [answers, setAnswers] = useState<Record<string, string>>({});

  // Find unanswered report
  const pendingReport = reports.find(
    (r) => r.scanStatus === 'complete' && !r.questionnaireCompleted
  );
  const unansweredCount = pendingReport
    ? pendingReport.questions.filter((q) => q.isMandatory && !q.answer).length
    : 0;

  function handleDownload(storageUrl: string) {
    startTransition(async () => {
      const url = await getSignedUrl(storageUrl);
      if (url) window.open(url, '_blank');
    });
  }

  function handleSubmitQuestionnaire() {
    if (!pendingReport) return;
    const entries = Object.entries(answers).map(([questionId, answerText]) => ({ questionId, answerText }));
    startTransition(async () => {
      await submitQuestionnaireAnswers(pendingReport.id, estimateId, entries);
      setShowQuestionnaire(false);
    });
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Questionnaire banner */}
      {pendingReport && unansweredCount > 0 && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 flex items-center justify-between shrink-0">
          <span className="text-sm text-amber-800">
            Drawing set scan complete — <strong>{unansweredCount}</strong> question{unansweredCount !== 1 ? 's' : ''} require your response before takeoff can proceed.
          </span>
          <button
            onClick={() => setShowQuestionnaire(true)}
            className="text-sm text-amber-700 font-medium underline"
          >
            Answer questions
          </button>
        </div>
      )}

      {/* Sub-section tabs */}
      <div className="border-b border-zinc-200 bg-white px-6 shrink-0">
        <div className="flex gap-0">
          {(['register', 'codes'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setActiveSection(s)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeSection === s
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-zinc-500 hover:text-zinc-800'
              }`}
            >
              {s === 'register' ? 'Document Register' : 'Element Code Library'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {/* ─── Document Register ─── */}
        {activeSection === 'register' && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-zinc-900">Document Register</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowConvention(true)}
                  className="px-3 py-2 text-sm border border-zinc-200 rounded-md bg-white text-zinc-700 hover:bg-zinc-50"
                >
                  Drawing Convention
                </button>
                <button
                  onClick={() => setShowAddDoc(true)}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
                >
                  + Add Document
                </button>
              </div>
            </div>

            {documents.length === 0 ? (
              <div className="bg-zinc-50 border border-dashed border-zinc-300 rounded-lg p-12 text-center">
                <p className="text-sm text-zinc-500">No documents yet. Add a drawing or document to begin.</p>
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100 bg-zinc-50">
                      <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Discipline</th>
                      <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Doc Ref</th>
                      <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Title</th>
                      <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Revision</th>
                      <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Issue Date</th>
                      <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Status</th>
                      <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Priced Against</th>
                      <th className="px-4 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map((doc, idx) => (
                      <tr key={doc.id} className={idx < documents.length - 1 ? 'border-b border-zinc-100' : ''}>
                        <td className="px-4 py-2.5 text-xs text-zinc-700">{doc.discipline}</td>
                        <td className="px-4 py-2.5 font-mono text-xs text-zinc-600">{doc.documentRef}</td>
                        <td className="px-4 py-2.5 text-zinc-800">{doc.documentTitle}</td>
                        <td className="px-4 py-2.5 font-mono text-xs text-zinc-600">{doc.revision}</td>
                        <td className="px-4 py-2.5 text-xs text-zinc-500">
                          {doc.issueDate ? new Date(doc.issueDate).toLocaleDateString('en-AU') : '—'}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            doc.status === 'current' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                          }`}>
                            {doc.status === 'current' ? 'Current' : 'Superseded'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <input
                            type="radio"
                            name={`priced-${doc.discipline}`}
                            checked={doc.pricedAgainst}
                            onChange={() =>
                              startTransition(() => markPricedAgainst(doc.id, estimateId, doc.discipline))
                            }
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2 justify-end">
                            {doc.storageUrl && (
                              <button
                                onClick={() => handleDownload(doc.storageUrl!)}
                                className="text-xs text-blue-600 hover:underline"
                              >
                                Download
                              </button>
                            )}
                            {doc.status === 'current' && (
                              <button
                                onClick={() => startTransition(() => markSuperseded(doc.id, estimateId))}
                                className="text-xs text-zinc-400 hover:text-red-600"
                              >
                                Supersede
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Scan status */}
            {reports.map((r) => (
              <div key={r.id} className={`mt-4 px-4 py-3 rounded-lg border text-sm ${
                r.scanStatus === 'complete' && r.questionnaireCompleted
                  ? 'bg-green-50 border-green-200 text-green-800'
                  : r.scanStatus === 'pending'
                  ? 'bg-blue-50 border-blue-200 text-blue-800'
                  : r.scanStatus === 'failed'
                  ? 'bg-red-50 border-red-200 text-red-800'
                  : 'bg-amber-50 border-amber-200 text-amber-800'
              }`}>
                {r.scanStatus === 'pending' && 'Drawing intelligence scan running...'}
                {r.scanStatus === 'failed' && 'Drawing intelligence scan failed. Please contact support.'}
                {r.scanStatus === 'complete' && r.questionnaireCompleted && 'Drawing set clean — questionnaire complete.'}
                {r.scanStatus === 'complete' && !r.questionnaireCompleted && `${r.questions.filter((q) => q.isMandatory && !q.answer).length} mandatory questions pending.`}
              </div>
            ))}
          </>
        )}

        {/* ─── Element Code Library ─── */}
        {activeSection === 'codes' && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-zinc-900">Element Code Library</h2>
              <div className="flex gap-2">
                <form
                  action={async (fd: FormData) => {
                    await importElementCodesFromCsv(estimateId, fd);
                  }}
                  className="flex gap-2"
                >
                  <label className="px-3 py-2 text-sm border border-zinc-200 rounded-md bg-white text-zinc-700 hover:bg-zinc-50 cursor-pointer">
                    Import CSV
                    <input name="csv" type="file" accept=".csv" className="hidden" onChange={(e) => e.target.form?.requestSubmit()} />
                  </label>
                </form>
                <button
                  onClick={() => setShowAddCode(true)}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
                >
                  + Add Code
                </button>
              </div>
            </div>

            {elementCodes.length === 0 ? (
              <div className="bg-zinc-50 border border-dashed border-zinc-300 rounded-lg p-12 text-center">
                <p className="text-sm text-zinc-500">No element codes yet. Add codes manually or import from CSV.</p>
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100 bg-zinc-50">
                      <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Code</th>
                      <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Category</th>
                      <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Name</th>
                      <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Supplier</th>
                      <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Location</th>
                      <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Lead Time</th>
                      <th className="text-left px-4 py-2.5 font-medium text-zinc-500 text-xs">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {elementCodes.map((code, idx) => (
                      <tr key={code.id} className={idx < elementCodes.length - 1 ? 'border-b border-zinc-100' : ''}>
                        <td className="px-4 py-2.5 font-mono text-xs font-bold text-zinc-700">{code.code}</td>
                        <td className="px-4 py-2.5 text-xs text-zinc-500">{code.category}</td>
                        <td className="px-4 py-2.5 text-zinc-800">{code.name}</td>
                        <td className="px-4 py-2.5 text-xs text-zinc-500">{code.supplier ?? '—'}</td>
                        <td className="px-4 py-2.5 text-xs text-zinc-500">{code.locationNotes ?? '—'}</td>
                        <td className="px-4 py-2.5 text-xs text-zinc-500">{code.leadTime ?? '—'}</td>
                        <td className="px-4 py-2.5 text-xs text-zinc-400">{code.sourceDocument ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* ─── Add Document panel ─── */}
      <SlidePanel isOpen={showAddDoc} onClose={() => setShowAddDoc(false)} title="Add Document">
        <form action={async (fd: FormData) => { await addDocument(estimateId, fd); setShowAddDoc(false); }} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Discipline *</label>
            <select name="discipline" required className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-md">
              {DISCIPLINES.map((d) => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Document Ref *</label>
            <input name="documentRef" required placeholder="e.g. 1100, A302" className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-md" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Title *</label>
            <input name="documentTitle" required placeholder="e.g. GA Plan Level 9" className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-md" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Revision *</label>
            <input name="revision" required placeholder="e.g. TD01, Rev G" className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-md" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Issue Date</label>
            <input name="issueDate" type="date" className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-md" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Issued By</label>
            <input name="issuedBy" placeholder="Architect / engineer firm" className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-md" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Upload PDF (optional, max 50MB)</label>
            <input name="pdf" type="file" accept=".pdf" className="w-full text-sm" />
          </div>
          <div className="pt-2 flex gap-3">
            <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700">Add Document</button>
            <button type="button" onClick={() => setShowAddDoc(false)} className="px-4 py-2 text-sm border border-zinc-200 rounded-md">Cancel</button>
          </div>
        </form>
      </SlidePanel>

      {/* ─── Drawing Convention panel ─── */}
      <SlidePanel isOpen={showConvention} onClose={() => setShowConvention(false)} title="Drawing Convention Settings">
        <form action={async (fd: FormData) => { await saveDrawingConvention(estimateId, fd); setShowConvention(false); }} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Space Reference Style</label>
            <select name="spaceReferenceStyle" defaultValue={convention?.spaceReferenceStyle ?? 'plain_english'} className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-md">
              <option value="plain_english">Plain English</option>
              <option value="alphanumeric_code">Alphanumeric Code</option>
              <option value="custom">Custom</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Revision Format</label>
            <input name="revisionFormat" defaultValue={convention?.revisionFormat ?? ''} placeholder="e.g. DD01-TD01, Rev A-Z" className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-md" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Drawing Number Format</label>
            <input name="drawingNumberFormat" defaultValue={convention?.drawingNumberFormat ?? ''} placeholder="e.g. 4-digit numeric" className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-md" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Architect Firm</label>
            <input name="architectFirm" defaultValue={convention?.architectFirm ?? ''} className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-md" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Notes</label>
            <textarea name="notes" defaultValue={convention?.notes ?? ''} rows={3} className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-md resize-none" />
          </div>
          <div className="pt-2 flex gap-3">
            <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700">Save</button>
            <button type="button" onClick={() => setShowConvention(false)} className="px-4 py-2 text-sm border border-zinc-200 rounded-md">Cancel</button>
          </div>
        </form>
      </SlidePanel>

      {/* ─── Add Element Code panel ─── */}
      <SlidePanel isOpen={showAddCode} onClose={() => setShowAddCode(false)} title="Add Element Code">
        <form action={async (fd: FormData) => { await addElementCode(estimateId, fd); setShowAddCode(false); }} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Code *</label>
            <input name="code" required placeholder="e.g. CPT-03, CT4" className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-md" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Category *</label>
            <select name="category" required className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-md">
              {ELEMENT_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Name *</label>
            <input name="name" required className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-md" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Description</label>
            <textarea name="description" rows={3} className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-md resize-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Supplier</label>
            <input name="supplier" className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-md" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Location Notes</label>
            <input name="locationNotes" placeholder="e.g. Central Collab. Area" className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-md" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Lead Time</label>
            <input name="leadTime" placeholder="e.g. 12 weeks" className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-md" />
          </div>
          <div className="pt-2 flex gap-3">
            <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700">Add Code</button>
            <button type="button" onClick={() => setShowAddCode(false)} className="px-4 py-2 text-sm border border-zinc-200 rounded-md">Cancel</button>
          </div>
        </form>
      </SlidePanel>

      {/* ─── Questionnaire modal ─── */}
      {showQuestionnaire && pendingReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
              <div>
                <h2 className="text-base font-semibold text-zinc-900">Drawing Set Questionnaire</h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {pendingReport.questions.filter((q) => q.isMandatory && !answers[q.id] && !q.answer).length} of {pendingReport.questions.filter((q) => q.isMandatory).length} mandatory questions remaining
                </p>
              </div>
              <button onClick={() => setShowQuestionnaire(false)} className="text-zinc-400 hover:text-zinc-700">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              {['discipline_completeness', 'title_block', 'spatial'].map((layer) => {
                const layerQuestions = pendingReport.questions.filter((q) => q.layer === layer);
                if (layerQuestions.length === 0) return null;
                const layerLabel = layer === 'discipline_completeness' ? 'Discipline Completeness' : layer === 'title_block' ? 'Title Block Verification' : 'Spatial & Scope Gaps';
                return (
                  <div key={layer}>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">{layerLabel}</h3>
                    <div className="space-y-4">
                      {layerQuestions.map((q) => (
                        <div key={q.id} className={`rounded-lg border p-4 ${q.isMandatory ? 'border-zinc-200' : 'border-zinc-100 opacity-75'}`}>
                          <p className="text-sm text-zinc-800 mb-2">
                            {q.isMandatory && <span className="text-red-500 mr-1">*</span>}
                            {q.questionText}
                          </p>
                          {q.answer ? (
                            <p className="text-sm text-green-700 font-medium">Answered: {q.answer.answerText}</p>
                          ) : (
                            <textarea
                              rows={2}
                              placeholder="Your answer..."
                              value={answers[q.id] ?? ''}
                              onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                              className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="px-6 py-4 border-t border-zinc-200 flex justify-end gap-3">
              <button onClick={() => setShowQuestionnaire(false)} className="px-4 py-2 text-sm border border-zinc-200 rounded-md">
                Cancel
              </button>
              <button
                onClick={handleSubmitQuestionnaire}
                disabled={isPending || unansweredCount > Object.keys(answers).length}
                className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {isPending ? 'Submitting...' : 'Submit Answers'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
