import { useEffect, useState, useMemo } from 'react';
import type { Shop, Product, DailyMetric, DailyPromotion, MonthlyCost, MetricsSummary } from '@/types';
import { PROMOTION_FIELDS, COST_FIELDS } from '@/types';
import { fetchProducts, fetchDailyMetrics, fetchDailyPromotions, fetchMonthlyCosts } from '@/lib/db';
import { showToast } from '@/components/Toast';
import EChart from '@/components/EChart';
import Modal from '@/components/Modal';
import AIInsightPanel from '@/components/AIInsightPanel';
import {
  calculateMetrics,
  calculateExtendedMetrics,
  getLastMonthRange,
  getNaturalYearRange,
  getSeasonalYearRange,
  getLastYearSameRange,
  getQuickRange,
  formatLocalDate,
  formatCurrency,
  formatPercent,
  formatNumber,
  formatRatio,
} from '@/lib/calc';
import { generateInsight, generateSuggestion, generateReport, forecastSales } from '@/lib/ai';

interface Props {
  currentShop: Shop | null;
  shops: Shop[];
  setShops: (shops: Shop[]) => void;
}

type QuickRangeType = 'today' | 'yesterday' | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth' | 'thisNaturalYear' | 'thisSeasonalYear' | 'lastNaturalYear' | 'lastSeasonalYear' | 'last30Days' | 'last90Days' | 'custom';
type SubTab = 'overview' | 'trend' | 'structure' | 'yoy' | 'roi' | 'profit' | 'ai';

