import { useEffect, useState, useMemo } from 'react';
import type { Shop, Product, DailyMetric, MonthlyCost, YearType } from '@/types';
import { COST_FIELDS, PROMOTION_FIELDS, PLATFORM_LABELS } from '@/types';
import {
  fetchProducts,
  fetchDailyMetrics,
  fetchMonthlyCosts,
  upsertDailyMetric,
  upsertMonthlyCost,
  updateDailyMetricById,
  updateMonthlyCostById,
  deleteDailyMetric,
  deleteDailyMetrics,
  deleteMonthlyCost,
  deleteMonthlyCosts,
  clearAllMockData,
} from '@/lib/db';
import { showToast } from '@/components/Toast';
import Modal from '@/components/Modal';
import {
  calculateDailyRows,
  calculateMonthlyRows,
  calculateCostTotal,
  formatCurrency,
  formatNumber,
  formatPercent,
  formatRatio,
  getNaturalYearRange,
  getSeasonalYearRange,
  getLastYearSameRange,
} from '@/lib/calc';
import { exportToExcelTemplate, exportDataToExcel, parseExcelFile, executeImportWithProgress } from '@/lib/excel';

interface Props {
  currentShop: Shop | null; // null = 所有店铺
  shops: Shop[];
  setShops: (shops: Shop[]) => void;
  setCurrentShop: (shop: Shop | null) => void;
}

type Tab = 'daily' | 'monthly' | 'cost';
type QuickRangeType = 'thisMonth' | 'lastMonth' | 'last30Days' | 'last90Days' | 'thisNaturalYear' | 'thisSeasonalYear' | 'lastNaturalYear' | 'lastSeasonalYear' | 'custom';

