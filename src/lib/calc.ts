import type {
  DailyMetric,
  DailyPromotion,
  MonthlyCost,
  MetricsSummary,
} from '@/types';
import { PROMOTION_FIELDS, COST_FIELDS } from '@/types';

// ============= 计算推广合计 =============
export function calculatePromoTotal(p: Partial<DailyPromotion>): number {
  if (p.isTotalOverridden && p.total != null) return Number(p.total) || 0;
  return PROMOTION_FIELDS.reduce((sum, f) => sum + (Number(p[f.key as keyof DailyPromotion]) || 0), 0);
}

// ============= 计算成本合计 =============
export function calculateCostTotal(c: Partial<MonthlyCost>): number {
  if (c.isTotalOverridden && c.total != null) return Number(c.total) || 0;
  return COST_FIELDS.reduce((sum, f) => sum + (Number(c[f.key as keyof MonthlyCost]) || 0), 0);
}

export function calculateProratedOtherCosts(costs: MonthlyCost[], start?: string, end?: string): number {
  if (!start || !end) return sum(costs.map((c) => COST_FIELDS.filter((f) => f.key !== 'productCost').reduce((total, f) => total + (Number(c[f.key as keyof MonthlyCost]) || 0), 0)));
  const rangeStart = new Date(`${start}T00:00:00`);
  const rangeEnd = new Date(`${end}T00:00:00`);
  return sum(costs.map((c) => {
    const monthStart = new Date(c.year, c.month - 1, 1);
    const monthEnd = new Date(c.year, c.month, 0);
    const overlapStart = Math.max(rangeStart.getTime(), monthStart.getTime());
    const overlapEnd = Math.min(rangeEnd.getTime(), monthEnd.getTime());
    if (overlapStart > overlapEnd) return 0;
    const overlapDays = Math.round((overlapEnd - overlapStart) / 86400000) + 1;
    const monthlyOtherCost = COST_FIELDS.filter((f) => f.key !== 'productCost').reduce((total, f) => total + (Number(c[f.key as keyof MonthlyCost]) || 0), 0);
    return monthlyOtherCost * overlapDays / monthEnd.getDate();
  }));
}

