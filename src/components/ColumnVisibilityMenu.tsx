import { useEffect, useMemo, useRef, useState } from 'react';

export interface ColumnOption {
  key: string;
  label: string;
  group: string;
}

export function useColumnVisibility(storageKey: string, columns: ColumnOption[]) {
  const allKeys = useMemo(() => columns.map((column) => column.key), [columns]);
  const signature = allKeys.join('|');
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(() => loadVisibleKeys(storageKey, allKeys));

  useEffect(() => {
    setVisibleKeys((current) => {
      const valid = new Set([...current].filter((key) => allKeys.includes(key)));
      return setsEqual(current, valid) ? current : valid;
    });
  }, [storageKey, signature]);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify([...visibleKeys]));
  }, [storageKey, visibleKeys]);

  return {
    visibleKeys,
    toggleColumn: (key: string) => setVisibleKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    }),
    showAll: () => setVisibleKeys(new Set(allKeys)),
    reset: () => setVisibleKeys(new Set(allKeys)),
  };
}

export default function ColumnVisibilityMenu({
  columns,
  visibleKeys,
  onToggle,
  onShowAll,
  onReset,
}: {
  columns: ColumnOption[];
  visibleKeys: Set<string>;
  onToggle: (key: string) => void;
  onShowAll: () => void;
  onReset: () => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const groups = useMemo(() => {
    const grouped = new Map<string, ColumnOption[]>();
    columns.forEach((column) => grouped.set(column.group, [...(grouped.get(column.group) || []), column]));
    return [...grouped.entries()];
  }, [columns]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative ml-auto">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="btn-secondary text-xs whitespace-nowrap"
        aria-expanded={open}
      >
        ⚙ 列设置 <span className="text-slate-400">{visibleKeys.size}/{columns.length}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-[min(26rem,calc(100vw-2rem))] max-h-[70vh] overflow-y-auto rounded-lg border border-slate-200 bg-white p-3 text-left shadow-xl dark:border-slate-600 dark:bg-slate-800">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-700">
            <span className="font-medium text-slate-700 dark:text-slate-200">显示字段</span>
            <div className="flex gap-1">
              <button type="button" onClick={onShowAll} className="btn-ghost text-xs">全选</button>
              <button type="button" onClick={onReset} className="btn-ghost text-xs">恢复默认</button>
            </div>
          </div>
          <div className="mt-3 space-y-3">
            {groups.map(([group, options]) => (
              <section key={group}>
                <div className="mb-1.5 text-xs font-medium text-slate-400">{group}</div>
                <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                  {options.map((option) => (
                    <label key={option.key} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700">
                      <input
                        type="checkbox"
                        checked={visibleKeys.has(option.key)}
                        onChange={() => onToggle(option.key)}
                        className="h-4 w-4"
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function loadVisibleKeys(storageKey: string, allKeys: string[]): Set<string> {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (Array.isArray(stored)) return new Set(stored.filter((key): key is string => typeof key === 'string' && allKeys.includes(key)));
  } catch {
    // Invalid saved settings fall back to the current defaults.
  }
  return new Set(allKeys);
}

function setsEqual(left: Set<string>, right: Set<string>) {
  return left.size === right.size && [...left].every((key) => right.has(key));
}