export default function DetailView({ currentShop, shops }: Props) {
  const [tab, setTab] = useState<Tab>('daily');
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [yearType, setYearType] = useState<YearType>('natural');
  const [rangeType, setRangeType] = useState<QuickRangeType>('thisNaturalYear');
  const [customStart, setCustomStart] = useState(new Date().toISOString().slice(0, 10));
  const [customEnd, setCustomEnd] = useState(new Date().toISOString().slice(0, 10));
  const [metrics, setMetrics] = useState<DailyMetric[]>([]);
  const [costs, setCosts] = useState<MonthlyCost[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingMetric, setEditingMetric] = useState<DailyMetric | null>(null);
  const [editingCost, setEditingCost] = useState<MonthlyCost | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  // 计算 range
  const range = useMemo(() => {
    if (rangeType === 'custom') return { start: customStart, end: customEnd };
    if (rangeType === 'thisMonth') {
      const now = new Date();
      return {
        start: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`,
        end: now.toISOString().slice(0, 10),
      };
    }
    if (rangeType === 'lastMonth') {
      const now = new Date();
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      return {
        start: `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}-01`,
        end: lastMonthEnd.toISOString().slice(0, 10),
      };
    }
    if (rangeType === 'last30Days') {
      const now = new Date();
      const d = new Date(now.getTime() - 30 * 86400000);
      return { start: d.toISOString().slice(0, 10), end: now.toISOString().slice(0, 10) };
    }
    if (rangeType === 'last90Days') {
      const now = new Date();
      const d = new Date(now.getTime() - 90 * 86400000);
      return { start: d.toISOString().slice(0, 10), end: now.toISOString().slice(0, 10) };
    }
    if (rangeType === 'thisNaturalYear') return getNaturalYearRange();
    if (rangeType === 'thisSeasonalYear') return getSeasonalYearRange();
    if (rangeType === 'lastNaturalYear') {
      const r = getNaturalYearRange();
      const y = parseInt(r.start.slice(0, 4)) - 1;
      return { start: `${y}-01-01`, end: `${y}-12-31` };
    }
    if (rangeType === 'lastSeasonalYear') {
      const r = getSeasonalYearRange();
      const y = parseInt(r.start.slice(0, 4)) - 1;
      return { start: `${y}-07-01`, end: `${y + 1}-06-30` };
    }
    return { start: customStart, end: customEnd };
  }, [rangeType, customStart, customEnd]);

  // 加载所有店铺的产品
  useEffect(() => {
    if (shops.length === 0) {
      setProducts([]);
      return;
    }
    Promise.all(shops.map((s) => fetchProducts(s.id)))
      .then((results) => setProducts(results.flat()))
      .catch(() => setProducts([]));
  }, [shops]);

  const loadData = async () => {
    setLoading(true);
    try {
      const shopId = currentShop?.id || null;
      const productId = selectedProduct || null;

      if (tab === 'daily' || tab === 'monthly') {
        const data = await fetchDailyMetrics(shopId, productId, range.start, range.end);
        setMetrics(data);
      } else {
        const startYear = parseInt(range.start.slice(0, 4));
        const startMonth = parseInt(range.start.slice(5, 7));
        const endYear = parseInt(range.end.slice(0, 4));
        const endMonth = parseInt(range.end.slice(5, 7));
        const data = await fetchMonthlyCosts(shopId, productId, startYear, startMonth, endYear, endMonth);
        setCosts(data);
      }
    } catch (e: any) {
      showToast(e.message || '加载失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentShop, selectedProduct, range.start, range.end, tab]);

  // 实时同步
  useEffect(() => {
    const handler = () => loadData();
    window.addEventListener('realtime:metrics', handler);
    window.addEventListener('realtime:costs', handler);
    return () => {
      window.removeEventListener('realtime:metrics', handler);
      window.removeEventListener('realtime:costs', handler);
    };
  }, [currentShop, selectedProduct, range.start, range.end, tab]);

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除该记录吗？')) return;
    try {
      if (tab === 'daily' || tab === 'monthly') await deleteDailyMetric(id);
      else await deleteMonthlyCost(id);
      showToast('已删除', 'success');
      loadData();
    } catch (e: any) {
      showToast(e.message || '删除失败', 'error');
    }
  };

  // 计算
  const dailyRows = useMemo(() => calculateDailyRows(metrics), [metrics]);
  const monthlyRows = useMemo(() => calculateMonthlyRows(metrics), [metrics]);

  // 店铺名映射
  const shopNameMap = useMemo(() => {
    const m: Record<string, string> = {};
    shops.forEach((s) => (m[s.id] = s.name));
    return m;
  }, [shops]);

  // 当前选中的店铺（用于新增/编辑时绑定到具体店铺）
  const activeShop = currentShop;

  return (
    <div className="space-y-4">
      {/* 头部 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            {tab === 'daily' ? '销售明细' : tab === 'monthly' ? '销售汇总' : '成本明细'}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {currentShop ? currentShop.name : '所有店铺汇总'}
            {selectedProduct && ` · ${products.find((p) => p.id === selectedProduct)?.name || ''}`}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <button onClick={() => setShowImport(true)} className="btn-secondary">📥 批量导入</button>
          <button
            onClick={() => exportDataToExcel(currentShop || shops[0], selectedProduct ? products.find(p => p.id === selectedProduct)?.name : undefined, { metrics, promotions: [], costs })}
            className="btn-secondary"
          >📤 导出</button>
          <button onClick={() => loadData()} className="btn-secondary">🔄 刷新</button>
          {/* 更多操作下拉 */}
          <div className="relative" style={{ position: 'relative' }}>
            <button
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              className="btn-ghost text-xs"
            >⋯ 更多</button>
            {showMoreMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMoreMenu(false)} />
                <div className="absolute right-0 mt-1 w-56 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-50 py-1">
                  <button
                    onClick={async () => {
                      setShowMoreMenu(false);
                      if (!confirm('确定清空所有店铺的 Mock 数据吗？\n\n将删除：\n• 所有标记为 Mock 的每日指标\n• 所有每日推广明细（Mock 同步生成的）\n• 所有自动生成的月度成本（cost_source=auto）\n\n手动录入的数据不会被删除。')) return;
                      try {
                        const result = await clearAllMockData();
                        showToast(`已清空 Mock 数据：${result.metrics} 条每日指标`, 'success');
                        loadData();
                      } catch (e: any) {
                        showToast(e.message || '清空失败', 'error');
                      }
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                  >🗑 清空 Mock 数据</button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tab 切换 */}
      <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-700 rounded-lg w-fit">
        <button
          onClick={() => setTab('daily')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition ${tab === 'daily' ? 'bg-white dark:bg-slate-800 shadow text-primary-600' : 'text-slate-500'}`}
        >每日销售明细</button>
        <button
          onClick={() => setTab('monthly')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition ${tab === 'monthly' ? 'bg-white dark:bg-slate-800 shadow text-primary-600' : 'text-slate-500'}`}
        >每月销售汇总</button>
        <button
          onClick={() => setTab('cost')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition ${tab === 'cost' ? 'bg-white dark:bg-slate-800 shadow text-primary-600' : 'text-slate-500'}`}
        >成本明细</button>
      </div>

      {/* 筛选条件 */}
      <div className="card p-3 space-y-3">
        {/* 自然年/季节年 + 年份 */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-700 rounded-lg text-xs">
            <button
              onClick={() => setYearType('natural')}
              className={`px-2 py-1 rounded ${yearType === 'natural' ? 'bg-white shadow text-primary-600' : 'text-slate-500'}`}
            >自然年</button>
            <button
              onClick={() => setYearType('seasonal')}
              className={`px-2 py-1 rounded ${yearType === 'seasonal' ? 'bg-white shadow text-primary-600' : 'text-slate-500'}`}
            >季节年</button>
          </div>

          <div className="flex gap-1 flex-wrap">
            {([
              { key: 'thisMonth', label: '本月' },
              { key: 'lastMonth', label: '上月' },
              { key: 'last30Days', label: '近30天' },
              { key: 'last90Days', label: '近90天' },
              { key: 'thisNaturalYear', label: yearType === 'natural' ? '本自然年' : '本季节年' },
              { key: 'lastNaturalYear', label: yearType === 'natural' ? '去年自然年' : '去年季节年' },
              { key: 'custom', label: '自定义' },
            ] as { key: QuickRangeType; label: string }[]).map((r) => (
              <button
                key={r.key}
                onClick={() => {
                  // 自然年/季节年切换时自动调整范围
                  if (yearType === 'seasonal' && r.key === 'thisNaturalYear') {
                    setRangeType('thisSeasonalYear');
                  } else if (yearType === 'seasonal' && r.key === 'lastNaturalYear') {
                    setRangeType('lastSeasonalYear');
                  } else if (yearType === 'natural' && r.key === 'thisNaturalYear') {
                    setRangeType('thisNaturalYear');
                  } else if (yearType === 'natural' && r.key === 'lastNaturalYear') {
                    setRangeType('lastNaturalYear');
                  } else {
                    setRangeType(r.key);
                  }
                }}
                className={`px-2.5 py-1 rounded-md text-xs transition ${
                  rangeType === r.key || (rangeType === 'thisSeasonalYear' && r.key === 'thisNaturalYear') || (rangeType === 'lastSeasonalYear' && r.key === 'lastNaturalYear')
                    ? 'bg-primary-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          <span className="text-xs text-slate-400 ml-auto">
            当前范围：{range.start} 至 {range.end}
          </span>
        </div>

        {/* 自定义日期 */}
        {rangeType === 'custom' && (
          <div className="flex items-center gap-2 text-sm">
            <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800" />
            <span className="text-slate-400">至</span>
            <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800" />
          </div>
        )}

        {/* 产品选择 + 新增 */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">产品：</span>
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm"
            >
              <option value="">全部产品（店铺整体）</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => {
              if (!activeShop) {
                showToast('请先选择一个具体店铺（不能是"所有店铺"）后再新增数据', 'warning');
                return;
              }
              if (tab === 'cost') setEditingCost({} as any);
              else setEditingMetric({} as any);
            }}
            className="btn-primary ml-auto"
          >+ 新增</button>
        </div>
      </div>

      {/* 表格 */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">加载中...</div>
      ) : tab === 'daily' ? (
        <DailySalesTable rows={dailyRows} shopNameMap={shopNameMap} showShop={!currentShop} onEdit={(date) => {
          const m = metrics.find((m) => m.date === date);
          if (m) setEditingMetric(m);
        }} onDelete={handleDelete} onBatchDelete={async (dates: string[]) => {
          try {
            // 按日期找出对应的 metric 记录并批量删除
            const toDelete = metrics.filter((m) => dates.includes(m.date) && (!currentShop || m.shopId === currentShop.id));
            const ids = toDelete.map((m) => m.id);
            await deleteDailyMetrics(ids); // 一次请求批量删除
            showToast(`已删除 ${ids.length} 条数据`, 'success');
            loadData();
          } catch (e: any) {
            showToast(e.message || '批量删除失败', 'error');
          }
        }} />
      ) : tab === 'monthly' ? (
        <MonthlySalesTable rows={monthlyRows} onEdit={() => {}} onDelete={() => {}} />
      ) : (
        <CostTable costs={costs} shopNameMap={shopNameMap} showShop={!currentShop} onEdit={setEditingCost} onDelete={handleDelete} onBatchDelete={async (ids: string[]) => {
          try {
            await deleteMonthlyCosts(ids); // 一次请求批量删除
            showToast(`已删除 ${ids.length} 条成本数据`, 'success');
            loadData();
          } catch (e: any) {
            showToast(e.message || '批量删除失败', 'error');
          }
        }} />
      )}

      {/* 编辑弹窗 */}
      {editingMetric && activeShop && (
        <DailyMetricEditor
          metric={editingMetric}
          shopId={activeShop.id}
          shop={activeShop}
          productId={selectedProduct || null}
          defaultDate={new Date().toISOString().slice(0, 10)}
          onClose={() => setEditingMetric(null)}
          onSaved={() => { setEditingMetric(null); loadData(); }}
        />
      )}
      {editingCost && activeShop && (
        <CostEditor
          cost={editingCost}
          shopId={activeShop.id}
          productId={selectedProduct || null}
          defaultYear={parseInt(range.start.slice(0, 4))}
          defaultMonth={parseInt(range.start.slice(5, 7))}
          onClose={() => setEditingCost(null)}
          onSaved={() => { setEditingCost(null); loadData(); }}
        />
      )}

      {showImport && (
        <ImportModal
          shops={shops}
          defaultShopId={activeShop?.id}
          products={products}
          onClose={() => setShowImport(false)}
          onImported={() => { setShowImport(false); loadData(); }}
        />
      )}
    </div>
  );
}

// ============= 每日销售明细表（含累积值） =============
function DailySalesTable({ rows, shopNameMap, showShop, onEdit, onDelete, onBatchDelete }: {
  rows: any[];
  shopNameMap?: Record<string, string>;
  showShop: boolean;
  onEdit: (date: string) => void;
  onDelete: (id: string) => void;
  onBatchDelete?: (dates: string[]) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchMode, setBatchMode] = useState(false);

  if (rows.length === 0) return <div className="card p-12 text-center text-slate-400">暂无数据</div>;

  const toggleSelect = (date: string) => {
    const next = new Set(selected);
    if (next.has(date)) next.delete(date);
    else next.add(date);
    setSelected(next);
  };

  const toggleSelectAll = () => {
    if (selected.size === rows.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(rows.map((r) => r.date)));
    }
  };

  const handleBatchDelete = () => {
    if (selected.size === 0) {
      showToast('请先选择要删除的行', 'warning');
      return;
    }
    if (!confirm(`确定删除选中的 ${selected.size} 条数据吗？`)) return;
    onBatchDelete?.(Array.from(selected));
    setSelected(new Set());
    setBatchMode(false);
  };

  // 汇总
  const summary = rows.reduce(
    (acc, r) => {
      acc.salesAmount += r.salesAmount;
      acc.orderCount += r.orderCount;
      acc.refundAmount += r.refundAmount;
      acc.promotionCost += r.promotionCost;
      acc.visitorCount += r.visitorCount;
      acc.netSales += r.netSales;
      return acc;
    },
    { salesAmount: 0, orderCount: 0, refundAmount: 0, promotionCost: 0, visitorCount: 0, netSales: 0 },
  );
  const last = rows[rows.length - 1];
  const summaryRefundRate = summary.salesAmount > 0 ? (summary.refundAmount / summary.salesAmount) * 100 : 0;
  const summaryPromoRate = summary.salesAmount > 0 ? (summary.promotionCost / summary.salesAmount) * 100 : 0;
  const summaryROI = summary.promotionCost > 0 ? summary.salesAmount / summary.promotionCost : 0;
  const summaryNetROI = last.cumPromoCost > 0 ? last.cumNetSales / last.cumPromoCost : 0;

  const headers = [
    { key: 'date', label: '日期' },
    ...(showShop ? [{ key: 'shopName', label: '店铺' }] : []),
    { key: 'salesAmount', label: '销售额', type: 'currency' },
    { key: 'orderCount', label: '订单', type: 'number' },
    { key: 'refundAmount', label: '退款', type: 'currency' },
    { key: 'promotionCost', label: '推广费', type: 'currency' },
    { key: 'visitorCount', label: '访客数', type: 'number' },
    { key: 'netSales', label: '净销售', type: 'currency' },
    { key: 'refundRate', label: '退款率', type: 'percent' },
    { key: 'promoRate', label: '推广占比', type: 'percent' },
    { key: 'dailyROI', label: '投产比', type: 'ratio' },
    { key: 'cumSales', label: '累积销售', type: 'currency' },
    { key: 'cumRefund', label: '累积退款', type: 'currency' },
    { key: 'cumRefundRate', label: '累积退款率', type: 'percent' },
    { key: 'cumNetSales', label: '累积净销售', type: 'currency' },
    { key: 'cumPromoCost', label: '累积推广费', type: 'currency' },
    { key: 'cumPromoRate', label: '累积推广占比', type: 'percent' },
    { key: 'cumNetPromoRate', label: '累积净推广率', type: 'percent' },
    { key: 'cumNetROI', label: '累积净投产比', type: 'ratio' },
    { key: 'cumROI', label: '累积投产比', type: 'ratio' },
  ];

  return (
    <div className="space-y-2">
      {/* 批量操作工具栏 */}
      <div className="flex items-center gap-2 text-xs">
        {!batchMode ? (
          <button onClick={() => setBatchMode(true)} className="btn-ghost text-xs">☑ 批量操作</button>
        ) : (
          <>
            <button onClick={toggleSelectAll} className="btn-ghost text-xs">
              {selected.size === rows.length ? '取消全选' : '全选'}
            </button>
            <span className="text-slate-500">已选 {selected.size} 项</span>
            <button
              onClick={handleBatchDelete}
              disabled={selected.size === 0}
              className="btn-danger text-xs"
            >🗑 删除选中</button>
            <button onClick={() => { setBatchMode(false); setSelected(new Set()); }} className="btn-ghost text-xs">取消</button>
          </>
        )}
      </div>

      <div className="card">
        <div className="overflow-auto max-h-[70vh]">
          <table className="w-full text-sm freeze-header">
            <thead className="bg-primary-700 text-white">
              <tr>
                {batchMode && (
                  <th className="px-3 py-2.5 w-10">
                    <input
                      type="checkbox"
                      checked={selected.size === rows.length && rows.length > 0}
                      onChange={toggleSelectAll}
                      className="w-4 h-4"
                    />
                  </th>
                )}
              {headers.map((h) => (
                <th key={h.key} className={`px-3 py-2.5 whitespace-nowrap ${h.type === 'currency' || h.type === 'number' || h.type === 'percent' || h.type === 'ratio' ? 'text-right' : 'text-left'}`}>{h.label}</th>
              ))}
              <th className="px-3 py-2.5 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {rows.map((r, i) => (
              <tr key={i} className={`hover:bg-slate-50 dark:hover:bg-slate-700/30 ${batchMode && selected.has(r.date) ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                {batchMode && (
                  <td className="px-3 py-2 w-10">
                    <input
                      type="checkbox"
                      checked={selected.has(r.date)}
                      onChange={() => toggleSelect(r.date)}
                      className="w-4 h-4"
                    />
                  </td>
                )}
                {headers.map((h) => {
                  const val = r[h.key];
                  let display: string = val;
                  if (h.type === 'currency') display = formatCurrency(val);
                  else if (h.type === 'number') display = formatNumber(val);
                  else if (h.type === 'percent') display = formatPercent(val);
                  else if (h.type === 'ratio') display = formatRatio(val);
                  return (
                    <td key={h.key} className={`px-3 py-2 whitespace-nowrap ${h.type ? 'text-right' : 'text-left'} ${h.key === 'netSales' && val < 0 ? 'text-red-500' : ''} ${h.key === 'refundRate' && val > 10 ? 'text-red-500' : ''}`}>{display}</td>
                  );
                })}
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  {!batchMode && (
                    <>
                      <button onClick={() => onEdit(r.date)} className="text-primary-600 hover:underline text-xs mr-2">编辑</button>
                      <button onClick={() => onDelete(r.date)} className="text-red-500 hover:underline text-xs">删除</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          {/* 汇总行 */}
          <tfoot className="bg-slate-900 text-white">
            <tr className="font-semibold">
              {batchMode && <td className="px-3 py-2.5"></td>}
              <td className="px-3 py-2.5">汇总</td>
              {showShop && <td className="px-3 py-2.5">-</td>}
              <td className="px-3 py-2.5 text-right">{formatCurrency(summary.salesAmount)}</td>
              <td className="px-3 py-2.5 text-right">{formatNumber(summary.orderCount)}</td>
              <td className="px-3 py-2.5 text-right">{formatCurrency(summary.refundAmount)}</td>
              <td className="px-3 py-2.5 text-right">{formatCurrency(summary.promotionCost)}</td>
              <td className="px-3 py-2.5 text-right">{formatNumber(summary.visitorCount)}</td>
              <td className="px-3 py-2.5 text-right">{formatCurrency(summary.netSales)}</td>
              <td className="px-3 py-2.5 text-right">{formatPercent(summaryRefundRate)}</td>
              <td className="px-3 py-2.5 text-right">{formatPercent(summaryPromoRate)}</td>
              <td className="px-3 py-2.5 text-right">{formatRatio(summaryROI)}</td>
              <td className="px-3 py-2.5 text-right">{formatCurrency(last.cumSales)}</td>
              <td className="px-3 py-2.5 text-right">{formatCurrency(last.cumRefund)}</td>
              <td className="px-3 py-2.5 text-right">{formatPercent(last.cumRefundRate)}</td>
              <td className="px-3 py-2.5 text-right">{formatCurrency(last.cumNetSales)}</td>
              <td className="px-3 py-2.5 text-right">{formatCurrency(last.cumPromoCost)}</td>
              <td className="px-3 py-2.5 text-right">{formatPercent(last.cumPromoRate)}</td>
              <td className="px-3 py-2.5 text-right">{formatPercent(last.cumNetPromoRate)}</td>
              <td className="px-3 py-2.5 text-right">{formatRatio(summaryNetROI)}</td>
              <td className="px-3 py-2.5 text-right">{formatRatio(last.cumROI)}</td>
              <td className="px-3 py-2.5"></td>
            </tr>
          </tfoot>
        </table>
        </div>
      </div>
    </div>
  );
}

// ============= 每月销售汇总表 =============
function MonthlySalesTable({ rows, onEdit, onDelete }: { rows: any[]; onEdit: (id: string) => void; onDelete: (id: string) => void }) {
  if (rows.length === 0) return <div className="card p-12 text-center text-slate-400">暂无数据</div>;

  const summary = rows.reduce(
    (acc, r) => {
      acc.salesAmount += r.salesAmount;
      acc.orderCount += r.orderCount;
      acc.refundAmount += r.refundAmount;
      acc.promotionCost += r.promotionCost;
      acc.visitorCount += r.visitorCount;
      acc.netSales += r.netSales;
      return acc;
    },
    { salesAmount: 0, orderCount: 0, refundAmount: 0, promotionCost: 0, visitorCount: 0, netSales: 0 },
  );
  const last = rows[rows.length - 1];
  const summaryRefundRate = summary.salesAmount > 0 ? (summary.refundAmount / summary.salesAmount) * 100 : 0;
  const summaryPromoRate = summary.salesAmount > 0 ? (summary.promotionCost / summary.salesAmount) * 100 : 0;
  const summaryROI = summary.promotionCost > 0 ? summary.salesAmount / summary.promotionCost : 0;
  const summaryNetROI = last.cumPromoCost > 0 ? last.cumNetSales / last.cumPromoCost : 0;

  return (
    <div className="card">
      <div className="overflow-auto max-h-[70vh]">
        <table className="w-full text-sm freeze-header">
          <thead className="bg-primary-700 text-white">
            <tr>
              <th className="px-3 py-2.5 text-left">月份</th>
              <th className="px-3 py-2.5 text-right">销售额</th>
              <th className="px-3 py-2.5 text-right">订单</th>
              <th className="px-3 py-2.5 text-right">退款</th>
              <th className="px-3 py-2.5 text-right">推广费</th>
              <th className="px-3 py-2.5 text-right">访客数</th>
              <th className="px-3 py-2.5 text-right">净销售</th>
              <th className="px-3 py-2.5 text-right">退款率</th>
              <th className="px-3 py-2.5 text-right">推广占比</th>
              <th className="px-3 py-2.5 text-right">月投产比</th>
              <th className="px-3 py-2.5 text-right">累积销售</th>
              <th className="px-3 py-2.5 text-right">累积退款</th>
              <th className="px-3 py-2.5 text-right">累积退款率</th>
              <th className="px-3 py-2.5 text-right">累积净销售</th>
              <th className="px-3 py-2.5 text-right">累积推广费</th>
              <th className="px-3 py-2.5 text-right">累积推广占比</th>
              <th className="px-3 py-2.5 text-right">累积净推广率</th>
              <th className="px-3 py-2.5 text-right">累积净投产比</th>
              <th className="px-3 py-2.5 text-right">累积投产比</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {rows.map((r, i) => (
              <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                <td className="px-3 py-2 whitespace-nowrap">{r.yearMonth}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">{formatCurrency(r.salesAmount)}</td>
                <td className="px-3 py-2 text-right">{formatNumber(r.orderCount)}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">{formatCurrency(r.refundAmount)}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">{formatCurrency(r.promotionCost)}</td>
                <td className="px-3 py-2 text-right">{formatNumber(r.visitorCount)}</td>
                <td className={`px-3 py-2 text-right whitespace-nowrap ${r.netSales < 0 ? 'text-red-500' : ''}`}>{formatCurrency(r.netSales)}</td>
                <td className={`px-3 py-2 text-right ${r.refundRate > 10 ? 'text-red-500' : ''}`}>{formatPercent(r.refundRate)}</td>
                <td className="px-3 py-2 text-right">{formatPercent(r.promoRate)}</td>
                <td className="px-3 py-2 text-right">{formatRatio(r.monthlyROI)}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">{formatCurrency(r.cumSales)}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">{formatCurrency(r.cumRefund)}</td>
                <td className={`px-3 py-2 text-right ${r.cumRefundRate > 10 ? 'text-red-500' : ''}`}>{formatPercent(r.cumRefundRate)}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">{formatCurrency(r.cumNetSales)}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">{formatCurrency(r.cumPromoCost)}</td>
                <td className="px-3 py-2 text-right">{formatPercent(r.cumPromoRate)}</td>
                <td className="px-3 py-2 text-right">{formatPercent(r.cumNetPromoRate)}</td>
                <td className="px-3 py-2 text-right">{formatRatio(r.cumNetROI)}</td>
                <td className="px-3 py-2 text-right">{formatRatio(r.cumROI)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-900 text-white">
            <tr className="font-semibold">
              <td className="px-3 py-2.5">汇总</td>
              <td className="px-3 py-2.5 text-right">{formatCurrency(summary.salesAmount)}</td>
              <td className="px-3 py-2.5 text-right">{formatNumber(summary.orderCount)}</td>
              <td className="px-3 py-2.5 text-right">{formatCurrency(summary.refundAmount)}</td>
              <td className="px-3 py-2.5 text-right">{formatCurrency(summary.promotionCost)}</td>
              <td className="px-3 py-2.5 text-right">{formatNumber(summary.visitorCount)}</td>
              <td className="px-3 py-2.5 text-right">{formatCurrency(summary.netSales)}</td>
              <td className="px-3 py-2.5 text-right">{formatPercent(summaryRefundRate)}</td>
              <td className="px-3 py-2.5 text-right">{formatPercent(summaryPromoRate)}</td>
              <td className="px-3 py-2.5 text-right">{formatRatio(summaryROI)}</td>
              <td className="px-3 py-2.5 text-right">{formatCurrency(last.cumSales)}</td>
              <td className="px-3 py-2.5 text-right">{formatCurrency(last.cumRefund)}</td>
              <td className="px-3 py-2.5 text-right">{formatPercent(last.cumRefundRate)}</td>
              <td className="px-3 py-2.5 text-right">{formatCurrency(last.cumNetSales)}</td>
              <td className="px-3 py-2.5 text-right">{formatCurrency(last.cumPromoCost)}</td>
              <td className="px-3 py-2.5 text-right">{formatPercent(last.cumPromoRate)}</td>
              <td className="px-3 py-2.5 text-right">{formatPercent(last.cumNetPromoRate)}</td>
              <td className="px-3 py-2.5 text-right">{formatRatio(summaryNetROI)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ============= 成本明细表 =============
function CostTable({ costs, shopNameMap, showShop, onEdit, onDelete, onBatchDelete }: {
  costs: MonthlyCost[];
  shopNameMap?: Record<string, string>;
  showShop: boolean;
  onEdit: (c: MonthlyCost) => void;
  onDelete: (id: string) => void;
  onBatchDelete?: (ids: string[]) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchMode, setBatchMode] = useState(false);

  if (costs.length === 0) return <div className="card p-12 text-center text-slate-400">暂无数据</div>;

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const toggleSelectAll = () => {
    if (selected.size === costs.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(costs.map((c) => c.id)));
    }
  };

  const handleBatchDelete = () => {
    if (selected.size === 0) {
      showToast('请先选择要删除的行', 'warning');
      return;
    }
    if (!confirm(`确定删除选中的 ${selected.size} 条成本数据吗？`)) return;
    onBatchDelete?.(Array.from(selected));
    setSelected(new Set());
    setBatchMode(false);
  };

  const summary = costs.reduce(
    (acc, c) => {
      COST_FIELDS.forEach((f) => {
        acc[f.key] = (acc[f.key] || 0) + (Number(c[f.key as keyof MonthlyCost]) || 0);
      });
      acc.total += Number(c.total) || 0;
      return acc;
    },
    { total: 0 } as Record<string, number>,
  );

  return (
    <div className="space-y-2">
      {/* 批量操作工具栏 */}
      <div className="flex items-center gap-2 text-xs">
        {!batchMode ? (
          <button onClick={() => setBatchMode(true)} className="btn-ghost text-xs">☑ 批量操作</button>
        ) : (
          <>
            <button onClick={toggleSelectAll} className="btn-ghost text-xs">
              {selected.size === costs.length ? '取消全选' : '全选'}
            </button>
            <span className="text-slate-500">已选 {selected.size} 项</span>
            <button
              onClick={handleBatchDelete}
              disabled={selected.size === 0}
              className="btn-danger text-xs"
            >🗑 删除选中</button>
            <button onClick={() => { setBatchMode(false); setSelected(new Set()); }} className="btn-ghost text-xs">取消</button>
          </>
        )}
      </div>

      <div className="card">
        <div className="overflow-auto max-h-[70vh]">
          <table className="w-full text-sm freeze-header">
            <thead className="bg-primary-700 text-white">
              <tr>
                {batchMode && (
                  <th className="px-3 py-2.5 w-10">
                    <input
                      type="checkbox"
                      checked={selected.size === costs.length && costs.length > 0}
                      onChange={toggleSelectAll}
                      className="w-4 h-4"
                    />
                  </th>
                )}
              <th className="px-3 py-2.5 text-left sticky left-0 bg-primary-700">年-月</th>
              {showShop && <th className="px-3 py-2.5 text-left">店铺</th>}
              {COST_FIELDS.map((f) => (
                <th key={f.key} className="px-3 py-2.5 text-right whitespace-nowrap">{f.label}</th>
              ))}
              <th className="px-3 py-2.5 text-right bg-primary-800">合计</th>
              <th className="px-3 py-2.5 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {costs.map((c) => (
              <tr key={c.id} className={`hover:bg-slate-50 dark:hover:bg-slate-700/30 ${batchMode && selected.has(c.id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                {batchMode && (
                  <td className="px-3 py-2 w-10">
                    <input
                      type="checkbox"
                      checked={selected.has(c.id)}
                      onChange={() => toggleSelect(c.id)}
                      className="w-4 h-4"
                    />
                  </td>
                )}
                <td className="px-3 py-2 sticky left-0 bg-white dark:bg-slate-800">{c.year}-{String(c.month).padStart(2, '0')}</td>
                {showShop && <td className="px-3 py-2">{shopNameMap?.[c.shopId] || '-'}</td>}
                {COST_FIELDS.map((f) => (
                  <td key={f.key} className="px-3 py-2 text-right whitespace-nowrap">{formatCurrency(c[f.key as keyof MonthlyCost] as number)}</td>
                ))}
                <td className="px-3 py-2 text-right font-medium bg-primary-50/50 dark:bg-primary-900/10 whitespace-nowrap">
                  {formatCurrency(c.total)}
                  {c.isTotalOverridden && <span className="ml-1 text-amber-500 text-xs">✎</span>}
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  {!batchMode && (
                    <>
                      <button onClick={() => onEdit(c)} className="text-primary-600 hover:underline text-xs mr-2">编辑</button>
                      <button onClick={() => onDelete(c.id)} className="text-red-500 hover:underline text-xs">删除</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-900 text-white">
            <tr className="font-semibold">
              {batchMode && <td className="px-3 py-2.5"></td>}
              <td className="px-3 py-2.5 sticky left-0 bg-slate-900">汇总</td>
              {showShop && <td className="px-3 py-2.5">-</td>}
              {COST_FIELDS.map((f) => (
                <td key={f.key} className="px-3 py-2.5 text-right whitespace-nowrap">{formatCurrency(summary[f.key] || 0)}</td>
              ))}
              <td className="px-3 py-2.5 text-right bg-primary-950">{formatCurrency(summary.total)}</td>
              <td className="px-3 py-2.5"></td>
            </tr>
          </tfoot>
        </table>
        </div>
      </div>
    </div>
  );
}

// ============= 每日数据编辑器（简化版：5个字段） =============
function DailyMetricEditor({ metric, shopId, shop, productId, defaultDate, onClose, onSaved }: any) {
  const [date, setDate] = useState(metric.date || defaultDate);
  const [salesAmount, setSalesAmount] = useState(metric.salesAmount?.toString() || '');
  const [orderCount, setOrderCount] = useState(metric.orderCount?.toString() || '');
  const [refundAmount, setRefundAmount] = useState(metric.refundAmount?.toString() || '');
  const [promotionCost, setPromotionCost] = useState(metric.promotionCost?.toString() || '');
  const [visitorCount, setVisitorCount] = useState(metric.visitorCount?.toString() || '');
  // 货品成本相关
  const [costOverride, setCostOverride] = useState<boolean>(Boolean(metric.costOverride));
  const [manualCost, setManualCost] = useState<string>(metric.manualCost?.toString() || '');
  const [saving, setSaving] = useState(false);

  // 店铺默认成本率
  const defaultCostRate = shop?.defaultCostRate || 0;

  // 实时计算
  const sales = parseFloat(salesAmount) || 0;
  const refund = parseFloat(refundAmount) || 0;
  const promo = parseFloat(promotionCost) || 0;
  const netSales = sales - refund;
  const refundRate = sales > 0 ? (refund / sales) * 100 : 0;
  const promoRate = sales > 0 ? (promo / sales) * 100 : 0;
  const roi = promo > 0 ? sales / promo : 0;

  // 货品成本：如果手动覆盖用 manualCost，否则按销售额×默认百分比
  // 货品成本按净销售额计算（销售额 - 退款）
  const autoCost = netSales * (defaultCostRate / 100);
  const productCost = costOverride ? (parseFloat(manualCost) || 0) : autoCost;
  const costSource: 'auto' | 'manual' = costOverride ? 'manual' : 'auto';

  const handleSave = async () => {
    if (!date) {
      showToast('请选择日期', 'warning');
      return;
    }
    setSaving(true);
    try {
      // 写入每日数据
      // 编辑已有记录时用 updateById（避免 upsert onConflict 对 NULL product_id 不生效）
      // 新增记录时用 upsert
      if (metric.id) {
        // 编辑：按 id 更新
        await updateDailyMetricById(metric.id, {
          salesAmount: parseFloat(salesAmount) || 0,
          orderCount: parseInt(orderCount) || 0,
          refundAmount: parseFloat(refundAmount) || 0,
          promotionCost: parseFloat(promotionCost) || 0,
          visitorCount: parseInt(visitorCount) || 0,
          dataSource: 'manual',
        });
      } else {
        // 新增：用 upsert
        await upsertDailyMetric({
          shopId,
          productId: productId || null,
          date,
          salesAmount: parseFloat(salesAmount) || 0,
          orderCount: parseInt(orderCount) || 0,
          refundAmount: parseFloat(refundAmount) || 0,
          promotionCost: parseFloat(promotionCost) || 0,
          visitorCount: parseInt(visitorCount) || 0,
          dataSource: 'manual',
        });
      }

      // 如果用户手动覆盖了货品成本，写入 monthly_cost 表
      if (costOverride && manualCost) {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = d.getMonth() + 1;
        const existingCosts = await fetchMonthlyCosts(shopId, productId || null, year, month, year, month);
        const existing = existingCosts[0];
        await upsertMonthlyCost({
          shopId,
          productId: productId || null,
          year,
          month,
          productCost: parseFloat(manualCost) || 0,
          redPacket: existing?.redPacket || 0,
          labor: existing?.labor || 0,
          otherCost: existing?.otherCost || 0,
          tax: existing?.tax || 0,
          consumerExperienceFee: existing?.consumerExperienceFee || 0,
          bnplFee: existing?.bnplFee || 0,
          basicSoftwareFee: existing?.basicSoftwareFee || 0,
          limitedRedPacket: existing?.limitedRedPacket || 0,
          logisticsFee: existing?.logisticsFee || 0,
          brandGiftFee: existing?.brandGiftFee || 0,
          charityBaby: existing?.charityBaby || 0,
          quickPaymentFee: existing?.quickPaymentFee || 0,
          marketingPlatform: existing?.marketingPlatform || 0,
          isTotalOverridden: existing?.isTotalOverridden || false,
          costSource: 'manual',
        });
      }

      showToast('已保存', 'success');
      onSaved();
    } catch (e: any) {
      showToast(e.message || '保存失败', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={true}
      onClose={onClose}
      title="每日数据录入"
      size="md"
      footer={<><button onClick={onClose} className="btn-secondary">取消</button><button onClick={handleSave} disabled={saving} className="btn-primary">{saving ? '保存中...' : '保存'}</button></>}
    >
      <div className="space-y-3">
        <div><label className="label">日期 *</label><input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">销售额 (¥) *</label><input type="number" step="0.01" className="input" value={salesAmount} onChange={(e) => setSalesAmount(e.target.value)} /></div>
          <div><label className="label">订单量</label><input type="number" className="input" value={orderCount} onChange={(e) => setOrderCount(e.target.value)} /></div>
          <div><label className="label">退款金额 (¥)</label><input type="number" step="0.01" className="input" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} /></div>
          <div><label className="label">推广费用 (¥)</label><input type="number" step="0.01" className="input" value={promotionCost} onChange={(e) => setPromotionCost(e.target.value)} /></div>
          <div><label className="label">访客数</label><input type="number" className="input" value={visitorCount} onChange={(e) => setVisitorCount(e.target.value)} /></div>
        </div>

        {/* 货品成本 */}
        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-amber-700 dark:text-amber-400">📦 货品成本</div>
              <div className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">
                {defaultCostRate > 0
                  ? `默认按 销售额 × ${defaultCostRate.toFixed(2)}% 自动计算`
                  : '请先在店铺设置中配置默认货品成本百分比'}
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={costOverride}
                onChange={(e) => setCostOverride(e.target.checked)}
              />
              <span className="text-amber-700 dark:text-amber-400 font-medium">手动覆盖</span>
            </label>
          </div>
          {costOverride ? (
            <div>
              <label className="label text-amber-700 dark:text-amber-400">货品成本 (¥) *</label>
              <input
                type="number"
                step="0.01"
                className="input"
                value={manualCost}
                onChange={(e) => setManualCost(e.target.value)}
                placeholder="手动输入货品成本"
              />
              <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
                ⚠️ 手动覆盖后，当月货品成本将被设置为该值（不再按日累加）
              </p>
            </div>
          ) : (
            <div className="text-sm">
              <span className="text-amber-700 dark:text-amber-400">当前货品成本（自动）：</span>
              <span className="font-bold text-amber-800 dark:text-amber-300">{formatCurrency(productCost)}</span>
              <span className="text-xs text-amber-600 dark:text-amber-500 ml-2">
                （{defaultCostRate.toFixed(2)}% × 净销售额 {formatCurrency(netSales)}）
              </span>
            </div>
          )}
        </div>

        {/* 实时计算预览 */}
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div className="text-xs font-medium text-blue-700 dark:text-blue-400 mb-2">自动计算预览</div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>净销售额：<span className="font-medium">{formatCurrency(netSales)}</span></div>
            <div>退款率：<span className={`font-medium ${refundRate > 10 ? 'text-red-500' : ''}`}>{formatPercent(refundRate)}</span></div>
            <div>推广占比：<span className="font-medium">{formatPercent(promoRate)}</span></div>
            <div>投产比：<span className="font-medium">{formatRatio(roi)}</span></div>
            <div>货品成本：<span className="font-medium text-amber-700">{formatCurrency(productCost)}</span></div>
            <div>毛利：<span className={`font-medium ${(netSales - productCost) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{formatCurrency(netSales - productCost)}</span></div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ============= 成本编辑器 =============
function CostEditor({ cost, shopId, productId, defaultYear, defaultMonth, onClose, onSaved }: any) {
  const [year, setYear] = useState(cost.year || defaultYear);
  const [month, setMonth] = useState(cost.month || defaultMonth);
  const [values, setValues] = useState<Record<string, string>>({});
  const [isTotalOverridden, setIsTotalOverridden] = useState(Boolean(cost.isTotalOverridden));
  const [total, setTotal] = useState(cost.total?.toString() || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const v: Record<string, string> = {};
    if (cost.id) {
      COST_FIELDS.forEach((f) => {
        v[f.key] = (cost[f.key] ?? 0).toString();
      });
    } else {
      // 新增模式：重置为空
      COST_FIELDS.forEach((f) => {
        v[f.key] = '';
      });
    }
    setValues(v);
  }, [cost.id]);

  const computedTotal = useMemo(() => {
    if (isTotalOverridden) return parseFloat(total) || 0;
    return COST_FIELDS.reduce((s, f) => s + (parseFloat(values[f.key]) || 0), 0);
  }, [values, isTotalOverridden, total]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: any = { shopId, productId: productId || null, year: parseInt(year) || defaultYear, month: parseInt(month) || defaultMonth, isTotalOverridden };
      COST_FIELDS.forEach((f) => {
        payload[f.key] = parseFloat(values[f.key]) || 0;
      });
      if (isTotalOverridden) payload.total = parseFloat(total) || 0;
      // 编辑已有记录时用 updateById，新增时用 upsert
      if (cost.id) {
        await updateMonthlyCostById(cost.id, payload);
      } else {
        await upsertMonthlyCost(payload);
      }
      showToast('已保存', 'success');
      onSaved();
    } catch (e: any) {
      showToast(e.message || '保存失败', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={true}
      onClose={onClose}
      title="月度成本"
      size="lg"
      footer={<><button onClick={onClose} className="btn-secondary">取消</button><button onClick={handleSave} disabled={saving} className="btn-primary">{saving ? '保存中...' : '保存'}</button></>}
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">年份 *</label><input type="number" className="input" value={year} onChange={(e) => setYear(e.target.value)} /></div>
          <div>
            <label className="label">月份 *</label>
            <select className="input" value={month} onChange={(e) => setMonth(parseInt(e.target.value))}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>{m} 月</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {COST_FIELDS.map((f) => (
            <div key={f.key}>
              <label className="label">{f.label} (¥)</label>
              <input
                type="number"
                step="0.01"
                className="input"
                value={values[f.key] || ''}
                onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                disabled={isTotalOverridden}
              />
            </div>
          ))}
        </div>
        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isTotalOverridden} onChange={(e) => setIsTotalOverridden(e.target.checked)} />
            <span className="font-medium text-amber-700 dark:text-amber-400">手动填写合计（不自动汇总）</span>
          </label>
          {isTotalOverridden ? (
            <div>
              <label className="label">合计 (¥)</label>
              <input type="number" step="0.01" className="input" value={total} onChange={(e) => setTotal(e.target.value)} />
            </div>
          ) : (
            <div className="text-sm text-amber-700 dark:text-amber-400">
              自动汇总合计：<span className="font-bold">{formatCurrency(computedTotal)}</span>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ============= 导入弹窗（简化版，支持5字段格式） =============
function ImportModal({ shops, defaultShopId, products, onClose, onImported }: any) {
  const [tab, setTab] = useState<'syp' | 'standard' | 'paste'>('syp');
  const [importType, setImportType] = useState<'metrics' | 'costs'>('metrics');
  const [shopId, setShopId] = useState<string>(defaultShopId || '');
  const [productId, setProductId] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [pasteText, setPasteText] = useState('');
  // 预览状态
  const [parseResult, setParseResult] = useState<any>(null);
  const [step, setStep] = useState<'upload' | 'preview'>('upload');

  const handleDownloadTemplate = () => {
    if (tab === 'syp') {
      exportToExcelTemplate('syp');
    } else {
      exportToExcelTemplate(importType === 'metrics' ? 'metrics' : 'costs');
    }
  };

  // 第一步：解析文件，进入预览
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!shopId) {
      showToast('请先选择导入到哪个店铺', 'warning');
      e.target.value = '';
      return;
    }
    setLoading(true);
    try {
      const result = await parseExcelFile(file, tab === 'syp' ? 'auto' : importType);
      if (result.validRows === 0) {
        showToast('文件中没有有效数据，请检查格式', 'warning');
      } else {
        setParseResult(result);
        setStep('preview');
      }
    } catch (e: any) {
      showToast(e.message || '解析失败', 'error');
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  // 第二步：确认导入（带进度条）
  const handleConfirmImport = async () => {
    if (!parseResult || !shopId) return;
    setLoading(true);
    setProgress({ current: 0, total: parseResult.validRows });
    try {
      const result = await executeImportWithProgress(parseResult, shopId, productId || null, (current, total) => {
        setProgress({ current, total });
      });
      showToast(`成功导入 ${result.count} 条数据${result.detail ? '（' + result.detail + '）' : ''}`, 'success');
      onImported();
    } catch (e: any) {
      showToast(e.message || '导入失败', 'error');
    } finally {
      setLoading(false);
      setProgress(null);
    }
  };

  // 粘贴导入：先预览
  const handlePastePreview = async () => {
    if (!pasteText.trim()) {
      showToast('请先粘贴数据', 'warning');
      return;
    }
    setLoading(true);
    try {
      // 把粘贴的文本转成 File 对象，复用 parseExcelFile
      // 粘贴数据用 TSV 格式解析
      const lines = pasteText.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 2) throw new Error('数据至少需要表头+1行');
      const parseLine = (line: string): string[] => {
        if (line.includes('\t')) return line.split('\t');
        if (line.includes(',')) return line.split(',');
        return line.split(/\s{2,}|\s+/);
      };
      const headers = parseLine(lines[0]).map((h) => h.trim());
      const rows: any[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cells = parseLine(lines[i]);
        const row: any = {};
        headers.forEach((h, idx) => { row[h] = cells[idx] || ''; });
        rows.push(row);
      }
      // 自动识别
      let actualType: any = 'metrics';
      if (headers.some((h) => SYP_FIELD_MAP_HEADERS[h])) actualType = 'syp';
      else if (headers.includes('月份') || headers.includes('业务大类') || headers.includes('扣费金额合计')) actualType = 'costs';
      else if (headers.some((h) => PROMOTION_FIELDS.some((f) => f.label === h))) actualType = 'promotions';

      // 计算 validRows 和 invalidReasons
      let validRows = 0;
      const invalidReasons: Record<string, number> = {};
      for (const row of rows) {
        if (actualType === 'costs') {
          const monthStr = String(row['月份'] || '').trim();
          // 简单月份校验
          let monthOk = false;
          if (/^\d{6}$/.test(monthStr)) {
            const m = parseInt(monthStr.slice(4, 6));
            monthOk = m >= 1 && m <= 12;
          } else if (/^\d{4}[-/.]\d{1,2}$/.test(monthStr)) {
            const m = parseInt(monthStr.split(/[-/.]/)[1]);
            monthOk = m >= 1 && m <= 12;
          } else if (/^\d{4}年\d{1,2}月?$/.test(monthStr)) {
            const m = parseInt(monthStr.replace(/[年月]/g, '').split(/[-]/)[0].slice(4));
            monthOk = m >= 1 && m <= 12;
          }
          const category = String(row['业务大类'] || '').trim();
          const amount = parseFloat(row['扣费金额合计 (元)'] ?? row['扣费金额合计'] ?? row['扣费金额'] ?? row['金额'] ?? '0') || 0;
          if (!monthOk) invalidReasons['月份无法解析'] = (invalidReasons['月份无法解析'] || 0) + 1;
          else if (!category) invalidReasons['业务大类为空'] = (invalidReasons['业务大类为空'] || 0) + 1;
          else if (amount === 0) invalidReasons['金额为0或空'] = (invalidReasons['金额为0或空'] || 0) + 1;
          else validRows++;
        } else {
          // 其他类型简化判断
          validRows++;
        }
      }

      const parseResult = {
        type: actualType,
        rows,
        totalRows: rows.length,
        validRows,
        preview: rows, // 预览所有数据
        columns: headers,
        invalidReasons,
      };
      setParseResult(parseResult);
      setStep('preview');
    } catch (e: any) {
      showToast(e.message || '解析失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  // 直接执行粘贴导入（保留原接口）
  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setPasteText(text);
        showToast('已从剪贴板读取数据', 'success');
      } else {
        showToast('剪贴板为空', 'warning');
      }
    } catch {
      showToast('无法读取剪贴板，请手动 Ctrl+V 粘贴', 'info');
    }
  };

  const resetToUpload = () => {
    setStep('upload');
    setParseResult(null);
    setPasteText('');
  };

  // ============ 预览步骤 ============
  if (step === 'preview' && parseResult) {
    const typeLabel: Record<string, string> = {
      syp: '生意参谋',
      metrics: '每日数据',
      promotions: '每日推广',
      costs: '月度成本',
    };
    return (
      <Modal open={true} onClose={onClose} title="数据预览" size="lg"
        footer={
          <>
            {progress && (
              <div className="flex-1 mr-auto flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary-500 transition-all"
                    style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
                  />
                </div>
                <span>{progress.current} / {progress.total}</span>
              </div>
            )}
            <button onClick={resetToUpload} className="btn-secondary" disabled={loading}>← 重新上传</button>
            <button onClick={handleConfirmImport} disabled={loading || parseResult.validRows === 0} className="btn-primary">
              {loading ? `导入中... ${progress ? progress.current + '/' + progress.total : ''}` : `✓ 确认导入 ${parseResult.validRows} 条数据`}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          {/* 预览统计 */}
          <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
            <div className="flex items-center justify-between text-sm">
              <div>
                <span className="text-emerald-700 dark:text-emerald-400 font-medium">📊 数据类型：</span>
                <span className="font-semibold">{typeLabel[parseResult.type] || parseResult.type}</span>
              </div>
              <div className="text-emerald-700 dark:text-emerald-400">
                总行数 {parseResult.totalRows} · 有效 {parseResult.validRows} 条
                {parseResult.totalRows - parseResult.validRows > 0 && (
                  <span className="text-amber-600 ml-2">
                    （{parseResult.totalRows - parseResult.validRows} 条无效将跳过）
                  </span>
                )}
              </div>
            </div>
            {parseResult.totalRows - parseResult.validRows > 0 && (
              <div className="mt-2 pt-2 border-t border-emerald-200 dark:border-emerald-800 text-xs text-amber-700 dark:text-amber-400 space-y-1">
                <div>⚠️ 无效行原因统计：</div>
                {parseResult.invalidReasons && Object.keys(parseResult.invalidReasons).length > 0 ? (
                  Object.entries(parseResult.invalidReasons).map(([reason, count]: [string, any]) => (
                    <div key={reason} className="pl-3">• {reason}：{String(count)} 条</div>
                  ))
                ) : (
                  <div className="pl-3">• 数据格式问题</div>
                )}
                {parseResult.type === 'costs' && (
                  <>
                    <div>📅 月份支持多种格式混合：202611 / 2026-11 / 2026/11 / 2026年11月 / 2026.11</div>
                    <div>💡 业务大类未匹配14项标准分类时，会自动归入「其它」</div>
                  </>
                )}
                {parseResult.type === 'metrics' && (
                  <div>📅 日期支持：2026-07-01 / 2026/7/1 / 2026年7月1日 / 2026.7.1</div>
                )}
              </div>
            )}
          </div>

          {/* 产品选择（导入时确认） */}
          <div>
            <label className="label">导入到产品（可选，留空为店铺级）</label>
            <select className="input" value={productId} onChange={(e) => setProductId(e.target.value)}>
              <option value="">全部产品（店铺整体）</option>
              {products.map((p: Product) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* 数据预览表格 */}
          <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
            <div className="bg-slate-50 dark:bg-slate-700 px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300">
              全部 {parseResult.preview.length} 行数据
            </div>
            <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-100 dark:bg-slate-700 sticky top-0">
                  <tr>
                    {parseResult.columns.map((col: string) => (
                      <th key={col} className="px-2 py-1.5 text-left font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {parseResult.preview.map((row: any, i: number) => (
                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                      {parseResult.columns.map((col: string) => (
                        <td key={col} className="px-2 py-1 whitespace-nowrap text-slate-700 dark:text-slate-200">{String(row[col] ?? '')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-xs text-blue-700 dark:text-blue-400">
            💡 请检查预览数据是否正确，确认无误后点击「✓ 确认导入」按钮才会真正写入数据库
          </div>
        </div>
      </Modal>
    );
  }

  // ============ 上传步骤 ============
  return (
    <Modal open={true} onClose={onClose} title="批量导入" size="lg">
      <div className="space-y-4">
        <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-700 rounded-lg">
          <button onClick={() => setTab('syp')} className={`flex-1 py-2 rounded-md text-sm font-medium transition ${tab === 'syp' ? 'bg-white dark:bg-slate-800 shadow text-primary-600' : 'text-slate-500'}`}>🏪 生意参谋格式</button>
          <button onClick={() => setTab('standard')} className={`flex-1 py-2 rounded-md text-sm font-medium transition ${tab === 'standard' ? 'bg-white dark:bg-slate-800 shadow text-primary-600' : 'text-slate-500'}`}>📋 标准模板</button>
          <button onClick={() => setTab('paste')} className={`flex-1 py-2 rounded-md text-sm font-medium transition ${tab === 'paste' ? 'bg-white dark:bg-slate-800 shadow text-primary-600' : 'text-slate-500'}`}>📋 粘贴导入</button>
        </div>

        {/* 店铺选择（必填） */}
        <div>
          <label className="label">导入到哪个店铺 *</label>
          <select
            className="input"
            value={shopId}
            onChange={(e) => setShopId(e.target.value)}
          >
            <option value="">请选择店铺</option>
            {shops.map((s: Shop) => (
              <option key={s.id} value={s.id}>{s.name} ({PLATFORM_LABELS[s.platform]})</option>
            ))}
          </select>
          {!shopId && (
            <p className="text-xs text-amber-600 mt-1">⚠️ 请先选择店铺，再上传文件</p>
          )}
        </div>

        {tab === 'syp' && (
          <div className="space-y-3">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg text-xs text-emerald-700 dark:text-emerald-400 space-y-1">
              <div className="font-medium">🏪 生意参谋导入说明：</div>
              <div>1. 登录生意参谋 → 交易分析/流量分析/营销推广</div>
              <div>2. 选择日期范围，点击「下载数据」导出 Excel</div>
              <div>3. 直接上传该 Excel，软件自动识别字段</div>
              <div className="mt-2 pt-2 border-t border-emerald-200 dark:border-emerald-800">
                <div className="font-medium">支持的字段（自动映射）：</div>
                <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 mt-1">
                  <div>• 统计日期 → 日期</div>
                  <div>• 支付金额 → 销售额</div>
                  <div>• 支付买家数 → 订单量</div>
                  <div>• 成功退款金额 → 退款金额</div>
                  <div>• 访客数 → 访客数</div>
                  <div>• 全站推广花费</div>
                  <div>• 关键词推广花费</div>
                  <div>• 精准人群推广花费</div>
                  <div>• 智能场景花费</div>
                  <div>• 淘宝客佣金</div>
                </div>
                <div className="mt-1">推广各项会自动汇总为「推广费用」总额，存入主表</div>
              </div>
            </div>
            <button onClick={handleDownloadTemplate} className="btn-secondary w-full">📥 下载生意参谋格式模板</button>
            <label className="btn-primary w-full cursor-pointer block text-center">
              {loading ? '解析中...' : '📁 上传生意参谋 Excel（先预览）'}
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileChange} disabled={loading} />
            </label>
          </div>
        )}

        {tab === 'standard' && (
          <div className="space-y-3">
            <div>
              <label className="label">导入类型</label>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setImportType('metrics')} className={`p-2 rounded-lg border text-sm ${importType === 'metrics' ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-slate-200'}`}>每日数据</button>
                <button onClick={() => setImportType('costs')} className={`p-2 rounded-lg border text-sm ${importType === 'costs' ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-slate-200'}`}>月度成本</button>
              </div>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-xs text-blue-700 dark:text-blue-400 space-y-1">
              {importType === 'metrics' ? (
                <>
                  <div className="font-medium">每日数据模板字段：</div>
                  <div>日期、销售额、订单量、退款金额、推广费用、访客数</div>
                </>
              ) : (
                <>
                  <div className="font-medium">月度成本模板字段（新格式）：</div>
                  <div>月份、业务大类、扣费金额合计 (元)</div>
                  <div className="mt-1 text-xs">业务大类支持的值：货品成本、红包、人工、其它、税务、消费者体验提升计划服务费、先用后付技术服务费、基础软件服务费、限时红包代商家垫付扣回、商家集运物流服务费、品牌新享淘宝礼金软件服务费、公益宝贝、淘宝极速回款手动回款服务费、营销平台</div>
                </>
              )}
            </div>
            <button onClick={handleDownloadTemplate} className="btn-secondary w-full">📥 下载模板</button>
            <label className="btn-primary w-full cursor-pointer block text-center">
              {loading ? '解析中...' : '📁 选择文件上传（先预览）'}
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileChange} disabled={loading} />
            </label>
          </div>
        )}

        {tab === 'paste' && (
          <div className="space-y-3">
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-xs text-amber-700 dark:text-amber-400 space-y-1">
              <div className="font-medium">📋 粘贴导入说明：</div>
              <div>1. 在生意参谋或其他 Excel 中选中表格区域</div>
              <div>2. Ctrl+C 复制选中区域（含表头）</div>
              <div>3. 点击下方「从剪贴板读取」按钮，或直接 Ctrl+V 粘贴到文本框</div>
              <div>4. 点击「预览数据」查看解析结果</div>
              <div>5. 确认无误后点击「✓ 确认导入」</div>
            </div>
            <button onClick={handlePasteFromClipboard} className="btn-secondary w-full">📋 从剪贴板读取</button>
            <div>
              <label className="label">粘贴的数据（含表头第一行）</label>
              <textarea
                className="input font-mono text-xs"
                rows={8}
                placeholder={"月份\t业务大类\t扣费金额合计 (元)\n2026-01\t货品成本\t5000\n2026-01\t红包\t200"}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
              />
            </div>
            <button onClick={handlePastePreview} disabled={loading} className="btn-primary w-full">
              {loading ? '解析中...' : '👁 预览数据'}
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}

// SYP_FIELD_MAP_HEADERS 用于粘贴识别（从 excel.ts 引用）
const SYP_FIELD_MAP_HEADERS: Record<string, any> = {
  '统计日期': true, '日期': true, '访客数': true, '支付金额': true,
  '支付买家数': true, '成功退款金额': true, '退款金额': true,
};