// ============= 计算指标汇总 =============
// shopCostRate: 店铺默认货品成本百分比（0-100），用于实时计算货品成本
export function calculateMetrics(
  metrics: DailyMetric[],
  promotions: DailyPromotion[], // 可选，仅用于明细展示
  costs: MonthlyCost[],
  lastYearMetrics?: DailyMetric[],
  shopCostRate?: number,
  dateRange?: { start: string; end: string },
): MetricsSummary {
  const totalSales = sum(metrics.map((m) => Number(m.salesAmount) || 0));
  const totalRefund = sum(metrics.map((m) => Number(m.refundAmount) || 0));
  const netSales = totalSales - totalRefund;
  const refundRate = totalSales > 0 ? (totalRefund / totalSales) * 100 : 0;
  const totalOrders = sum(metrics.map((m) => Number(m.orderCount) || 0));
  const totalVisitors = sum(metrics.map((m) => Number(m.visitorCount) || 0));

  // 推广费：优先用 daily_metrics.promotion_cost；仅当 metrics 为空时才回退到 daily_promotion.total
  const metricPromoTotal = sum(metrics.map((m) => Number(m.promotionCost) || 0));
  const promotionDetailTotal = sum(promotions.map((p) => Number(p.total) || 0));
  const promoTotal = metricPromoTotal > 0 || promotionDetailTotal === 0
    ? metricPromoTotal
    : promotionDetailTotal;
  const promoRate = totalSales > 0 ? (promoTotal / totalSales) * 100 : 0;

  // 累积指标（与当期相同，因为这里 metrics 已经是累积范围）
  const cumNetSales = netSales;
  const cumPromoTotal = promoTotal;
  const cumPromoRate = totalSales > 0 ? (promoTotal / totalSales) * 100 : 0;
  const cumNetPromoRate = cumNetSales > 0 ? (cumPromoTotal / cumNetSales) * 100 : 0;

  const dailyROI = promoTotal > 0 ? totalSales / promoTotal : 0;
  const cumNetROI = cumPromoTotal > 0 ? cumNetSales / cumPromoTotal : 0;

  // 同比去年
  let yoyGrowth: number | null = null;
  if (lastYearMetrics && lastYearMetrics.length > 0) {
    const lastYearSales = sum(lastYearMetrics.map((m) => Number(m.salesAmount) || 0));
    if (lastYearSales > 0) {
      yoyGrowth = ((totalSales - lastYearSales) / lastYearSales) * 100;
    }
  }

  // 成本 & 利润
  // 货品成本计算逻辑（简化，避免 monthly_cost 表中错误数据干扰）：
  // 货品成本 = 净销售额 × 店铺默认成本率（始终按此公式计算，不取 monthly_cost 中的 productCost）
  // monthly_cost 表只用于其他成本（人工/红包/税务等），不参与货品成本计算
  const rate = shopCostRate || 0;

  // 货品成本 = 净销售额 × 店铺默认成本率
  const autoProductCost = rate > 0 ? netSales * (rate / 100) : 0;
  const recordedProductCost = 0; // 不再从 monthly_cost 取货品成本

  // 其他成本 = monthly_cost 表中除货品成本外的所有成本
  const otherCosts = calculateProratedOtherCosts(costs, dateRange?.start, dateRange?.end);
  const totalCost = autoProductCost + otherCosts;

  // 利润 = 净销售额 - 总成本 - 推广费
  const profit = netSales - totalCost - promoTotal;
  const profitRate = netSales > 0 ? (profit / netSales) * 100 : 0;
  // 保本投产比沿用页面毛利率口径：净销售额扣除货品成本，不扣推广费和期间费用。
  const productOnlyCost = recordedProductCost + autoProductCost;
  const prePromoProfit = netSales - productOnlyCost;
  const prePromoProfitRate = netSales > 0 ? (prePromoProfit / netSales) * 100 : 0;
  const breakEvenROI = calculateBreakEvenROI(prePromoProfitRate, refundRate);

  return {
    totalSales,
    totalRefund,
    netSales,
    refundRate,
    yoyGrowth,
    promoTotal,
    promoRate,
    cumPromoRate,
    cumNetSales,
    cumPromoTotal,
    cumNetPromoRate,
    dailyROI,
    cumNetROI,
    totalCost,
    productCost: recordedProductCost + autoProductCost,
    autoProductCost,
    recordedProductCost,
    otherCosts,
    profit,
    profitRate,
    prePromoProfitRate,
    breakEvenROI,
    totalOrders,
    totalVisitors,
  };
}

function sum(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0);
}

// ============= 计算每行的明细指标（含累积值） =============
export interface DailyMetricWithCalc {
  date: string;
  shopName?: string;
  salesAmount: number;
  orderCount: number;
  refundAmount: number;
  promotionCost: number;
  visitorCount: number;
  netSales: number;
  refundRate: number;
  promoRate: number;
  dailyROI: number;
  breakEvenROI: number | null;
  cumSales: number;
  cumRefund: number;
  cumRefundRate: number; // 累积退款率 = 累积退款 / 累积销售 * 100%
  cumNetSales: number;
  cumPromoCost: number;
  cumPromoRate: number;
  cumNetPromoRate: number;
  cumNetROI: number;
  cumROI: number; // 累积投产比 = 累积销售 / 累积推广费
}

export function calculateDailyRows(
  metrics: DailyMetric[],
  shopNameMap?: Record<string, string>,
  shopCostRate = 0,
): DailyMetricWithCalc[] {
  // 按日期排序
  const sorted = [...metrics].sort((a, b) => a.date.localeCompare(b.date));
  const result: DailyMetricWithCalc[] = [];

  let cumSales = 0;
  let cumRefund = 0;
  let cumPromoCost = 0;

  for (const m of sorted) {
    const sales = Number(m.salesAmount) || 0;
    const refund = Number(m.refundAmount) || 0;
    const promo = Number(m.promotionCost) || 0;
    const orders = Number(m.orderCount) || 0;
    const visitors = Number(m.visitorCount) || 0;

    cumSales += sales;
    cumRefund += refund;
    cumPromoCost += promo;

    const netSales = sales - refund;
    const cumNetSales = cumSales - cumRefund;
    const refundRate = sales > 0 ? (refund / sales) * 100 : 0;
    const promoRate = sales > 0 ? (promo / sales) * 100 : 0;
    const dailyROI = promo > 0 ? sales / promo : 0;
    const breakEvenROI = sales > 0 && shopCostRate > 0 && shopCostRate < 100 && refundRate < 100
      ? 1 / (1 - shopCostRate / 100) / (1 - refundRate / 100)
      : null;
    const cumRefundRate = cumSales > 0 ? (cumRefund / cumSales) * 100 : 0;
    const cumPromoRate = cumSales > 0 ? (cumPromoCost / cumSales) * 100 : 0;
    const cumNetPromoRate = cumNetSales > 0 ? (cumPromoCost / cumNetSales) * 100 : 0;
    const cumNetROI = cumPromoCost > 0 ? cumNetSales / cumPromoCost : 0;
    const cumROI = cumPromoCost > 0 ? cumSales / cumPromoCost : 0;

    result.push({
      date: m.date,
      shopName: shopNameMap?.[m.shopId],
      salesAmount: sales,
      orderCount: orders,
      refundAmount: refund,
      promotionCost: promo,
      visitorCount: visitors,
      netSales,
      refundRate,
      promoRate,
      dailyROI,
      breakEvenROI,
      cumSales,
      cumRefund,
      cumRefundRate,
      cumNetSales,
      cumPromoCost,
      cumPromoRate,
      cumNetPromoRate,
      cumNetROI,
      cumROI,
    });
  }

  return result;
}

