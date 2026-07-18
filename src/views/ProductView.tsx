import { useEffect, useMemo, useState } from 'react';
import type { Shop, Product, DailyMetric, MonthlyCost, DailyPromotion } from '@/types';
import { COST_FIELDS } from '@/types';
import { fetchProducts, createProduct, updateProduct, deleteProduct, fetchDailyMetrics, fetchDailyPromotions, fetchMonthlyCosts } from '@/lib/db';
import { showToast } from '@/components/Toast';
import Modal from '@/components/Modal';
import { formatCurrency, formatPercent, getQuickRange } from '@/lib/calc';

interface Props { currentShop: Shop | null; shops: Shop[]; setShops: (shops: Shop[]) => void; }
interface ProductStats {
  totalSales: number; totalRefund: number; netSales: number; refundRate: number;
  totalCost: number; totalPromo: number; profit: number; profitRate: number; orderCount: number;
  visitorCount: number; conversionRate: number; averageOrderValue: number; roas: number; incomplete: boolean;
}
type RangeKey = 'last30Days' | 'thisMonth' | 'lastMonth' | 'thisNaturalYear';

const rangeOptions: { key: RangeKey; label: string }[] = [
  { key: 'last30Days', label: '近30天' }, { key: 'thisMonth', label: '本月' },
  { key: 'lastMonth', label: '上月' }, { key: 'thisNaturalYear', label: '本年' },
];

function tagFor(p: Product, s: ProductStats): string[] {
  const tags = [...(p.tags || [])];
  if (s.profit < 0 && !tags.includes('亏损')) tags.push('亏损');
  if (s.refundRate >= 12 && !tags.includes('高退款')) tags.push('高退款');
  if (s.totalPromo > 0 && s.roas > 0 && s.roas < 2 && !tags.includes('投放低效')) tags.push('投放低效');
  if (s.profitRate >= (p.targetMargin ?? 20) && s.netSales > 0 && !tags.includes('高利润')) tags.push('高利润');
  return tags;
}

