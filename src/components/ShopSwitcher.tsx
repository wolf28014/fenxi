import type { Shop } from '@/types';
import { PLATFORM_LABELS } from '@/types';

interface Props {
  shops: Shop[];
  currentShop: Shop | null; // null = 所有店铺
  onSelect: (shop: Shop | null) => void;
}

export default function ShopSwitcher({ shops, currentShop, onSelect }: Props) {
  if (shops.length === 0) {
    return <span className="text-sm text-slate-400">暂无店铺</span>;
  }

  return (
    <select
      value={currentShop?.id || '__all__'}
      onChange={(e) => {
        if (e.target.value === '__all__') {
          onSelect(null);
        } else {
          const s = shops.find((s) => s.id === e.target.value);
          if (s) onSelect(s);
        }
      }}
      className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
    >
      <option value="__all__">所有店铺汇总</option>
      {shops.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name} ({PLATFORM_LABELS[s.platform]})
        </option>
      ))}
    </select>
  );
}
