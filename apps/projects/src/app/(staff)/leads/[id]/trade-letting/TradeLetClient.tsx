'use client';
import { useState, useTransition } from 'react';
import { showToast, ToastContainer } from '@/components/Toast';
import { createTradePackage, addTradeQuote, awardQuote } from '../actions';

type Subcontractor = { id: string; name: string };
type TradeSection = { id: string; name: string; code: string | null };
type Quote = {
  id: string;
  amount: number | string | null;
  status: string;
  notes: string | null;
  subcontractor: Subcontractor | null;
};
type Package = {
  id: string;
  name: string;
  scope: string | null;
  status: string;
  tradeSection: { name: string; code: string | null } | null;
  quotes: Quote[];
};

function fmt(n: number) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(n);
}

const STATUS_COLORS: Record<string, string> = {
  NOT_STARTED: 'bg-zinc-100 text-zinc-600',
  QUOTING: 'bg-blue-100 text-blue-700',
  AWARDED: 'bg-green-100 text-green-700',
  COMPLETE: 'bg-teal-100 text-teal-700',
};

const QUOTE_STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-zinc-100 text-zinc-600',
  RECEIVED: 'bg-blue-100 text-blue-700',
  AWARDED: 'bg-green-100 text-green-700',
  DECLINED: 'bg-red-100 text-red-700',
};

