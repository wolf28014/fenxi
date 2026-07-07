import { useEffect, useState, useMemo } from 'react';
import type { Shop, Product, DailyMetric, MonthlyCost, DailyPromotion } from '@/types';
import { COST_FIELDS } from '@/types';
import { fetchProducts, createProduct, updateProduct, deleteProduct, fetchDailyMetrics, fetchDailyPromotions, fetchMonthlyCosts } from '@/lib/db';
import { showToast } from '@/components/Toast';
import Modal from '@/components/Modal';
import { formatCurrency, formatPercent, getLastYearSameRange, getQuickRange } from '@/lib/calc';

interface Props {
  currentShop: Shop | null;
  shops: Shop[];
  setShops: (shops: Shop[]) => void;
}

interface ProductStats {
  totalSales: number;
  totalRefund: number;
  netSales: number;
  refundRate: number;
  totalCost: number;
  totalPromo: number;
  profit: number;
  profitRate: number;
  orderCount: number;
  visitorCount: number;
}

export default function ProductView({ currentShop, shops }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);
  const [stats, setStats] = useState<Record<string, ProductStats>>({});
  const [rankType, setRankType] = useState<'sales' | 'refund' | 'profit' | 'loss'>('sales');

  const range = useMemo(() => getQuickRange('thisNaturalYear'), []);

  const load = async () => {
    // 决定加载哪些店铺的产品
    const targetShops = currentShop ? [currentShop] : shops;
    if (targetShops.length === 0) {
      setProducts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const allProducts = (await Promise.all(targetShops.map((s) => fetchProducts(s.id)))).flat();
      setProducts(allProducts);

      // 计算每个产品的统计
      const newStats: Record<string, ProductStats> = {};
      await Promise.all(
        allProducts.map(async (p) => {
          const shopId = p.shopId;
          const [metrics, promotions, costs] = await Promise.all([
            fetchDailyMetrics(shopId, p.id, range.start, range.end),
            fetchDailyPromotions(shopId, p.id, range.start, range.end),
            fetchMonthlyCosts(shopId, p.id, new Date(range.start).getFullYear(), 1, new Date(range.end).getFullYear(), 12),
          ]);
          const totalSales = metrics.reduce((s, m) => s + m.salesAmount, 0);
          const totalRefund = metrics.reduce((s, m) => s + m.refundAmount, 0);
          const netSales = totalSales - totalRefund;
          const totalPromo = metrics.reduce((s, m) => s + m.promotionCost, 0) || promotions.reduce((s, p) => s + p.total, 0);
          // 货品成本 = 净销售额 × 店铺默认成本率
          const shop = shops.find(s => s.id === shopId);
          const costRate = shop?.defaultCostRate || 0;
          const autoProductCost = costRate > 0 ? netSales * (costRate / 100) : 0;
          const otherCosts = costs.reduce((s, c) => {
            return s + COST_FIELDS.filter(f => f.key !== 'productCost').reduce((cs, f) => cs + (Number(c[f.key as keyof typeof c]) || 0), 0);
          }, 0);
          const totalCost = autoProductCost + otherCosts;
          const profit = netSales - totalCost - totalPromo;
          newStats[p.id] = {
            totalSales,
            totalRefund,
            netSales,
            refundRate: totalSales > 0 ? (totalRefund / totalSales) * 100 : 0,
            totalCost,
            totalPromo,
            profit,
            profitRate: netSales > 0 ? (profit / netSales) * 100 : 0,
            orderCount: metrics.reduce((s, m) => s + m.orderCount, 0),
            visitorCount: metrics.reduce((s, m) => s + m.visitorCount, 0),
          };
        }),
      );
      setStats(newStats);
    } catch (e: any) {
      showToast(e.message || '加载失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const handler = () => load();
    window.addEventListener('realtime:products', handler);
    window.addEventListener('realtime:metrics', handler);
    window.addEventListener('realtime:costs', handler);
    return () => {
      window.removeEventListener('realtime:products', handler);
      window.removeEventListener('realtime:metrics', handler);
      window.removeEventListener('realtime:costs', handler);
    };
  }, [currentShop, range.start, range.end]);

  const handleDelete = async (p: Product) => {
    if (!confirm(`确定删除产品"${p.name}"吗？`)) return;
    try {
      await deleteProduct(p.id);
      showToast('已删除', 'success');
      load();
    } catch (e: any) {
      showToast(e.message || '删除失败', 'error');
    }
  };

  const ranked = useMemo(() => {
    const arr = products.filter((p) => stats[p.id]);
    if (rankType === 'sales') return arr.sort((a, b) => stats[b.id].totalSales - stats[a.id].totalSales);
    if (rankType === 'refund') return arr.sort((a, b) => stats[b.id].refundRate - stats[a.id].refundRate);
    if (rankType === 'profit') return arr.sort((a, b) => stats[b.id].profitRate - stats[a.id].profitRate);
    if (rankType === 'loss') return arr.sort((a, b) => stats[a.id].profit - stats[b.id].profit);
    return arr;
  }, [products, stats, rankType]);

  if (shops.length === 0) {
    return (
      <div className="card p-12 text-center">
        <div className="text-5xl mb-4">🏪</div>
        <p className="text-slate-500">请先在「店铺管理」中添加店铺</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">产品中心</h2>
          <p className="text-sm text-slate-500 mt-1">
            {currentShop?.name || '所有店铺'} · 共 {products.length} 个产品
          </p>
        </div>
        <button onClick={() => setCreating(true)} className="btn-primary">+ 添加产品</button>
      </div>

      {/* 排行榜 */}
      {ranked.length > 0 && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-slate-900 dark:text-white">📊 产品排行（本自然年）</h3>
            <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-700 rounded-lg text-xs">
              <button
                onClick={() => setRankType('sales')}
                className={`px-2 py-1 rounded ${rankType === 'sales' ? 'bg-white shadow text-primary-600' : 'text-slate-500'}`}
              >🔥 热销</button>
              <button
                onClick={() => setRankType('refund')}
                className={`px-2 py-1 rounded ${rankType === 'refund' ? 'bg-white shadow text-primary-600' : 'text-slate-500'}`}
              >⚠️ 高退款</button>
              <button
                onClick={() => setRankType('profit')}
                className={`px-2 py-1 rounded ${rankType === 'profit' ? 'bg-white shadow text-primary-600' : 'text-slate-500'}`}
              >💎 高利润</button>
              <button
                onClick={() => setRankType('loss')}
                className={`px-2 py-1 rounded ${rankType === 'loss' ? 'bg-white shadow text-primary-600' : 'text-slate-500'}`}
              >📉 亏损</button>
            </div>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {ranked.slice(0, 10).map((p, i) => {
              const s = stats[p.id];
              return (
                <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50">
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-slate-200 text-slate-700' : i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-500'
                  }`}>{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{p.name}</div>
                    {p.sku && <div className="text-xs text-slate-400">SKU: {p.sku}</div>}
                  </div>
                  <div className="text-right text-xs">
                    {rankType === 'sales' && <div className="font-medium text-emerald-600">{formatCurrency(s.totalSales)}</div>}
                    {rankType === 'refund' && <div className="font-medium text-red-500">{formatPercent(s.refundRate)}</div>}
                    {rankType === 'profit' && <div className="font-medium text-emerald-600">{formatPercent(s.profitRate)}</div>}
                    {rankType === 'loss' && <div className={`font-medium ${s.profit >= 0 ? 'text-slate-500' : 'text-red-500'}`}>{formatCurrency(s.profit)}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 产品列表 */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">加载中...</div>
      ) : products.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-5xl mb-4">📦</div>
          <h3 className="text-lg font-medium text-slate-700 dark:text-slate-200 mb-2">还没有产品</h3>
          <p className="text-sm text-slate-500 mb-4">添加你的第一个产品开始追踪数据</p>
          <button onClick={() => setCreating(true)} className="btn-primary">+ 立即添加</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((p) => {
            const s = stats[p.id];
            return (
              <div key={p.id} className="card p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-900 dark:text-white truncate">{p.name}</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {p.sku && <span>SKU: {p.sku}</span>}
                      {p.category && <span> · {p.category}</span>}
                    </div>
                  </div>
                  <span className={`chip ${p.status === 'active' ? 'bg-emerald-100 text-emerald-700' : p.status === 'discontinued' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'}`}>
                    {p.status === 'active' ? '在售' : p.status === 'discontinued' ? '停售' : '下架'}
                  </span>
                </div>

                {s ? (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 bg-slate-50 dark:bg-slate-700/50 rounded">
                      <div className="text-slate-400">销售额</div>
                      <div className="font-medium text-slate-700 dark:text-slate-200">{formatCurrency(s.totalSales)}</div>
                    </div>
                    <div className="p-2 bg-slate-50 dark:bg-slate-700/50 rounded">
                      <div className="text-slate-400">退款率</div>
                      <div className={`font-medium ${s.refundRate > 5 ? 'text-red-500' : 'text-slate-700 dark:text-slate-200'}`}>{formatPercent(s.refundRate)}</div>
                    </div>
                    <div className="p-2 bg-slate-50 dark:bg-slate-700/50 rounded">
                      <div className="text-slate-400">利润</div>
                      <div className={`font-medium ${s.profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{formatCurrency(s.profit)}</div>
                    </div>
                    <div className="p-2 bg-slate-50 dark:bg-slate-700/50 rounded">
                      <div className="text-slate-400">利润率</div>
                      <div className={`font-medium ${s.profitRate >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{formatPercent(s.profitRate)}</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 text-center py-3">暂无数据</div>
                )}

                <div className="flex gap-2 mt-3">
                  <button onClick={() => setEditing(p)} className="btn-secondary flex-1 text-xs">编辑</button>
                  <button onClick={() => handleDelete(p)} className="btn-danger text-xs">删除</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {(creating || editing) && currentShop && (
        <ProductEditor
          product={editing}
          shopId={currentShop.id}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function ProductEditor({ product, shopId, onClose, onSaved }: { product: Product | null; shopId: string; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(product?.name || '');
  const [sku, setSku] = useState(product?.sku || '');
  const [category, setCategory] = useState(product?.category || '');
  const [status, setStatus] = useState<'active' | 'inactive' | 'discontinued'>(product?.status || 'active');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name) {
      showToast('请输入产品名称', 'warning');
      return;
    }
    setSaving(true);
    try {
      if (product) {
        await updateProduct(product.id, { name, sku, category, status });
        showToast('已更新', 'success');
      } else {
        await createProduct({ name, sku, category, status, sortOrder: 0, shopId });
        showToast('已添加', 'success');
      }
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
      title={product ? '编辑产品' : '添加产品'}
      footer={
        <>
          <button onClick={onClose} className="btn-secondary">取消</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary">{saving ? '保存中...' : '保存'}</button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="label">产品名称 *</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="如：商品A" />
        </div>
        <div>
          <label className="label">SKU</label>
          <input className="input" value={sku} onChange={(e) => setSku(e.target.value)} placeholder="可选" />
        </div>
        <div>
          <label className="label">分类</label>
          <input className="input" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="可选" />
        </div>
        <div>
          <label className="label">状态</label>
          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => setStatus('active')} className={`p-2 rounded-lg border text-sm ${status === 'active' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200'}`}>在售</button>
            <button onClick={() => setStatus('inactive')} className={`p-2 rounded-lg border text-sm ${status === 'inactive' ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-slate-200'}`}>下架</button>
            <button onClick={() => setStatus('discontinued')} className={`p-2 rounded-lg border text-sm ${status === 'discontinued' ? 'border-red-500 bg-red-50 text-red-700' : 'border-slate-200'}`}>停售</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
