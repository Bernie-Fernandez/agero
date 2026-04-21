'use client';
import { useState, useEffect, useCallback, useRef } from 'react';

export function useColumnResize(storageKey: string, defaultWidths: Record<string, number>) {
  const [widths, setWidths] = useState<Record<string, number>>(defaultWidths);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) setWidths({ ...defaultWidths, ...JSON.parse(stored) });
    } catch {}
    setHydrated(true);
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(storageKey, JSON.stringify(widths)); } catch {}
  }, [widths, hydrated, storageKey]);

  const startResize = useCallback((col: string, startX: number, startWidth: number) => {
    function onMove(e: MouseEvent) {
      const delta = e.clientX - startX;
      setWidths((prev) => ({ ...prev, [col]: Math.max(60, startWidth + delta) }));
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  return { widths, startResize };
}
