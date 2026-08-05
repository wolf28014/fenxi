import { useEffect, useState } from 'react';
import type { Shop, DailyMetric, MonthlyCost, MetricsSummary } from '@/types';
import { fetchDailyMetrics, fetchMonthlyCosts } from '@/lib/db';
import { calculateMetrics, formatCurrency, formatPercent, formatRatio } from '@/lib/calc';

interface Props {
  currentShop: Shop | null;
  shops: Shop[];
  range: { start: string; end: string };
  rangeLabel: string;
}

interface Insight {
  type: 'warning' | 'success' | 'info' | 'danger';
  title: string;
  detail: string;
  icon: string;
}

export default function AIInsightPanel({ currentShop, shops, range, rangeLabel }: Props) {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<MetricsSummary | null>(null);

  useEffect(() => {
    const loadInsights = async () => {
      if (shops.length === 0) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const shopId = currentShop?.id || null;
        const [m, c] = await Promise.all([
          fetchDailyMetrics(shopId, null, range.start, range.end),
          fetchMonthlyCosts(shopId, null, new Date(range.start).getFullYear(), new Date(range.start).getMonth() + 1, new Date(range.end).getFullYear(), new Date(range.end).getMonth() + 1),
        ]);
        // 获取店铺默认成本率
        const shop = currentShop || shops.find((s) => (s.defaultCostRate || 0) > 0);
        const rate = shop?.defaultCostRate || 0;
        const s = calculateMetrics(m, [], c, undefined, rate);
        setSummary(s);

        const list: Insight[] = [];

        // 异常检测
        if (s.refundRate > 10) {
          list.push({
            type: 'danger',
            title: '退款率过高',
            detail: `当前退款率 ${s.refundRate.toFixed(2)}%，超过 10% 警戒线，建议检查产品质量和描述匹配度`,
            icon: '⚠️',
          });
        }

        if (s.profit < 0) {
          list.push({
            type: 'danger',
            title: '利润为负',
            detail: `当前亏损 ${formatCurrency(Math.abs(s.profit))}，需要立即调整经营策略`,
            icon: '🚨',
          });
        }

        if (s.promoRate > 30) {
          list.push({
            type: 'warning',
            title: '推广占比过高',
            detail: `推广占比 ${s.promoRate.toFixed(2)}%，超过 30% 警戒线，可能影响利润`,
            icon: '📈',
          });
        }

        if (s.dailyROI < 2 && s.promoTotal > 0) {
          list.push({
            type: 'warning',
            title: '投产比偏低',
            detail: `当日投产比 ${s.dailyROI.toFixed(2)}，低于 2，推广效率不佳`,
            icon: '💸',
          });
        }

        // 正面洞察
        if (s.profitRate > 30) {
          list.push({
            type: 'success',
            title: '利润率优秀',
            detail: `利润率 ${s.profitRate.toFixed(2)}%，经营状况良好`,
            icon: '💎',
          });
        }

        if (s.dailyROI > 5 && s.promoTotal > 0) {
          list.push({
            type: 'success',
            title: '投产比优秀',
            detail: `当日投产比 ${s.dailyROI.toFixed(2)}，推广效率高`,
            icon: '🎯',
          });
        }

        if (s.refundRate < 3 && s.totalSales > 0) {
          list.push({
            type: 'success',
            title: '退款率良好',
            detail: `退款率仅 ${s.refundRate.toFixed(2)}%，产品质量稳定`,
            icon: '✅',
          });
        }

        // 数据摘要
        if (s.totalSales > 0) {
          list.push({
            type: 'info',
            title: '本月数据摘要',
            detail: `销售额 ${formatCurrency(s.totalSales)}，净销售 ${formatCurrency(s.netSales)}，利润 ${formatCurrency(s.profit)}`,
            icon: '📊',
          });
        }

        if (list.length === 0) {
          list.push({
            type: 'info',
            title: '暂无数据',
            detail: '请先录入经营数据，系统会自动分析',
            icon: '💡',
          });
        }

        setInsights(list);
      } catch (e) {
        // 静默失败
      } finally {
        setLoading(false);
      }
    };
    loadInsights();
  }, [currentShop, shops, range.start, range.end]);

  const colorMap = {
    danger: 'border-red-500/30 bg-red-50/50 dark:bg-red-900/10',
    warning: 'border-amber-500/30 bg-amber-50/50 dark:bg-amber-900/10',
    success: 'border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-900/10',
    info: 'border-blue-500/30 bg-blue-50/50 dark:bg-blue-900/10',
  };

  const titleColorMap = {
    danger: 'text-red-600 dark:text-red-400',
    warning: 'text-amber-600 dark:text-amber-400',
    success: 'text-emerald-600 dark:text-emerald-400',
    info: 'text-blue-600 dark:text-blue-400',
  };

  return (
    <aside className="hidden xl:block w-72 shrink-0 sticky top-[65px] h-[calc(100vh-65px)] overflow-y-auto p-3 space-y-3">
      <div className="card p-3">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-base">🧠</span>
          <h3 className="font-medium text-sm" style={{ color: 'var(--theme-text)' }}>AI 经营洞察</h3>
        </div>
        {loading ? (
          <div className="text-center py-6 text-xs text-slate-400">
            <div className="inline-block w-6 h-6 border-2 border-slate-200 border-t-primary-500 rounded-full animate-spin mb-2"></div>
            <div>分析中...</div>
          </div>
        ) : (
          <div className="space-y-2">
            {insights.map((insight, i) => (
              <div key={i} className={`p-2.5 rounded-lg border ${colorMap[insight.type]} backdrop-blur-sm`}>
                <div className={`flex items-center gap-1.5 text-xs font-medium mb-1 ${titleColorMap[insight.type]}`}>
                  <span>{insight.icon}</span>
                  <span>{insight.title}</span>
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {insight.detail}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 快速指标卡 */}
      {summary && !loading && (
        <div className="card p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-base">⚡</span>
            <h3 className="font-medium text-sm" style={{ color: 'var(--theme-text)' }}>{rangeLabel}快照</h3>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">销售额</span>
              <span className="font-medium" style={{ color: 'var(--theme-text)' }}>{formatCurrency(summary.totalSales)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">净销售</span>
              <span className="font-medium text-emerald-600">{formatCurrency(summary.netSales)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">货品成本</span>
              <span className="font-medium text-amber-600">{formatCurrency(summary.productCost)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">退款率</span>
              <span className={`font-medium ${summary.refundRate > 10 ? 'text-red-500' : ''}`}>{formatPercent(summary.refundRate)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">投产比</span>
              <span className="font-medium text-blue-600">{formatRatio(summary.dailyROI)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">利润</span>
              <span className={`font-medium ${summary.profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{formatCurrency(summary.profit)}</span>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
