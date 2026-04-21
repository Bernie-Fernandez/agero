'use client';
import { useRef } from 'react';

export function ResizableTh({
  col,
  width,
  onStartResize,
  children,
  className = '',
}: {
  col: string;
  width?: number;
  onStartResize: (col: string, startX: number, startWidth: number) => void;
  children: React.ReactNode;
  className?: string;
}) {
  const thRef = useRef<HTMLTableCellElement>(null);

  function handleMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    const startWidth = thRef.current?.offsetWidth ?? width ?? 120;
    onStartResize(col, e.clientX, startWidth);
  }

  return (
    <th
      ref={thRef}
      style={width ? { width: `${width}px`, minWidth: `${width}px` } : undefined}
      className={`relative select-none ${className}`}
    >
      {children}
      <div
        onMouseDown={handleMouseDown}
        className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-brand/30 transition-colors z-10"
      />
    </th>
  );
}