// ============= 计算每月汇总（按月聚合） =============
export interface MonthlyMetricWithCalc {
  yearMonth: string;
  salesAmount: number;
  orderCount: number;
  refundAmount: number;
  promotionCost: number;
  visitorCount: number;
  netSales: number;
  refundRate: number;
  promoRate: number;
  monthlyROI: number;
  breakEvenROI: number | null;
  cumSales: number;
  cumRefund: number;
  cumRefundRate: number; // 累积退款率
  cumNetSales: number;
  cumPromoCost: number;
  cumPromoRate: number;
  cumNetPromoRate: number;
  cumNetROI: number;
  cumROI: number; // 累积投产比 = 累积销售 / 累积推广费
}

export function calculateMonthlyRows(metrics: DailyMetric[], shopCostRate = 0): MonthlyMetricWithCalc[] {
  // 按月份聚合
  const byMonth: Record<string, DailyMetric[]> = {};
  for (const m of metrics) {
    const ym = m.date.slice(0, 7);
    if (!byMonth[ym]) byMonth[ym] = [];
    byMonth[ym].push(m);
  }

  const months = Object.keys(byMonth).sort();
  const result: MonthlyMetricWithCalc[] = [];
  let cumSales = 0;
  let cumRefund = 0;
  let cumPromoCost = 0;

  for (const ym of months) {
    const monthMetrics = byMonth[ym];
    const sales = sum(monthMetrics.map((m) => Number(m.salesAmount) || 0));
    const refund = sum(monthMetrics.map((m) => Number(m.refundAmount) || 0));
    const promo = sum(monthMetrics.map((m) => Number(m.promotionCost) || 0));
    const orders = sum(monthMetrics.map((m) => Number(m.orderCount) || 0));
    const visitors = sum(monthMetrics.map((m) => Number(m.visitorCount) || 0));

    cumSales += sales;
    cumRefund += refund;
    cumPromoCost += promo;

    const netSales = sales - refund;
    const cumNetSales = cumSales - cumRefund;
    const refundRate = sales > 0 ? (refund / sales) * 100 : 0;
    const promoRate = sales > 0 ? (promo / sales) * 100 : 0;
    const monthlyROI = promo > 0 ? sales / promo : 0;
    const breakEvenROI = sales > 0 && shopCostRate > 0 && shopCostRate < 100 && refundRate < 100
      ? 1 / (1 - shopCostRate / 100) / (1 - refundRate / 100)
      : null;
    const cumRefundRate = cumSales > 0 ? (cumRefund / cumSales) * 100 : 0;
    const cumPromoRate = cumSales > 0 ? (cumPromoCost / cumSales) * 100 : 0;
    const cumNetPromoRate = cumNetSales > 0 ? (cumPromoCost / cumNetSales) * 100 : 0;
    const cumNetROI = cumPromoCost > 0 ? cumNetSales / cumPromoCost : 0;
    const cumROI = cumPromoCost > 0 ? cumSales / cumPromoCost : 0;

    result.push({
      yearMonth: ym,
      salesAmount: sales,
      orderCount: orders,
      refundAmount: refund,
      promotionCost: promo,
      visitorCount: visitors,
      netSales,
      refundRate,
      promoRate,
      monthlyROI,
      breakEvenROI,
      cumSales,
      cumRefund,
      cumRefundRate,
      cumNetSales,
      cumPromoCost,
      cumPromoRate,
      cumNetPromoRate,
      cumNetROI,
      cumROI,
    });
  }

  return result;
}

