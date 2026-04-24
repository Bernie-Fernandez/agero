'use client';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

type XeroConn = {
  id: string;
  status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
  xeroOrgName: string | null;
  connectedAt: string;
  lastUsedAt: string | null;
  connectedBy: { firstName: string; lastName: string };
} | null;

export default function XeroSettingsClient({ connection }: { connection: XeroConn }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const justConnected = searchParams.get('connected') === '1';
  const [disconnecting, setDisconnecting] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const isConnected = connection?.status === 'CONNECTED';

  async function handleDisconnect() {
    setDisconnecting(true);
    await fetch('/api/xero/disconnect', { method: 'POST' });
    setDisconnecting(false);
    setConfirmDisconnect(false);
    router.refresh();
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-zinc-900">Xero Connection</h1>
        <p className="text-sm text-zinc-500 mt-1">Connect Xero to pull monthly P&L, balance sheet, and AR/AP data.</p>
      </div>

      {justConnected && (
        <div className="mb-4 px-4 py-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          Xero connected successfully.
        </div>
      )}

      <div className="bg-white border border-zinc-200 rounded-xl p-6 space-y-6">
        {/* Connection status */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`inline-block w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-zinc-300'}`} />
              <span className="text-sm font-semibold text-zinc-900">
                {isConnected ? 'Connected' : 'Not Connected'}
              </span>
            </div>
            {isConnected && connection && (
              <div className="text-sm text-zinc-500 space-y-0.5 mt-2">
                {connection.xeroOrgName && (
                  <div>Organisation: <span className="text-zinc-700 font-medium">{connection.xeroOrgName}</span></div>
                )}
                <div>
                  Connected by: <span className="text-zinc-700">{connection.connectedBy.firstName} {connection.connectedBy.lastName}</span>
                </div>
                <div>
                  Connected at: <span className="text-zinc-700">
                    {new Date(connection.connectedAt).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                </div>
                {connection.lastUsedAt && (
                  <div>
                    Last sync: <span className="text-zinc-700">
                      {new Date(connection.lastUsedAt).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            {!isConnected && (
              <a
                href="/api/xero/connect"
                className="px-4 py-2 bg-brand hover:bg-brand/90 text-white text-sm font-medium rounded-lg"
              >
                Connect Xero
              </a>
            )}
            {isConnected && (
              <button
                onClick={() => setConfirmDisconnect(true)}
                className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-medium rounded-lg border border-red-200"
              >
                Disconnect
              </button>
            )}
          </div>
        </div>

        <hr className="border-zinc-100" />

        <div>
          <h2 className="text-sm font-semibold text-zinc-700 mb-2">Requirements</h2>
          <ul className="text-sm text-zinc-500 space-y-1 list-disc list-inside">
            <li>Xero plan must include API access (Settings → General Settings → Connected Apps)</li>
            <li>Set <code className="bg-zinc-100 px-1 rounded text-xs">XERO_CLIENT_ID</code>, <code className="bg-zinc-100 px-1 rounded text-xs">XERO_CLIENT_SECRET</code>, <code className="bg-zinc-100 px-1 rounded text-xs">XERO_REDIRECT_URI</code>, and <code className="bg-zinc-100 px-1 rounded text-xs">XERO_TOKEN_SECRET</code> in Vercel environment variables</li>
            <li>Redirect URI for staging: <code className="bg-zinc-100 px-1 rounded text-xs">https://staging.agero.com.au/api/xero/callback</code></li>
          </ul>
        </div>
      </div>

      {/* Disconnect Confirmation */}
      {confirmDisconnect && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-base font-semibold text-zinc-900 mb-2">Disconnect Xero?</h2>
            <p className="text-sm text-zinc-600 mb-6">
              This will remove the stored Xero tokens. You will need to reconnect to sync data.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDisconnect(false)} className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900">Cancel</button>
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg disabled:opacity-50"
              >
                {disconnecting ? 'Disconnecting…' : 'Disconnect'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