export default function AnalysisView({ currentShop, shops }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [rangeType, setRangeType] = useState<QuickRangeType>('thisMonth');
  const [customStart, setCustomStart] = useState(formatLocalDate(new Date()));
  const [customEnd, setCustomEnd] = useState(formatLocalDate(new Date()));
  const [metrics, setMetrics] = useState<DailyMetric[]>([]);
  const [promotions, setPromotions] = useState<DailyPromotion[]>([]);
  const [costs, setCosts] = useState<MonthlyCost[]>([]);
  const [lastYearMetrics, setLastYearMetrics] = useState<DailyMetric[]>([]);
  const [lastMonthMetrics, setLastMonthMetrics] = useState<DailyMetric[]>([]);
  const [loading, setLoading] = useState(false);
  const [subTab, setSubTab] = useState<SubTab>('overview');
  const [aiModal, setAiModal] = useState<{ type: 'insight' | 'suggestion' | 'report' | 'forecast'; content: string; loading: boolean } | null>(null);

  const range = useMemo(() => {
    if (rangeType === 'custom') return { start: customStart, end: customEnd };
    return getQuickRange(rangeType);
  }, [rangeType, customStart, customEnd]);

  useEffect(() => {
    if (!currentShop) {
      setProducts([]);
      return;
    }
    fetchProducts(currentShop.id).then(setProducts).catch(() => setProducts([]));
  }, [currentShop]);

  const loadData = async () => {
    setLoading(true);
    try {
      const shopId = currentShop?.id || null; // null = 所有店铺
      const productId = selectedProduct || null;
      // 去年同期和上月范围
      const lastYearRange = getLastYearSameRange(range.start, range.end);
      const lastMonthRange = getLastMonthRange();

      // 5 个 API 并行调用（之前是串行，慢 3 倍）
      const [m, p, c, lm, lmm] = await Promise.all([
        fetchDailyMetrics(shopId, productId, range.start, range.end),
        fetchDailyPromotions(shopId, productId, range.start, range.end),
        fetchMonthlyCosts(shopId, productId, new Date(range.start).getFullYear(), new Date(range.start).getMonth() + 1, new Date(range.end).getFullYear(), new Date(range.end).getMonth() + 1),
        fetchDailyMetrics(shopId, productId, lastYearRange.start, lastYearRange.end),
        fetchDailyMetrics(shopId, productId, lastMonthRange.start, lastMonthRange.end),
      ]);

      setMetrics(m);
      setPromotions(p);
      setCosts(c);
      setLastYearMetrics(lm);
      setLastMonthMetrics(lmm);
    } catch (e: any) {
      showToast(e.message || '加载失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentShop, selectedProduct, range.start, range.end]);

  // 实时同步
  useEffect(() => {
    const handler = () => loadData();
    window.addEventListener('realtime:metrics', handler);
    window.addEventListener('realtime:promotions', handler);
    window.addEventListener('realtime:costs', handler);
    return () => {
      window.removeEventListener('realtime:metrics', handler);
      window.removeEventListener('realtime:promotions', handler);
      window.removeEventListener('realtime:costs', handler);
    };
  }, [currentShop, selectedProduct, range.start, range.end]);

  // 计算当前选中店铺的默认成本率（所有店铺模式下取第一个有成本率的店铺，或按销售额加权平均）
  const shopCostRate = useMemo(() => {
    if (currentShop) return currentShop.defaultCostRate || 0;
    // 所有店铺模式：取有数据的店铺的成本率（简化为取第一个 > 0 的）
    const shopWithRate = shops.find((s) => (s.defaultCostRate || 0) > 0);
    return shopWithRate?.defaultCostRate || 0;
  }, [currentShop, shops]);

  const summary: MetricsSummary = useMemo(() => {
    return calculateMetrics(metrics, promotions, costs, lastYearMetrics, shopCostRate);
  }, [metrics, promotions, costs, lastYearMetrics, shopCostRate]);

  const handleAI = async (type: 'insight' | 'suggestion' | 'report' | 'forecast') => {
    setAiModal({ type, content: '', loading: true });
    try {
      let content = '';
      if (type === 'insight') {
        content = await generateInsight({ metrics: summary, dailyMetrics: metrics, promotions, costs, shop: currentShop || undefined });
      } else if (type === 'suggestion') {
        content = await generateSuggestion({ metrics: summary, promotions, costs });
      } else if (type === 'report') {
        content = await generateReport({
          shop: currentShop || undefined,
          period: `${range.start} 至 ${range.end}`,
          metrics: summary,
          dailyMetrics: metrics,
          promotions,
          costs,
        });
      } else if (type === 'forecast') {
        content = await forecastSales(metrics, 30);
      }
      setAiModal({ type, content, loading: false });
    } catch (e: any) {
      setAiModal({ type, content: '生成失败：' + e.message, loading: false });
    }
  };

  if (shops.length === 0) {
    return (
      <div className="card p-12 text-center">
        <div className="text-5xl mb-4">🏪</div>
        <p className="text-slate-500">请先在「店铺管理」中添加店铺</p>
      </div>
    );
  }

  const SUB_TABS: { key: SubTab; label: string; icon: string }[] = [
    { key: 'overview', label: '总览', icon: '📋' },
    { key: 'trend', label: '趋势分析', icon: '📈' },
    { key: 'structure', label: '结构分析', icon: '🥧' },
    { key: 'yoy', label: '同比分析', icon: '📊' },
    { key: 'roi', label: '投产比', icon: '💰' },
    { key: 'profit', label: '利润计算', icon: '💎' },
    { key: 'ai', label: 'AI 分析', icon: '🤖' },
  ];

  // 获取当前周期的中文标签
  const rangeLabels: Record<string, string> = {
    today: '今日', yesterday: '昨日', thisWeek: '本周', lastWeek: '上周',
    thisMonth: '本月', lastMonth: '上月', last30Days: '近30天', last90Days: '近90天',
    thisNaturalYear: '本自然年', lastNaturalYear: '上自然年',
    thisSeasonalYear: '本季节年', lastSeasonalYear: '上季节年', custom: '自定义',
  };
  const rangeLabel = rangeLabels[rangeType] || '当前周期';

  return (
    <div className="flex gap-4">
    <div className="flex-1 min-w-0 space-y-4">
      {/* 头部 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">经营分析中心</h2>
          <p className="text-sm text-slate-500 mt-1">{currentShop?.name || '所有店铺汇总'}</p>
        </div>
        <div className="flex gap-2 items-center">
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
      </div>

      {/* 日期范围选择 */}
      <div className="card p-3 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-slate-500">周期：</span>
          <div className="flex gap-1 flex-wrap">
            {([
              { key: 'today', label: '今日' },
              { key: 'yesterday', label: '昨日' },
              { key: 'thisWeek', label: '本周' },
              { key: 'lastWeek', label: '上周' },
              { key: 'thisMonth', label: '本月' },
              { key: 'lastMonth', label: '上月' },
              { key: 'last30Days', label: '近30天' },
              { key: 'last90Days', label: '近90天' },
              { key: 'thisNaturalYear', label: '本自然年' },
              { key: 'lastNaturalYear', label: '上自然年' },
              { key: 'thisSeasonalYear', label: '本季节年' },
              { key: 'lastSeasonalYear', label: '上季节年' },
              { key: 'custom', label: '自定义' },
            ] as { key: QuickRangeType; label: string }[]).map((r) => (
              <button
                key={r.key}
                onClick={() => setRangeType(r.key)}
                className={`px-2.5 py-1 rounded-md text-xs transition ${
                  rangeType === r.key ? 'bg-primary-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
        {rangeType === 'custom' && (
          <div className="flex items-center gap-2 text-sm">
            <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800" />
            <span className="text-slate-400">至</span>
            <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800" />
          </div>
        )}
        <div className="text-xs text-slate-400">
          当前范围：{range.start} 至 {range.end}
        </div>
      </div>

      {/* 子标签 */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {SUB_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key)}
            className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition ${
              subTab === t.key ? 'bg-primary-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">加载中...</div>
      ) : (
        <>
          {subTab === 'overview' && <OverviewTab summary={summary} metrics={metrics} costs={costs} lastMonthMetrics={lastMonthMetrics} shopCostRate={shopCostRate} />}
          {subTab === 'trend' && <TrendTab metrics={metrics} />}
          {subTab === 'structure' && <StructureTab promotions={promotions} costs={costs} />}
          {subTab === 'yoy' && <YoYTab metrics={metrics} lastYearMetrics={lastYearMetrics} />}
          {subTab === 'roi' && <RoITab promotions={promotions} metrics={metrics} />}
          {subTab === 'profit' && <ProfitTab summary={summary} promotions={promotions} costs={costs} metrics={metrics} shopCostRate={shopCostRate} />}
          {subTab === 'ai' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button onClick={() => handleAI('insight')} className="card p-6 text-left hover:shadow-md transition">
                <div className="text-3xl mb-2">💡</div>
                <h3 className="font-medium text-slate-900 dark:text-white mb-1">智能洞察</h3>
                <p className="text-sm text-slate-500">自动扫描数据，发现异常和趋势，推送经营预警</p>
              </button>
              <button onClick={() => handleAI('suggestion')} className="card p-6 text-left hover:shadow-md transition">
                <div className="text-3xl mb-2">🎯</div>
                <h3 className="font-medium text-slate-900 dark:text-white mb-1">经营建议</h3>
                <p className="text-sm text-slate-500">分析各渠道投产比，给出具体优化建议</p>
              </button>
              <button onClick={() => handleAI('forecast')} className="card p-6 text-left hover:shadow-md transition">
                <div className="text-3xl mb-2">🔮</div>
                <h3 className="font-medium text-slate-900 dark:text-white mb-1">销售预测</h3>
                <p className="text-sm text-slate-500">基于历史 30/60/90 天数据预测下月销售额</p>
              </button>
              <button onClick={() => handleAI('report')} className="card p-6 text-left hover:shadow-md transition">
                <div className="text-3xl mb-2">📄</div>
                <h3 className="font-medium text-slate-900 dark:text-white mb-1">智能报表</h3>
                <p className="text-sm text-slate-500">一键生成 Markdown 经营分析报告</p>
              </button>
            </div>
          )}
        </>
      )}

      {aiModal && (
        <Modal
          open={true}
          onClose={() => setAiModal(null)}
          title={`AI ${aiModal.type === 'insight' ? '智能洞察' : aiModal.type === 'suggestion' ? '经营建议' : aiModal.type === 'forecast' ? '销售预测' : '报表解读'}`}
          size="lg"
        >
          {aiModal.loading ? (
            <div className="text-center py-12">
              <div className="inline-block w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mb-3"></div>
              <p className="text-slate-500 text-sm">AI 正在分析数据...</p>
            </div>
          ) : (
            <div className="prose prose-sm max-w-none whitespace-pre-wrap text-slate-700 dark:text-slate-200">
              {aiModal.content}
            </div>
          )}
        </Modal>
      )}
    </div>

    {/* PC 端右侧 AI 洞察面板（xl 以上屏幕，根据选择的时间范围分析） */}
    <AIInsightPanel currentShop={currentShop} shops={shops} range={range} rangeLabel={rangeLabel} />
    </div>
  );
}

// ============= 总览 Tab =============
function OverviewTab({ summary, metrics, costs, lastMonthMetrics, shopCostRate }: {
  summary: MetricsSummary;
  metrics: DailyMetric[];
  costs: MonthlyCost[];
  lastMonthMetrics: DailyMetric[];
  shopCostRate: number;
}) {
  // 计算衍生指标
  const ext = useMemo(() => calculateExtendedMetrics(metrics, costs, lastMonthMetrics, shopCostRate), [metrics, costs, lastMonthMetrics, shopCostRate]);
  // 录入数据（用户手动填写）
  const inputKpis = [
    { label: '累积销售额', value: formatCurrency(summary.totalSales), sub: `${formatNumber(summary.totalOrders)} 单`, color: 'text-slate-900 dark:text-white' },
    { label: '累积退款', value: formatCurrency(summary.totalRefund), sub: '用户录入', color: 'text-red-500' },
    { label: '推广费用', value: formatCurrency(summary.promoTotal), sub: '用户录入', color: 'text-amber-600' },
    { label: '访客数', value: formatNumber(summary.totalVisitors), sub: '用户录入', color: 'text-purple-600' },
    { label: '订单量', value: formatNumber(summary.totalOrders), sub: '用户录入', color: 'text-slate-700 dark:text-slate-200' },
    { label: '总成本', value: formatCurrency(summary.totalCost), sub: `货品${formatCurrency(summary.productCost)}+其他${formatCurrency(summary.otherCosts)}`, color: 'text-slate-600' },
  ];

  // 计算数据（系统自动算出）
  const calcKpis = [
    { label: '净销售额', value: formatCurrency(summary.netSales), sub: '销售额 - 退款', color: 'text-emerald-600' },
    { label: '退款率', value: formatPercent(summary.refundRate), sub: '退款 / 销售额', color: summary.refundRate > 10 ? 'text-red-500' : 'text-slate-700 dark:text-slate-200', pulse: summary.refundRate > 10 },
    { label: '同比去年', value: summary.yoyGrowth === null ? '—' : (summary.yoyGrowth > 0 ? '+' : '') + formatPercent(summary.yoyGrowth), sub: summary.yoyGrowth === null ? '暂无去年数据' : (summary.yoyGrowth > 0 ? '↑ 同比增长' : '↓ 同比下降'), color: summary.yoyGrowth === null ? 'text-slate-400' : summary.yoyGrowth >= 0 ? 'text-emerald-600' : 'text-red-500' },
    { label: '推广占比', value: formatPercent(summary.promoRate), sub: '推广费 / 销售额', color: 'text-amber-600' },
    { label: '累积推广占比', value: formatPercent(summary.cumPromoRate), sub: '累积推广费 / 累积销售额', color: 'text-amber-600' },
    { label: '累积净销售额', value: formatCurrency(summary.cumNetSales), sub: '累积销售额 - 累积退款', color: 'text-emerald-600' },
    { label: '累积推广费', value: formatCurrency(summary.cumPromoTotal), sub: '期间推广费总和', color: 'text-amber-600' },
    { label: '累积净推广费率', value: formatPercent(summary.cumNetPromoRate), sub: '累积推广费 / 累积净销售额', color: 'text-amber-600' },
    { label: '当日投产比', value: formatRatio(summary.dailyROI), sub: '销售额 / 推广费', color: 'text-blue-600' },
    { label: '累积净投产比', value: formatRatio(summary.cumNetROI), sub: '累积净销售额 / 累积推广费', color: 'text-blue-600' },
    { label: '利润', value: formatCurrency(summary.profit), sub: '净销售额 - 总成本 - 推广费', color: summary.profit >= 0 ? 'text-emerald-600' : 'text-red-500', pulse: summary.profit < 0 },
    { label: '利润率', value: formatPercent(summary.profitRate), sub: '利润 / 净销售额', color: summary.profitRate >= 0 ? 'text-emerald-600' : 'text-red-500', pulse: summary.profitRate < 0 },
    { label: '推广前利润率', value: formatPercent(summary.prePromoProfitRate), sub: '净销售额 - 非推广成本', color: summary.prePromoProfitRate >= 0 ? 'text-emerald-600' : 'text-red-500' },
    { label: '保本投产比', value: summary.breakEvenROI === null ? '无法保本' : formatRatio(summary.breakEvenROI), sub: '净销售额 / 保本推广费用', color: 'text-blue-600' },
    { label: '转化率', value: summary.totalVisitors > 0 ? formatPercent((summary.totalOrders / summary.totalVisitors) * 100) : '0%', sub: '订单量 / 访客数', color: 'text-purple-600' },
    // ===== 新增 10 个高价值衍生指标 =====
    { label: '客单价', value: formatCurrency(ext.avgOrderValue), sub: '销售额 / 订单量', color: 'text-blue-600' },
    { label: 'UV价值', value: formatCurrency(ext.uvValue), sub: '销售额 / 访客数', color: 'text-blue-600' },
    { label: '货品成本率', value: formatPercent(ext.productCostRate), sub: `货品成本 / 净销售额（按${shopCostRate}%计算）`, color: 'text-amber-600' },
    { label: '毛利', value: formatCurrency(ext.grossProfit), sub: '净销售额 - 货品成本', color: ext.grossProfit >= 0 ? 'text-emerald-600' : 'text-red-500' },
    { label: '毛利率', value: formatPercent(ext.grossProfitRate), sub: '(净销售额-货品成本) / 净销售额', color: ext.grossProfitRate >= 0 ? 'text-emerald-600' : 'text-red-500' },
    { label: '每访客推广费', value: formatCurrency(ext.costPerVisitor), sub: '推广费 / 访客数', color: 'text-amber-600' },
    { label: '每单推广费', value: formatCurrency(ext.costPerOrder), sub: '推广费 / 订单量', color: 'text-amber-600' },
    { label: '推广费率', value: formatPercent(ext.promoCostRate), sub: '推广费 / 净销售额', color: 'text-amber-600' },
    { label: '日均销售额', value: formatCurrency(ext.dailyAvgSales), sub: '销售额 / 天数', color: 'text-blue-600' },
    { label: '销售波动率', value: formatPercent(ext.salesVolatility), sub: '标准差 / 均值（越低越稳定）', color: ext.salesVolatility > 50 ? 'text-red-500' : 'text-slate-700 dark:text-slate-200' },
    { label: '环比上月', value: ext.monthlyGrowth === null ? '—' : (ext.monthlyGrowth > 0 ? '+' : '') + formatPercent(ext.monthlyGrowth), sub: ext.monthlyGrowth === null ? '暂无上月数据' : (ext.monthlyGrowth > 0 ? '↑ 环比增长' : '↓ 环比下降'), color: ext.monthlyGrowth === null ? 'text-slate-400' : ext.monthlyGrowth >= 0 ? 'text-emerald-600' : 'text-red-500' },
  ];

  return (
    <div className="space-y-4">
      {/* 录入数据 */}
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-2 h-5 bg-primary-600 rounded"></span>
          <h3 className="font-medium text-slate-900 dark:text-white">📝 录入数据（用户填写）</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {inputKpis.map((kpi, i) => (
            <div key={i} className="kpi-card p-3 bg-slate-50 dark:bg-slate-700/30 rounded-lg">
              <div className="text-xs text-slate-500 mb-1">{kpi.label}</div>
              <div className={`text-base font-bold ${kpi.color}`}>{kpi.value}</div>
              <div className="text-xs text-slate-400 mt-1">{kpi.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 计算数据 */}
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-2 h-5 bg-emerald-500 rounded"></span>
          <h3 className="font-medium text-slate-900 dark:text-white">⚙️ 计算数据（自动算出）</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {calcKpis.map((kpi, i) => (
            <div key={i} className={`kpi-card p-3 bg-emerald-50 dark:bg-emerald-900/10 rounded-lg ${kpi.pulse ? 'pulse-red' : ''}`}>
              <div className="text-xs text-slate-500 mb-1">{kpi.label}</div>
              <div className={`text-lg font-bold ${kpi.color}`}>{kpi.value}</div>
              <div className="text-xs text-slate-400 mt-1">{kpi.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============= 趋势分析 =============
function TrendTab({ metrics }: { metrics: DailyMetric[] }) {
  if (metrics.length === 0) return <div className="card p-12 text-center text-slate-400">暂无数据</div>;

  const dates = metrics.map((m) => m.date);
  const salesData = metrics.map((m) => m.salesAmount);
  const orderData = metrics.map((m) => m.orderCount);
  const visitorData = metrics.map((m) => m.visitorCount);
  const refundData = metrics.map((m) => m.refundAmount);

  const salesOption = {
    tooltip: { trigger: 'axis' },
    legend: { data: ['销售额', '退款金额'], textStyle: { color: '#94a3b8' } },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'category', data: dates, axisLabel: { rotate: dates.length > 15 ? 45 : 0, color: '#94a3b8' }, axisLine: { lineStyle: { color: '#334155' } } },
    yAxis: { type: 'value', axisLabel: { color: '#94a3b8' }, splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.1)' } } },
    series: [
      {
        name: '销售额', type: 'line', smooth: true, data: salesData,
        itemStyle: { color: '#3b82f6', shadowColor: 'rgba(59, 130, 246, 0.5)', shadowBlur: 10 },
        lineStyle: { width: 3, shadowColor: 'rgba(59, 130, 246, 0.4)', shadowBlur: 8 },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(59, 130, 246, 0.4)' },
              { offset: 1, color: 'rgba(59, 130, 246, 0.02)' },
            ],
          },
        },
      },
      {
        name: '退款金额', type: 'line', smooth: true, data: refundData,
        itemStyle: { color: '#ef4444', shadowColor: 'rgba(239, 68, 68, 0.5)', shadowBlur: 10 },
        lineStyle: { width: 2, shadowColor: 'rgba(239, 68, 68, 0.4)', shadowBlur: 6 },
      },
    ],
  };

  const orderOption = {
    tooltip: { trigger: 'axis' },
    legend: { data: ['订单量', '访客数'], textStyle: { color: '#94a3b8' } },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'category', data: dates, axisLabel: { rotate: dates.length > 15 ? 45 : 0, color: '#94a3b8' }, axisLine: { lineStyle: { color: '#334155' } } },
    yAxis: [
      { type: 'value', name: '订单量', axisLabel: { color: '#94a3b8' }, splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.1)' } } },
      { type: 'value', name: '访客数', axisLabel: { color: '#94a3b8' }, splitLine: { show: false } },
    ],
    series: [
      {
        name: '订单量', type: 'bar', data: orderData,
        itemStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: '#10b981' },
              { offset: 1, color: 'rgba(16, 185, 129, 0.3)' },
            ],
          },
          shadowColor: 'rgba(16, 185, 129, 0.4)', shadowBlur: 8,
        },
      },
      {
        name: '访客数', type: 'line', yAxisIndex: 1, smooth: true, data: visitorData,
        itemStyle: { color: '#f59e0b', shadowColor: 'rgba(245, 158, 11, 0.5)', shadowBlur: 10 },
        lineStyle: { width: 3, shadowColor: 'rgba(245, 158, 11, 0.4)', shadowBlur: 8 },
      },
    ],
  };

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <h3 className="font-medium mb-2">销售额 & 退款趋势</h3>
        <EChart option={salesOption} height={320} />
      </div>
      <div className="card p-4">
        <h3 className="font-medium mb-2">订单量 & 访客数趋势</h3>
        <EChart option={orderOption} height={320} />
      </div>
    </div>
  );
}

// ============= 结构分析 =============
function StructureTab({ promotions, costs }: { promotions: DailyPromotion[]; costs: MonthlyCost[] }) {
  const promoData = PROMOTION_FIELDS.map((f) => ({
    name: f.label,
    value: promotions.reduce((s, p) => s + (Number(p[f.key as keyof DailyPromotion]) || 0), 0),
  })).filter((x) => x.value > 0);

  const costData = COST_FIELDS.map((f) => ({
    name: f.label,
    value: costs.reduce((s, c) => s + (Number(c[f.key as keyof MonthlyCost]) || 0), 0),
  })).filter((x) => x.value > 0);

  const promoOption = {
    tooltip: { trigger: 'item', formatter: '{b}: ¥{c} ({d}%)' },
    legend: { type: 'scroll', bottom: 0, left: 'center' },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      avoidLabelOverlap: false,
      label: { show: false },
      emphasis: { label: { show: true, fontSize: 14, fontWeight: 'bold' } },
      labelLine: { show: false },
      data: promoData,
    }],
  };

  const costOption = {
    tooltip: { trigger: 'item', formatter: '{b}: ¥{c} ({d}%)' },
    legend: { type: 'scroll', bottom: 0, left: 'center' },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      avoidLabelOverlap: false,
      label: { show: false },
      emphasis: { label: { show: true, fontSize: 14, fontWeight: 'bold' } },
      labelLine: { show: false },
      data: costData,
    }],
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="card p-4">
        <h3 className="font-medium mb-2">推广费用构成</h3>
        {promoData.length === 0 ? (
          <div className="text-center py-12 text-slate-400">暂无推广数据</div>
        ) : (
          <EChart option={promoOption} height={350} />
        )}
      </div>
      <div className="card p-4">
        <h3 className="font-medium mb-2">成本构成</h3>
        {costData.length === 0 ? (
          <div className="text-center py-12 text-slate-400">暂无成本数据</div>
        ) : (
          <EChart option={costOption} height={350} />
        )}
      </div>
    </div>
  );
}

// ============= 同比分析 =============
function YoYTab({ metrics, lastYearMetrics }: { metrics: DailyMetric[]; lastYearMetrics: DailyMetric[] }) {
  if (metrics.length === 0 && lastYearMetrics.length === 0) {
    return <div className="card p-12 text-center text-slate-400">暂无数据</div>;
  }

  // 按月汇总（统一用 YYYY-MM 格式）
  const thisYearByMonth: Record<string, number> = {};
  metrics.forEach((m) => {
    const month = m.date.slice(0, 7);
    thisYearByMonth[month] = (thisYearByMonth[month] || 0) + m.salesAmount;
  });
  const lastYearByMonth: Record<string, number> = {};
  lastYearMetrics.forEach((m) => {
    const month = m.date.slice(0, 7); // YYYY-MM
    lastYearByMonth[month] = (lastYearByMonth[month] || 0) + m.salesAmount;
  });

  const months = Object.keys(thisYearByMonth).sort();
  const thisYearData = months.map((m) => Number(thisYearByMonth[m].toFixed(2)));
  const lastYearData = months.map((m) => {
    // 取去年同月：将 YYYY-MM 的年份减1
    const lastYearMonth = `${parseInt(m.slice(0, 4)) - 1}-${m.slice(5, 7)}`;
    return Number((lastYearByMonth[lastYearMonth] || 0).toFixed(2));
  });

  const option = {
    tooltip: { trigger: 'axis' },
    legend: { data: ['今年', '去年'] },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'category', data: months },
    yAxis: { type: 'value' },
    series: [
      { name: '今年', type: 'bar', data: thisYearData, itemStyle: { color: '#2563eb' } },
      { name: '去年', type: 'bar', data: lastYearData, itemStyle: { color: '#94a3b8' } },
    ],
  };

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <h3 className="font-medium mb-2">今年 vs 去年 销售额对比（按月）</h3>
        <EChart option={option} height={350} />
      </div>
      <div className="card p-4">
        <h3 className="font-medium mb-3">详细对比</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left">月份</th>
                <th className="px-3 py-2 text-right">今年</th>
                <th className="px-3 py-2 text-right">去年</th>
                <th className="px-3 py-2 text-right">差额</th>
                <th className="px-3 py-2 text-right">同比</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {months.map((m) => {
                const t = thisYearByMonth[m] || 0;
                const l = lastYearByMonth[`${parseInt(m.slice(0, 4)) - 1}-${m.slice(5, 7)}`] || 0;
                const diff = t - l;
                const rate = l > 0 ? (diff / l) * 100 : null;
                return (
                  <tr key={m}>
                    <td className="px-3 py-2">{m}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(t)}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(l)}</td>
                    <td className={`px-3 py-2 text-right ${diff >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{diff >= 0 ? '+' : ''}{formatCurrency(diff)}</td>
                    <td className={`px-3 py-2 text-right ${rate === null ? 'text-slate-400' : rate >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {rate === null ? '—' : (rate >= 0 ? '+' : '') + formatPercent(rate)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ============= 投产比分析 =============
function RoITab({ promotions, metrics }: { promotions: DailyPromotion[]; metrics: DailyMetric[] }) {
  if (promotions.length === 0 || metrics.length === 0) {
    return <div className="card p-12 text-center text-slate-400">暂无数据</div>;
  }

  // 按日合并
  const byDate: Record<string, { sales: number; promo: number }> = {};
  metrics.forEach((m) => {
    if (!byDate[m.date]) byDate[m.date] = { sales: 0, promo: 0 };
    byDate[m.date].sales += m.salesAmount;
  });
  promotions.forEach((p) => {
    if (!byDate[p.date]) byDate[p.date] = { sales: 0, promo: 0 };
    byDate[p.date].promo += p.total;
  });

  const dates = Object.keys(byDate).sort();
  const scatterData = dates.map((d) => [byDate[d].promo, byDate[d].sales, d]);

  const scatterOption = {
    tooltip: {
      trigger: 'item',
      formatter: (p: any) => `${p.data[2]}<br/>推广: ¥${p.data[0].toFixed(2)}<br/>销售: ¥${p.data[1].toFixed(2)}<br/>ROI: ${p.data[0] > 0 ? (p.data[1] / p.data[0]).toFixed(2) : '—'}`,
    },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'value', name: '推广费用', nameLocation: 'middle', nameGap: 30 },
    yAxis: { type: 'value', name: '销售额', nameLocation: 'middle', nameGap: 40 },
    series: [{
      type: 'scatter',
      data: scatterData,
      symbolSize: 10,
      itemStyle: { color: '#2563eb', opacity: 0.7 },
    }],
  };

  // 各推广渠道投产比
  const totalSalesForROI = metrics.reduce((s, m) => s + m.salesAmount, 0);
  const channelROI = PROMOTION_FIELDS.map((f) => {
    const total = promotions.reduce((s, p) => s + (Number(p[f.key as keyof DailyPromotion]) || 0), 0);
    return {
      name: f.label,
      promo: total,
      roi: total > 0 ? totalSalesForROI / total : 0,
    };
  }).filter((x) => x.promo > 0).sort((a, b) => b.roi - a.roi);

  const channelOption = {
    tooltip: { trigger: 'axis' },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'category', data: channelROI.map((c) => c.name), axisLabel: { rotate: 30 } },
    yAxis: { type: 'value', name: '投产比' },
    series: [{
      type: 'bar',
      data: channelROI.map((c) => Number(c.roi.toFixed(2))),
      itemStyle: {
        color: (params: any) => {
          const v = params.value;
          if (v >= 5) return '#10b981';
          if (v >= 3) return '#2563eb';
          if (v >= 2) return '#f59e0b';
          return '#ef4444';
        },
      },
    }],
  };

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <h3 className="font-medium mb-2">推广费用 vs 销售额 散点图</h3>
        <EChart option={scatterOption} height={350} />
        <p className="text-xs text-slate-400 mt-2">点越靠右上角表示推广效率越高</p>
      </div>
      <div className="card p-4">
        <h3 className="font-medium mb-2">各推广渠道投产比排行</h3>
        {channelROI.length === 0 ? (
          <div className="text-center py-12 text-slate-400">暂无推广数据</div>
        ) : (
          <EChart option={channelOption} height={350} />
        )}
      </div>
    </div>
  );
}

// ============= 利润计算 =============
function ProfitTab({ summary, promotions, costs, metrics, shopCostRate }: { summary: MetricsSummary; promotions: DailyPromotion[]; costs: MonthlyCost[]; metrics: DailyMetric[]; shopCostRate: number }) {
  // 利润明细
  const incomeItems = [
    { label: '销售额', value: summary.totalSales, type: 'income' },
    { label: '退款金额', value: -summary.totalRefund, type: 'refund' },
    { label: '净销售额', value: summary.netSales, type: 'subtotal' },
  ];

  const costItems = COST_FIELDS.map((f) => {
    if (f.key === 'productCost') {
      // 货品成本始终用自动计算的值（净销售额 × 店铺百分比）
      return {
        label: `货品成本（净销售额×${shopCostRate}% = ${formatCurrency(summary.autoProductCost)}）`,
        value: -summary.autoProductCost,
        type: 'cost',
      };
    }
    // 其他成本从 monthly_cost 表取
    return {
      label: f.label,
      value: -costs.reduce((s, c) => s + (Number(c[f.key as keyof MonthlyCost]) || 0), 0),
      type: 'cost',
    };
  }).filter((x) => x.value !== 0);

  const promoItems = PROMOTION_FIELDS.map((f) => ({
    label: f.label,
    value: -promotions.reduce((s, p) => s + (Number(p[f.key as keyof DailyPromotion]) || 0), 0),
    type: 'promo',
  })).filter((x) => x.value !== 0);

  const option = {
    tooltip: {
      trigger: 'item',
      formatter: (p: any) => `${p.name}<br/>${formatCurrency(Math.abs(p.value))}`,
    },
    legend: { type: 'scroll', bottom: 0 },
    series: [{
      type: 'funnel',
      left: '10%',
      width: '80%',
      data: [
        { name: '销售额', value: summary.totalSales, itemStyle: { color: '#10b981' } },
        { name: '净销售额', value: summary.netSales, itemStyle: { color: '#2563eb' } },
        { name: '扣除成本', value: Math.max(0, summary.netSales - summary.totalCost), itemStyle: { color: '#f59e0b' } },
        { name: '扣除推广', value: Math.max(0, summary.profit), itemStyle: { color: summary.profit >= 0 ? '#8b5cf6' : '#ef4444' } },
      ],
    }],
  };

  return (
    <div className="space-y-4">
      {/* 利润总览卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="card p-4 bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/30 dark:to-emerald-800/20">
          <div className="text-xs text-emerald-700 dark:text-emerald-400">净销售额</div>
          <div className="text-xl font-bold text-emerald-700 dark:text-emerald-400 mt-1">{formatCurrency(summary.netSales)}</div>
        </div>
        <div className="card p-4 bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/30 dark:to-amber-800/20">
          <div className="text-xs text-amber-700 dark:text-amber-400">货品成本</div>
          <div className="text-xl font-bold text-amber-700 dark:text-amber-400 mt-1">{formatCurrency(summary.productCost)}</div>
          <div className="text-xs text-amber-600 mt-0.5">
            {shopCostRate > 0
              ? `净销售额×${shopCostRate}%自动计算`
              : '未设置成本率'
            }
          </div>
        </div>
        <div className="card p-4 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/30 dark:to-orange-800/20">
          <div className="text-xs text-orange-700 dark:text-orange-400">其他成本</div>
          <div className="text-xl font-bold text-orange-700 dark:text-orange-400 mt-1">{formatCurrency(summary.otherCosts)}</div>
          <div className="text-xs text-orange-600 mt-0.5">人工/红包/税务等</div>
        </div>
        <div className="card p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/20">
          <div className="text-xs text-blue-700 dark:text-blue-400">推广费</div>
          <div className="text-xl font-bold text-blue-700 dark:text-blue-400 mt-1">{formatCurrency(summary.promoTotal)}</div>
        </div>
        <div className={`card p-4 bg-gradient-to-br ${summary.profit >= 0 ? 'from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/20' : 'from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-800/20'}`}>
          <div className={`text-xs ${summary.profit >= 0 ? 'text-purple-700 dark:text-purple-400' : 'text-red-700 dark:text-red-400'}`}>利润</div>
          <div className={`text-xl font-bold mt-1 ${summary.profit >= 0 ? 'text-purple-700 dark:text-purple-400' : 'text-red-700 dark:text-red-400'}`}>{formatCurrency(summary.profit)}</div>
          <div className={`text-xs mt-0.5 ${summary.profit >= 0 ? 'text-purple-600' : 'text-red-600'}`}>利润率 {formatPercent(summary.profitRate)}</div>
        </div>
      </div>

      {/* 利润漏斗图 */}
      <div className="card p-4">
        <h3 className="font-medium mb-2">利润漏斗</h3>
        <EChart option={option} height={300} />
      </div>

      {/* 利润明细表 */}
      <div className="card p-4">
        <h3 className="font-medium mb-3">利润明细</h3>
        <div className="space-y-1">
          {/* 收入项 */}
          <div className="text-xs font-medium text-slate-500 mt-3 mb-1">收入项</div>
          {incomeItems.map((item, i) => (
            <div key={i} className={`flex justify-between items-center py-2 px-3 rounded ${item.type === 'subtotal' ? 'bg-slate-100 dark:bg-slate-700 font-medium' : ''}`}>
              <span className="text-sm">{item.label}</span>
              <span className={`text-sm font-medium ${item.value >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{item.value >= 0 ? '+' : ''}{formatCurrency(item.value)}</span>
            </div>
          ))}

          {/* 成本项 */}
          {costItems.length > 0 && (
            <>
              <div className="text-xs font-medium text-slate-500 mt-3 mb-1">成本项</div>
              {costItems.map((item, i) => (
                <div key={i} className="flex justify-between items-center py-2 px-3 rounded hover:bg-slate-50 dark:hover:bg-slate-700/50">
                  <span className="text-sm">{item.label}</span>
                  <span className="text-sm text-red-500">{formatCurrency(item.value)}</span>
                </div>
              ))}
              <div className="flex justify-between items-center py-2 px-3 rounded bg-red-50 dark:bg-red-900/20 font-medium">
                <span className="text-sm">成本合计</span>
                <span className="text-sm text-red-500">{formatCurrency(-summary.totalCost)}</span>
              </div>
            </>
          )}

          {/* 推广项 */}
          {promoItems.length > 0 && (
            <>
              <div className="text-xs font-medium text-slate-500 mt-3 mb-1">推广项</div>
              {promoItems.map((item, i) => (
                <div key={i} className="flex justify-between items-center py-2 px-3 rounded hover:bg-slate-50 dark:hover:bg-slate-700/50">
                  <span className="text-sm">{item.label}</span>
                  <span className="text-sm text-amber-600">{formatCurrency(item.value)}</span>
                </div>
              ))}
              <div className="flex justify-between items-center py-2 px-3 rounded bg-amber-50 dark:bg-amber-900/20 font-medium">
                <span className="text-sm">推广合计</span>
                <span className="text-sm text-amber-600">{formatCurrency(-summary.promoTotal)}</span>
              </div>
            </>
          )}

          {/* 利润结果 */}
          <div className={`flex justify-between items-center py-3 px-3 rounded-lg mt-3 ${summary.profit >= 0 ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
            <span className="font-semibold">利润</span>
            <span className={`font-bold text-lg ${summary.profit >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>{formatCurrency(summary.profit)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