// ============= 日期工具 =============

// 自然年起止
export function getNaturalYearRange(date: Date = new Date()): { start: string; end: string } {
  const year = date.getFullYear();
  return {
    start: `${year}-01-01`,
    end: `${year}-12-31`,
  };
}

/** Break-even gross-sales ROAS. Inputs are percentage points. */
export function calculateBreakEvenROI(prePromoProfitRate: number, refundRate: number): number | null {
  if (prePromoProfitRate <= 0 || refundRate >= 100) return null;
  return 1 / (prePromoProfitRate / 100) / (1 - refundRate / 100);
}

/** Format a Date in the user's local business timezone, not UTC. */
export function formatLocalDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// 季节年起止（7月1日-次年6月30日）
export function getSeasonalYearRange(date: Date = new Date()): { start: string; end: string } {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  if (month >= 7) {
    return {
      start: `${year}-07-01`,
      end: `${year + 1}-06-30`,
    };
  } else {
    return {
      start: `${year - 1}-07-01`,
      end: `${year}-06-30`,
    };
  }
}

// 获取去年同期的日期范围
export function getLastYearSameRange(start: string, end: string): { start: string; end: string } {
  const s = new Date(start);
  const e = new Date(end);
  return {
    start: `${s.getFullYear() - 1}-${String(s.getMonth() + 1).padStart(2, '0')}-${String(s.getDate()).padStart(2, '0')}`,
    end: `${e.getFullYear() - 1}-${String(e.getMonth() + 1).padStart(2, '0')}-${String(e.getDate()).padStart(2, '0')}`,
  };
}

