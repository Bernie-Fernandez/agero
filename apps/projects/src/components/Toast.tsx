'use client';
import { useEffect, useState } from 'react';

export type ToastType = 'success' | 'error';

let toastListeners: ((msg: string, type: ToastType) => void)[] = [];

export function showToast(msg: string, type: ToastType = 'success') {
  toastListeners.forEach((fn) => fn(msg, type));
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: ToastType }[]>([]);

  useEffect(() => {
    const handler = (msg: string, type: ToastType) => {
      const id = Date.now();
      setToasts((prev) => [...prev, { id, msg, type }]);
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
    };
    toastListeners.push(handler);
    return () => { toastListeners = toastListeners.filter((fn) => fn !== handler); };
  }, []);

  if (!toasts.length) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`px-4 py-2.5 rounded-lg text-sm font-medium shadow-lg text-white transition-all ${t.type === 'error' ? 'bg-red-600' : 'bg-zinc-900'}`}
        >
          {t.msg}
        </div>
      ))}
    </div>
  );
}