export default function TradeLetClient({
  estimateId,
  packages,
  tradeSections,
  subcontractors,
}: {
  estimateId: string;
  packages: Package[];
  tradeSections: TradeSection[];
  subcontractors: Subcontractor[];
}) {
  const [pending, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [addingQuoteFor, setAddingQuoteFor] = useState<string | null>(null);

  function handleCreatePackage(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      await createTradePackage(estimateId, fd);
      setShowAdd(false);
      showToast('Trade package created');
    });
  }

  function handleAddQuote(packageId: string, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      await addTradeQuote(packageId, estimateId, fd);
      setAddingQuoteFor(null);
      showToast('Quote added');
    });
  }

  function handleAward(quoteId: string, packageId: string) {
    if (!confirm('Award this quote? All other quotes for this package will be declined.')) return;
    startTransition(async () => {
      await awardQuote(quoteId, packageId, estimateId);
      showToast('Quote awarded');
    });
  }

  return (
    <div className="h-full overflow-auto bg-zinc-50 p-6">
      <ToastContainer />
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-zinc-800">Trade Letting</h2>
          <button onClick={() => setShowAdd(true)} className="px-3 py-1.5 text-sm bg-brand text-white rounded-md hover:bg-brand/90">+ New Package</button>
        </div>

        {showAdd && (
          <form onSubmit={handleCreatePackage} className="bg-white border border-zinc-200 rounded-lg p-5 space-y-3">
            <h3 className="text-sm font-semibold text-zinc-800">New Trade Package</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-zinc-700 mb-1">Package Name *</label>
                <input name="name" required className="w-full border border-zinc-200 rounded px-3 py-1.5 text-sm" placeholder="e.g. Hydraulics Package" />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Trade Section</label>
                <select name="tradeSectionId" className="w-full border border-zinc-200 rounded px-2 py-1.5 text-sm">
                  <option value="">— None —</option>
                  {tradeSections.map((s) => <option key={s.id} value={s.id}>{s.code ? `${s.code} — ` : ''}{s.name}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-zinc-700 mb-1">Scope of Works</label>
                <textarea name="scope" rows={3} className="w-full border border-zinc-200 rounded px-3 py-1.5 text-sm resize-none" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowAdd(false)} className="px-3 py-1.5 text-sm border border-zinc-200 rounded">Cancel</button>
              <button type="submit" disabled={pending} className="px-3 py-1.5 text-sm bg-brand text-white rounded disabled:opacity-50">Create</button>
            </div>
          </form>
        )}

        {packages.length === 0 ? (
          <div className="text-center py-16 text-sm text-zinc-400 bg-white rounded-lg border border-zinc-200">No trade packages yet. Create one to start the trade letting process.</div>
        ) : (
          packages.map((pkg) => {
            const awardedQuote = pkg.quotes.find((q) => q.status === 'AWARDED');
            const receivedQuotes = pkg.quotes.filter((q) => q.status === 'RECEIVED');
            const minQuote = receivedQuotes.length > 0 ? Math.min(...receivedQuotes.map((q) => Number(q.amount ?? Infinity))) : null;

            return (
              <div key={pkg.id} className="bg-white border border-zinc-200 rounded-lg p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-zinc-800">{pkg.name}</h3>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${STATUS_COLORS[pkg.status]}`}>{pkg.status.replace('_', ' ')}</span>
                    </div>
                    {pkg.tradeSection && <p className="text-xs text-zinc-500 mt-0.5">{pkg.tradeSection.code ? `${pkg.tradeSection.code} — ` : ''}{pkg.tradeSection.name}</p>}
                    {pkg.scope && <p className="text-xs text-zinc-400 mt-1">{pkg.scope}</p>}
                  </div>
                  {awardedQuote && (
                    <div className="text-right">
                      <p className="text-sm font-bold text-green-700">{fmt(Number(awardedQuote.amount ?? 0))}</p>
                      <p className="text-xs text-zinc-500">{awardedQuote.subcontractor?.name ?? 'Unknown'}</p>
                    </div>
                  )}
                </div>

                {/* Quotes */}
                {pkg.quotes.length > 0 && (
                  <div className="mb-3">
                    <table className="w-full text-xs">
                      <thead><tr className="border-b border-zinc-100"><th className="py-1 text-left text-zinc-500">Subcontractor</th><th className="py-1 text-right text-zinc-500">Amount</th><th className="py-1 text-center text-zinc-500">Status</th><th className="py-1"></th></tr></thead>
                      <tbody>
                        {pkg.quotes.map((quote) => (
                          <tr key={quote.id} className="border-b border-zinc-50">
                            <td className="py-1.5 text-zinc-700">{quote.subcontractor?.name ?? '—'}</td>
                            <td className="py-1.5 text-right text-zinc-800 font-medium">
                              {quote.amount != null ? fmt(Number(quote.amount)) : '—'}
                              {minQuote != null && Number(quote.amount) === minQuote && <span className="ml-1 text-green-600">★</span>}
                            </td>
                            <td className="py-1.5 text-center"><span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${QUOTE_STATUS_COLORS[quote.status]}`}>{quote.status}</span></td>
                            <td className="py-1.5 text-right">
                              {quote.status === 'RECEIVED' && pkg.status !== 'AWARDED' && (
                                <button onClick={() => handleAward(quote.id, pkg.id)} className="text-xs text-green-600 hover:underline">Award</button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {addingQuoteFor === pkg.id ? (
                  <form onSubmit={(e) => handleAddQuote(pkg.id, e)} className="flex gap-2 items-end">
                    <div>
                      <label className="block text-xs text-zinc-600 mb-0.5">Subcontractor</label>
                      <select name="subcontractorId" className="border border-zinc-200 rounded px-2 py-1 text-xs">
                        <option value="">— Unknown —</option>
                        {subcontractors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-600 mb-0.5">Amount ($)</label>
                      <input name="amount" type="number" step="0.01" className="border border-zinc-200 rounded px-2 py-1 text-xs w-28" />
                    </div>
                    <button type="submit" disabled={pending} className="px-2 py-1 text-xs bg-brand text-white rounded disabled:opacity-50">Add</button>
                    <button type="button" onClick={() => setAddingQuoteFor(null)} className="px-2 py-1 text-xs border border-zinc-200 rounded">Cancel</button>
                  </form>
                ) : (
                  <button onClick={() => setAddingQuoteFor(pkg.id)} className="text-xs text-brand hover:underline">+ Add Quote</button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