// 快捷日期范围
export function getQuickRange(type: string): { start: string; end: string } {
  const now = new Date();
  const today = formatLocalDate(now);
  const yesterdayDate = new Date(now);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = formatLocalDate(yesterdayDate);

  switch (type) {
    case 'today':
      return { start: today, end: today };
    case 'yesterday':
      return { start: yesterday, end: yesterday };
    case 'thisWeek': {
      const day = now.getDay() || 7;
      const monday = new Date(now);
      monday.setDate(now.getDate() - day + 1);
      return { start: formatLocalDate(monday), end: today };
    }
    case 'lastWeek': {
      const day = now.getDay() || 7;
      const lastMonday = new Date(now);
      lastMonday.setDate(now.getDate() - day - 6);
      const lastSunday = new Date(lastMonday);
      lastSunday.setDate(lastMonday.getDate() + 6);
      return { start: formatLocalDate(lastMonday), end: formatLocalDate(lastSunday) };
    }
    case 'thisMonth':
      return { start: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`, end: today };
    case 'lastMonth': {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      return {
        start: `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}-01`,
        end: formatLocalDate(lastMonthEnd),
      };
    }
    case 'thisNaturalYear':
      return getNaturalYearRange(now);
    case 'thisSeasonalYear':
      return getSeasonalYearRange(now);
    case 'lastNaturalYear': {
      const r = getNaturalYearRange(now);
      const y = parseInt(r.start.slice(0, 4)) - 1;
      return { start: `${y}-01-01`, end: `${y}-12-31` };
    }
    case 'lastSeasonalYear': {
      const r = getSeasonalYearRange(now);
      const y = parseInt(r.start.slice(0, 4)) - 1;
      return { start: `${y}-07-01`, end: `${y + 1}-06-30` };
    }
    case 'last30Days': {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      return { start: formatLocalDate(d), end: today };
    }
    case 'last90Days': {
      const d = new Date(now);
      d.setDate(d.getDate() - 90);
      return { start: formatLocalDate(d), end: today };
    }
    default:
      return { start: today, end: today };
  }
}

// 格式化数字
export function formatCurrency(n: number, decimals = 2): string {
  if (n === null || n === undefined || isNaN(n)) return '¥0.00';
  return '¥' + n.toLocaleString('zh-CN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function formatNumber(n: number, decimals = 0): string {
  if (n === null || n === undefined || isNaN(n)) return '0';
  return n.toLocaleString('zh-CN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function formatPercent(n: number, decimals = 2): string {
  if (n === null || n === undefined || isNaN(n)) return '0%';
  return n.toFixed(decimals) + '%';
}

export function formatRatio(n: number, decimals = 2): string {
  if (n === null || n === undefined || isNaN(n) || n === 0) return '0';
  return n.toFixed(decimals);
}

// ============= 高价值衍生指标 =============
export interface ExtendedMetrics {
  // 客单价 = 销售额 / 订单量
  avgOrderValue: number;
  // UV价值 = 销售额 / 访客数
  uvValue: number;
  // 货品成本率 = 货品成本 / 销售额
  productCostRate: number;
  // 毛利率 = (净销售额 - 货品成本) / 净销售额
  grossProfitRate: number;
  // 毛利 = 净销售额 - 货品成本
  grossProfit: number;
  // 每访客推广费 = 推广费 / 访客数
  costPerVisitor: number;
  // 每单推广费 = 推广费 / 订单量
  costPerOrder: number;
  // 推广费率 = 推广费 / 净销售额
  promoCostRate: number;
  // 日均销售额 = 销售额 / 天数
  dailyAvgSales: number;
  // 销售波动率 = 标准差 / 均值
  salesVolatility: number;
  // 月环比（需要本月和上月数据）
  monthlyGrowth: number | null;
}

export function calculateExtendedMetrics(
  metrics: DailyMetric[],
  costs: MonthlyCost[],
  lastMonthMetrics?: DailyMetric[],
  shopCostRate?: number,
): ExtendedMetrics {
  const totalSales = sum(metrics.map((m) => Number(m.salesAmount) || 0));
  const totalRefund = sum(metrics.map((m) => Number(m.refundAmount) || 0));
  const totalPromo = sum(metrics.map((m) => Number(m.promotionCost) || 0));
  const totalOrders = sum(metrics.map((m) => Number(m.orderCount) || 0));
  const totalVisitors = sum(metrics.map((m) => Number(m.visitorCount) || 0));
  const netSales = totalSales - totalRefund;

  // 货品成本 = 净销售额 × 店铺默认成本率（始终按此公式，不取 monthly_cost 中的 productCost）
  const rate = shopCostRate || 0;
  const autoProductCost = rate > 0 ? netSales * (rate / 100) : 0;
  const productCost = autoProductCost;
  const grossProfit = netSales - productCost;

  // 天数（不重复的日期数）
  const uniqueDates = new Set(metrics.map((m) => m.date));
  const days = uniqueDates.size || 1;

  // 销售额标准差
  const salesValues = metrics.map((m) => Number(m.salesAmount) || 0);
  const mean = salesValues.length > 0 ? totalSales / salesValues.length : 0;
  const variance = salesValues.length > 0
    ? salesValues.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / salesValues.length
    : 0;
  const stdDev = Math.sqrt(variance);
  const salesVolatility = mean > 0 ? (stdDev / mean) * 100 : 0;

  // 月环比
  let monthlyGrowth: number | null = null;
  if (lastMonthMetrics && lastMonthMetrics.length > 0) {
    const lastMonthSales = sum(lastMonthMetrics.map((m) => Number(m.salesAmount) || 0));
    if (lastMonthSales > 0) {
      monthlyGrowth = ((totalSales - lastMonthSales) / lastMonthSales) * 100;
    }
  }

  return {
    avgOrderValue: totalOrders > 0 ? totalSales / totalOrders : 0,
    uvValue: totalVisitors > 0 ? totalSales / totalVisitors : 0,
    productCostRate: netSales > 0 ? (productCost / netSales) * 100 : 0,
    grossProfitRate: netSales > 0 ? (grossProfit / netSales) * 100 : 0,
    grossProfit,
    costPerVisitor: totalVisitors > 0 ? totalPromo / totalVisitors : 0,
    costPerOrder: totalOrders > 0 ? totalPromo / totalOrders : 0,
    promoCostRate: netSales > 0 ? (totalPromo / netSales) * 100 : 0,
    dailyAvgSales: totalSales / days,
    salesVolatility,
    monthlyGrowth,
  };
}

// ============= 计算上月数据 =============
export function getLastMonthRange(date: Date = new Date()): { start: string; end: string } {
  const lastMonth = new Date(date.getFullYear(), date.getMonth() - 1, 1);
  const lastMonthEnd = new Date(date.getFullYear(), date.getMonth(), 0);
  return {
    start: `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}-01`,
    end: formatLocalDate(lastMonthEnd),
  };
}