export default function ProductView({ currentShop, shops }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [stats, setStats] = useState<Record<string, ProductStats>>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);
  const [rangeKey, setRangeKey] = useState<RangeKey>('thisMonth');
  const [status, setStatus] = useState('all');
  const [category, setCategory] = useState('all');
  const [tag, setTag] = useState('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'sales' | 'profit' | 'refund' | 'roas'>('sales');

  const range = useMemo(() => getQuickRange(rangeKey), [rangeKey]);
  const load = async () => {
    const targetShops = currentShop ? [currentShop] : shops;
    if (!targetShops.length) { setProducts([]); setLoading(false); return; }
    setLoading(true);
    try {
      const allProducts = (await Promise.all(targetShops.map((s) => fetchProducts(s.id)))).flat();
      const result: Record<string, ProductStats> = {};
      await Promise.all(allProducts.map(async (p) => {
        const [metrics, promotions, costs] = await Promise.all([
          fetchDailyMetrics(p.shopId, p.id, range.start, range.end),
          fetchDailyPromotions(p.shopId, p.id, range.start, range.end),
          fetchMonthlyCosts(p.shopId, p.id, Number(range.start.slice(0, 4)), 1, Number(range.end.slice(0, 4)), 12),
        ]);
        const totalSales = metrics.reduce((v, m) => v + Number(m.salesAmount || 0), 0);
        const totalRefund = metrics.reduce((v, m) => v + Number(m.refundAmount || 0), 0);
        const netSales = totalSales - totalRefund;
        const totalPromo = metrics.length ? metrics.reduce((v, m) => v + Number(m.promotionCost || 0), 0) : promotions.reduce((v, m) => v + Number(m.total || 0), 0);
        const shop = shops.find((s) => s.id === p.shopId);
        const productCost = p.unitCost != null ? metrics.reduce((v, m) => v + Number(m.orderCount || 0), 0) * p.unitCost : netSales * ((shop?.defaultCostRate || 0) / 100);
        const otherCosts = costs.reduce((v, c) => v + COST_FIELDS.filter((f) => f.key !== 'productCost').reduce((x, f) => x + Number(c[f.key as keyof MonthlyCost] || 0), 0), 0);
        const totalCost = productCost + otherCosts;
        const orderCount = metrics.reduce((v, m) => v + Number(m.orderCount || 0), 0);
        const visitorCount = metrics.reduce((v, m) => v + Number(m.visitorCount || 0), 0);
        const profit = netSales - totalCost - totalPromo;
        result[p.id] = { totalSales, totalRefund, netSales, refundRate: totalSales ? totalRefund / totalSales * 100 : 0, totalCost, totalPromo, profit, profitRate: netSales ? profit / netSales * 100 : 0, orderCount, visitorCount, conversionRate: visitorCount ? orderCount / visitorCount * 100 : 0, averageOrderValue: orderCount ? netSales / orderCount : 0, roas: totalPromo ? netSales / totalPromo : 0, incomplete: p.unitCost == null && !(shop?.defaultCostRate), };
      }));
      setProducts(allProducts); setStats(result);
    } catch (e: any) { showToast(e.message || '加载产品数据失败', 'error'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [currentShop, shops, range.start, range.end]);

  const categories = useMemo(() => Array.from(new Set(products.map((p) => p.category).filter(Boolean))) as string[], [products]);
  const allTags = useMemo(() => Array.from(new Set(products.flatMap((p) => tagFor(p, stats[p.id]).filter(Boolean)))), [products, stats]);
  const visibleProducts = useMemo(() => products.filter((p) => {
    const s = stats[p.id]; if (!s) return false;
    return (status === 'all' || p.status === status) && (category === 'all' || p.category === category) && (tag === 'all' || tagFor(p, s).includes(tag)) && (!query || `${p.name} ${p.sku || ''}`.toLowerCase().includes(query.toLowerCase()));
  }).sort((a, b) => { const x = stats[a.id]; const y = stats[b.id]; if (sort === 'profit') return y.profit - x.profit; if (sort === 'refund') return y.refundRate - x.refundRate; if (sort === 'roas') return y.roas - x.roas; return y.totalSales - x.totalSales; }), [products, stats, status, category, tag, query, sort]);
  const summary = useMemo(() => visibleProducts.reduce((a, p) => { const s = stats[p.id]; a.sales += s.totalSales; a.net += s.netSales; a.profit += s.profit; a.refund += s.totalRefund; a.promo += s.totalPromo; a.orders += s.orderCount; return a; }, { sales: 0, net: 0, profit: 0, refund: 0, promo: 0, orders: 0 }), [visibleProducts, stats]);
  const exportRows = () => { const header = '商品,SKU,销售额,净销售额,订单,退款率,推广花费,ROAS,利润,利润率\n'; const body = visibleProducts.map((p) => { const s = stats[p.id]; return [p.name, p.sku || '', s.totalSales.toFixed(2), s.netSales.toFixed(2), s.orderCount, s.refundRate.toFixed(2), s.totalPromo.toFixed(2), s.roas.toFixed(2), s.profit.toFixed(2), s.profitRate.toFixed(2)].join(','); }).join('\n'); const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `products-${range.start}-${range.end}.csv`; a.click(); URL.revokeObjectURL(a.href); };

  if (!shops.length) return <div className="card p-12 text-center text-slate-500">请先添加店铺，再管理商品。</div>;
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold text-slate-900 dark:text-white">产品中心</h2><p className="text-sm text-slate-500 mt-1">经营分析与投放决策</p></div><button onClick={() => setCreating(true)} className="btn-primary">+ 添加商品</button></div>
    <div className="card p-3 flex flex-wrap gap-2 items-center"><div className="flex gap-1">{rangeOptions.map((o) => <button key={o.key} onClick={() => setRangeKey(o.key)} className={`px-3 py-1.5 text-sm rounded ${rangeKey === o.key ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{o.label}</button>)}</div><input className="input max-w-xs" placeholder="搜索商品或 SKU" value={query} onChange={(e) => setQuery(e.target.value)} /><select className="input w-auto" value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">全部状态</option><option value="active">在售</option><option value="inactive">下架</option><option value="discontinued">停售</option></select><select className="input w-auto" value={category} onChange={(e) => setCategory(e.target.value)}><option value="all">全部分类</option>{categories.map((c) => <option key={c} value={c}>{c}</option>)}</select><select className="input w-auto" value={tag} onChange={(e) => setTag(e.target.value)}><option value="all">全部标签</option>{allTags.map((t) => <option key={t} value={t}>{t}</option>)}</select><select className="input w-auto" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}><option value="sales">按销售额</option><option value="profit">按利润</option><option value="refund">按退款率</option><option value="roas">按 ROAS</option></select><button onClick={exportRows} className="btn-secondary">导出</button></div>
    <div className="grid grid-cols-2 md:grid-cols-6 gap-3">{[['商品数', visibleProducts.length, ''], ['净销售额', formatCurrency(summary.net), ''], ['利润', formatCurrency(summary.profit), summary.profit >= 0 ? 'text-emerald-600' : 'text-red-500'], ['利润率', formatPercent(summary.net ? summary.profit / summary.net * 100 : 0), ''], ['退款金额', formatCurrency(summary.refund), ''], ['ROAS', summary.promo ? (summary.net / summary.promo).toFixed(2) : '—', '']].map(([label, value, color]) => <div key={String(label)} className="card p-3"><div className="text-xs text-slate-500">{label}</div><div className={`text-lg font-semibold mt-1 ${color}`}>{value}</div></div>)}</div>
    {loading ? <div className="text-center py-12 text-slate-400">加载中...</div> : <div className="card overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-xs text-slate-500 border-b"><th className="p-3">商品</th><th className="p-3">销售额</th><th className="p-3">订单/转化</th><th className="p-3">退款率</th><th className="p-3">推广/ROAS</th><th className="p-3">利润/利润率</th><th className="p-3">标签</th><th className="p-3">操作</th></tr></thead><tbody>{visibleProducts.map((p) => { const s = stats[p.id]; const tags = tagFor(p, s); return <tr key={p.id} className="border-b last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800"><td className="p-3"><div className="font-medium">{p.name}</div><div className="text-xs text-slate-400">{p.sku || '无 SKU'} · {p.category || '未分类'}</div></td><td className="p-3">{formatCurrency(s.totalSales)}<div className="text-xs text-slate-400">净 {formatCurrency(s.netSales)}</div></td><td className="p-3">{s.orderCount}<div className="text-xs text-slate-400">{formatPercent(s.conversionRate)}</div></td><td className={`p-3 ${s.refundRate >= 12 ? 'text-red-500' : ''}`}>{formatPercent(s.refundRate)}</td><td className="p-3">{formatCurrency(s.totalPromo)}<div className="text-xs text-slate-400">{s.roas ? s.roas.toFixed(2) : '—'}</div></td><td className={`p-3 ${s.profit < 0 ? 'text-red-500' : 'text-emerald-600'}`}>{formatCurrency(s.profit)}<div className="text-xs">{formatPercent(s.profitRate)}</div></td><td className="p-3"><div className="flex flex-wrap gap-1">{s.incomplete && <span className="chip bg-amber-100 text-amber-700">成本缺失</span>}{tags.map((t) => <span key={t} className={`chip ${t === '亏损' || t === '高退款' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>{t}</span>)}</div></td><td className="p-3 whitespace-nowrap"><button onClick={() => setEditing(p)} className="btn-secondary text-xs mr-1">编辑</button><button onClick={async () => { if (!confirm(`确定删除商品“${p.name}”吗？`)) return; try { await deleteProduct(p.id); showToast('已删除', 'success'); load(); } catch (e: any) { showToast(e.message || '删除失败', 'error'); } }} className="btn-danger text-xs">删除</button></td></tr>; })}</tbody></table>{!visibleProducts.length && <div className="p-10 text-center text-slate-400">没有符合条件的商品</div>}</div>}
    {(creating || editing) && currentShop && <ProductEditor product={editing} shopId={currentShop.id} onClose={() => { setCreating(false); setEditing(null); }} onSaved={() => { setCreating(false); setEditing(null); load(); }} />}
  </div>;
}

