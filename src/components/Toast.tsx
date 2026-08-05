import { useEffect, useState, useCallback } from 'react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

let listeners: ((items: ToastItem[]) => void)[] = [];
let items: ToastItem[] = [];
let idCounter = 0;

export function showToast(message: string, type: ToastType = 'info', duration = 2500) {
  const item = { id: ++idCounter, type, message };
  items = [...items, item];
  listeners.forEach((l) => l(items));
  setTimeout(() => {
    items = items.filter((i) => i.id !== item.id);
    listeners.forEach((l) => l(items));
  }, duration);
}

const ICONS: Record<ToastType, string> = {
  success: '✓',
  error: '✕',
  info: 'i',
  warning: '!',
};

const COLORS: Record<ToastType, string> = {
  success: 'bg-emerald-500',
  error: 'bg-red-500',
  info: 'bg-primary-600',
  warning: 'bg-amber-500',
};

export default function Toast() {
  const [list, setList] = useState<ToastItem[]>([]);

  useEffect(() => {
    const cb = (items: ToastItem[]) => setList(items);
    listeners.push(cb);
    return () => {
      listeners = listeners.filter((l) => l !== cb);
    };
  }, []);

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 pointer-events-none">
      {list.map((item) => (
        <div
          key={item.id}
          className="fade-in flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-lg text-white text-sm font-medium"
          style={{ backgroundColor: COLORS[item.type].includes('emerald') ? '#10b981' : COLORS[item.type].includes('red') ? '#ef4444' : COLORS[item.type].includes('amber') ? '#f59e0b' : '#2563eb' }}
        >
          <span className="w-5 h-5 rounded-full bg-white/30 flex items-center justify-center text-xs font-bold">
            {ICONS[item.type]}
          </span>
          <span>{item.message}</span>
        </div>
      ))}
    </div>
  );
}