function ProductEditor({ product, shopId, onClose, onSaved }: { product: Product | null; shopId: string; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(product?.name || ''); const [sku, setSku] = useState(product?.sku || ''); const [category, setCategory] = useState(product?.category || ''); const [status, setStatus] = useState<Product['status']>(product?.status || 'active'); const [salePrice, setSalePrice] = useState(product?.salePrice?.toString() || ''); const [unitCost, setUnitCost] = useState(product?.unitCost?.toString() || ''); const [targetMargin, setTargetMargin] = useState(product?.targetMargin?.toString() || ''); const [tags, setTags] = useState((product?.tags || []).join(', ')); const [saving, setSaving] = useState(false);
  const save = async () => { if (!name.trim()) { showToast('请输入商品名称', 'warning'); return; } setSaving(true); try { const input = { name: name.trim(), sku: sku.trim(), category: category.trim(), status, salePrice: salePrice === '' ? undefined : Number(salePrice), unitCost: unitCost === '' ? undefined : Number(unitCost), targetMargin: targetMargin === '' ? undefined : Number(targetMargin), tags: tags.split(',').map((v) => v.trim()).filter(Boolean) }; if (product) await updateProduct(product.id, input); else await createProduct({ ...input, sortOrder: 0, shopId }); showToast(product ? '已更新' : '已添加', 'success'); onSaved(); } catch (e: any) { showToast(e.message || '保存失败', 'error'); } finally { setSaving(false); } };
  return <Modal open onClose={onClose} title={product ? '编辑商品' : '添加商品'} footer={<><button onClick={onClose} className="btn-secondary">取消</button><button onClick={save} disabled={saving} className="btn-primary">{saving ? '保存中...' : '保存'}</button></>}><div className="space-y-3"><div><label className="label">商品名称 *</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></div><div className="grid grid-cols-2 gap-3"><div><label className="label">SKU</label><input className="input" value={sku} onChange={(e) => setSku(e.target.value)} /></div><div><label className="label">分类</label><input className="input" value={category} onChange={(e) => setCategory(e.target.value)} /></div><div><label className="label">售价</label><input type="number" min="0" className="input" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} /></div><div><label className="label">单位成本</label><input type="number" min="0" className="input" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} /></div><div><label className="label">目标毛利率 (%)</label><input type="number" min="0" max="100" className="input" value={targetMargin} onChange={(e) => setTargetMargin(e.target.value)} /></div><div><label className="label">标签</label><input className="input" placeholder="爆款, 夏季" value={tags} onChange={(e) => setTags(e.target.value)} /></div></div><div><label className="label">状态</label><select className="input" value={status} onChange={(e) => setStatus(e.target.value as Product['status'])}><option value="active">在售</option><option value="inactive">下架</option><option value="discontinued">停售</option></select></div></div></Modal>;
}
