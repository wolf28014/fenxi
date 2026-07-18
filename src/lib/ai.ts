import { supabase, SUPABASE_ANON_KEY, SUPABASE_URL } from './supabase';
import { getCurrentUser, isProUser } from './auth';
import type { AIConfig, MetricsSummary, DailyMetric, DailyPromotion, MonthlyCost, Shop, Product } from '@/types';
import { PLATFORM_LABELS, PROMOTION_FIELDS, COST_FIELDS } from '@/types';

// ============= 获取 AI 配置 =============

const STORAGE_KEY = 'ecom_ai_config';

export function getUserAIConfig(): AIConfig | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const cfg = JSON.parse(raw);
    return cfg;
  } catch {
    return null;
  }
}

export function setUserAIConfig(cfg: AIConfig) {
  // Session storage limits persistence of user-supplied credentials. It is not
  // a security boundary; production keys should use the server-side proxy.
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
}

// Pro 用户从云端拉取配置
export async function getProAIConfig(): Promise<AIConfig | null> {
  const user = getCurrentUser();
  if (!isProUser(user)) return null;
  return {
    provider: 'proxy',
    baseUrl: `${SUPABASE_URL}/functions/v1/ai-proxy`,
    model: '',
    apiKey: '',
  };
}

// ============= AI 调用核心 =============

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function chatCompletion(
  messages: ChatMessage[],
  options: {
    config?: AIConfig;
    stream?: boolean;
    onToken?: (token: string) => void;
    signal?: AbortSignal;
  } = {},
): Promise<string> {
  const config = options.config || (await resolveConfig());
  if (!config) throw new Error('未配置 AI，请先在设置中填写 API Key');

  if (config.provider === 'proxy') {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) throw new Error('登录状态已失效，请重新登录');
    const response = await fetch(config.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ messages, stream: false }),
      signal: options.signal,
    });
    if (!response.ok) throw new Error(`AI 请求失败 (${response.status})`);
    const json = await response.json();
    const content = json.choices?.[0]?.message?.content || '';
    options.onToken?.(content);
    return content;
  }

  const url = `${config.baseUrl.replace(/\/$/, '')}/chat/completions`;

  const body: any = {
    model: config.model,
    messages,
    stream: Boolean(options.stream),
    temperature: 0.7,
  };

  const controller = new AbortController();
  const signal = options.signal || controller.signal;

  // 30 秒超时
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      let errMsg = `AI 请求失败 (${response.status})`;
      try {
        const errJson = JSON.parse(errText);
        errMsg = errJson.error?.message || errMsg;
      } catch {}
      throw new Error(errMsg);
    }

    if (options.stream && response.body) {
      // 流式响应
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let full = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const data = trimmed.slice(5).trim();
          if (data === '[DONE]') continue;
          try {
            const json = JSON.parse(data);
            const token = json.choices?.[0]?.delta?.content || '';
            if (token) {
              full += token;
              options.onToken?.(token);
            }
          } catch {}
        }
      }
      return full;
    } else {
      const json = await response.json();
      return json.choices?.[0]?.message?.content || '';
    }
  } finally {
    clearTimeout(timeout);
  }
}

async function resolveConfig(): Promise<AIConfig | null> {
  // Pro 用户用云端配置
  const pro = await getProAIConfig();
  if (pro) return pro;
  // 普通用户用本地配置
  return getUserAIConfig();
}

// ============= AI 场景：自然语言查询 =============

export async function naturalLanguageQuery(
  question: string,
  context: {
    shops: Shop[];
    products: Product[];
    currentShop?: Shop;
    metrics?: MetricsSummary;
    dailyMetrics?: DailyMetric[];
    promotions?: DailyPromotion[];
    costs?: MonthlyCost[];
  },
  onToken?: (t: string) => void,
): Promise<string> {
  const systemPrompt = `你是一位电商数据分析专家，帮助用户分析店铺经营数据。

当前用户数据上下文：
${context.currentShop ? `- 当前店铺: ${context.currentShop.name} (${PLATFORM_LABELS[context.currentShop.platform]})` : '- 无指定店铺'}

可用店铺列表:
${context.shops.map((s) => `- ${s.name} (${PLATFORM_LABELS[s.platform]})`).join('\n') || '- 暂无店铺'}

可用产品列表（最多 20 个）:
${context.products.slice(0, 20).map((p) => `- ${p.name} (SKU: ${p.sku || '无'})`).join('\n') || '- 暂无产品'}

${context.metrics ? `当前选定范围内的核心指标:
- 累积销售额: ¥${context.metrics.totalSales.toFixed(2)}
- 累积退款: ¥${context.metrics.totalRefund.toFixed(2)}
- 净销售额: ¥${context.metrics.netSales.toFixed(2)}
- 退款率: ${context.metrics.refundRate.toFixed(2)}%
- 同比去年: ${context.metrics.yoyGrowth !== null ? context.metrics.yoyGrowth.toFixed(2) + '%' : '无数据'}
- 推广费: ¥${context.metrics.promoTotal.toFixed(2)}
- 推广占比: ${context.metrics.promoRate.toFixed(2)}%
- 累积净推广费率: ${context.metrics.cumNetPromoRate.toFixed(2)}%
- 当日投产比: ${context.metrics.dailyROI.toFixed(2)}
- 累积净投产比: ${context.metrics.cumNetROI.toFixed(2)}
- 总成本: ¥${context.metrics.totalCost.toFixed(2)}
- 利润: ¥${context.metrics.profit.toFixed(2)}
- 利润率: ${context.metrics.profitRate.toFixed(2)}%
- 转化率: ${context.metrics.totalVisitors > 0 ? ((context.metrics.totalOrders / context.metrics.totalVisitors) * 100).toFixed(2) : '0'}%

衍生指标（如用户问到可基于以下公式推导）:
- 客单价 = 销售额 / 订单量 = ¥${context.metrics.totalOrders > 0 ? (context.metrics.totalSales / context.metrics.totalOrders).toFixed(2) : '0'}
- UV价值 = 销售额 / 访客数 = ¥${context.metrics.totalVisitors > 0 ? (context.metrics.totalSales / context.metrics.totalVisitors).toFixed(2) : '0'}
- 每访客推广费 = 推广费 / 访客数 = ¥${context.metrics.totalVisitors > 0 ? (context.metrics.promoTotal / context.metrics.totalVisitors).toFixed(2) : '0'}
- 每单推广费 = 推广费 / 订单量 = ¥${context.metrics.totalOrders > 0 ? (context.metrics.promoTotal / context.metrics.totalOrders).toFixed(2) : '0'}
- 推广费率 = 推广费 / 净销售额 = ${context.metrics.netSales > 0 ? ((context.metrics.promoTotal / context.metrics.netSales) * 100).toFixed(2) : '0'}%
- 日均销售额 = 销售额 / 天数
- 销售波动率 = 标准差 / 均值
- 毛利率 = (净销售额 - 货品成本) / 净销售额
- 货品成本率 = 货品成本 / 销售额
- 成本率 = 总成本 / 销售额
- 税务负担率 = 税务 / 销售额
- 人工成本率 = 人工 / 销售额
- 各项成本占比 = 各项成本 / 总成本

如用户问到上述指标，请按公式计算并解释业务含义。
` : ''}
${context.dailyMetrics && context.dailyMetrics.length > 0 ? `近期每日明细（最多 30 条）:
${context.dailyMetrics.slice(-30).map((m) => `- ${m.date}: 销售¥${m.salesAmount}, 订单${m.orderCount}, 退款¥${m.refundAmount}, 推广¥${m.promotionCost}, 访客${m.visitorCount}`).join('\n')}
` : ''}

请基于以上数据回答用户问题。回答要求：
1. 数据准确，基于上下文中的实际数字
2. 简洁明了，重点突出
3. 给出专业分析和建议
4. 如数据不足，请明确说明
5. 如用户问到衍生指标，按公式实时计算并解释业务含义`;

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: question },
  ];

  return chatCompletion(messages, { stream: true, onToken });
}

// ============= AI 场景：智能洞察 =============

export async function generateInsight(
  context: {
    metrics: MetricsSummary;
    dailyMetrics: DailyMetric[];
    promotions: DailyPromotion[];
    costs: MonthlyCost[];
    shop?: Shop;
  },
): Promise<string> {
  // 检测异常
  const anomalies: string[] = [];

  // 退款率异常
  if (context.metrics.refundRate > 10) {
    anomalies.push(`⚠️ 退款率 ${context.metrics.refundRate.toFixed(2)}% 偏高（>10%），建议检查产品质量和描述匹配度`);
  }

  // 推广占比异常
  if (context.metrics.promoRate > 30) {
    anomalies.push(`⚠️ 推广占比 ${context.metrics.promoRate.toFixed(2)}% 过高（>30%），可能影响利润`);
  }

  // 投产比异常
  if (context.metrics.dailyROI < 2 && context.metrics.promoTotal > 0) {
    anomalies.push(`⚠️ 当日投产比 ${context.metrics.dailyROI.toFixed(2)} 偏低（<2），推广效率不佳`);
  }

  // 利润为负
  if (context.metrics.profit < 0) {
    anomalies.push(`🚨 当前利润为负（¥${context.metrics.profit.toFixed(2)}），需要立即调整经营策略`);
  }

  // 日数据突变检测
  if (context.dailyMetrics.length >= 3) {
    const recent = context.dailyMetrics.slice(-3);
    const avgSales = recent.reduce((s, m) => s + m.salesAmount, 0) / recent.length;
    const last = recent[recent.length - 1];
    if (avgSales > 0 && Math.abs(last.salesAmount - avgSales) / avgSales > 0.5) {
      const direction = last.salesAmount > avgSales ? '上升' : '下降';
      anomalies.push(`📊 最近一日销售额${direction}明显（${((last.salesAmount - avgSales) / avgSales * 100).toFixed(2)}%），值得关注`);
    }
  }

  const prompt = `基于以下电商经营数据，生成简洁的经营洞察。

店铺: ${context.shop?.name || '未知'}
核心指标:
- 销售额: ¥${context.metrics.totalSales.toFixed(2)}
- 净销售额: ¥${context.metrics.netSales.toFixed(2)}
- 退款率: ${context.metrics.refundRate.toFixed(2)}%
- 推广占比: ${context.metrics.promoRate.toFixed(2)}%
- 投产比: ${context.metrics.dailyROI.toFixed(2)}
- 利润: ¥${context.metrics.profit.toFixed(2)}
- 利润率: ${context.metrics.profitRate.toFixed(2)}%

已检测到的异常:
${anomalies.length > 0 ? anomalies.join('\n') : '无明显异常'}

请生成 3-5 条经营洞察，包含：
1. 整体经营状况评估
2. 关键问题预警
3. 优化建议

格式为简洁的要点，每条不超过 50 字。`;

  return chatCompletion([{ role: 'user', content: prompt }], {});
}

// ============= AI 场景：经营建议 =============

export async function generateSuggestion(
  context: {
    metrics: MetricsSummary;
    promotions: DailyPromotion[];
    costs: MonthlyCost[];
  },
): Promise<string> {
  const promoByChannel = PROMOTION_FIELDS.map((f) => ({
    name: f.label,
    total: context.promotions.reduce((s, p) => s + (Number(p[f.key as keyof DailyPromotion]) || 0), 0),
  })).filter((x) => x.total > 0).sort((a, b) => b.total - a.total);

  const costByItem = COST_FIELDS.map((f) => ({
    name: f.label,
    total: context.costs.reduce((s, c) => s + (Number(c[f.key as keyof MonthlyCost]) || 0), 0),
  })).filter((x) => x.total > 0).sort((a, b) => b.total - a.total);

  const prompt = `作为电商经营顾问，基于以下数据给出具体优化建议。

推广费用分布（按金额降序）:
${promoByChannel.map((p) => `- ${p.name}: ¥${p.total.toFixed(2)}`).join('\n') || '- 暂无推广数据'}

成本分布（按金额降序）:
${costByItem.map((c) => `- ${c.name}: ¥${c.total.toFixed(2)}`).join('\n') || '- 暂无成本数据'}

核心指标:
- 净销售额: ¥${context.metrics.netSales.toFixed(2)}
- 推广费: ¥${context.metrics.promoTotal.toFixed(2)}
- 推广占比: ${context.metrics.promoRate.toFixed(2)}%
- 累积净投产比: ${context.metrics.cumNetROI.toFixed(2)}
- 利润: ¥${context.metrics.profit.toFixed(2)}
- 利润率: ${context.metrics.profitRate.toFixed(2)}%

请给出 3-5 条具体的优化建议，每条包含：
1. 建议内容
2. 预期效果
3. 实施难度（低/中/高）

按优先级排序，最重要的放第一条。`;

  return chatCompletion([{ role: 'user', content: prompt }], {});
}

// ============= AI 场景：销售预测 =============

export async function forecastSales(
  dailyMetrics: DailyMetric[],
  forecastDays: number = 30,
): Promise<string> {
  if (dailyMetrics.length < 7) {
    return '数据量不足，至少需要 7 天历史数据才能进行预测';
  }

  const recent = dailyMetrics.slice(-60);
  const prompt = `基于以下销售历史数据，预测未来 ${forecastDays} 天的销售趋势。

历史每日数据（最近 ${recent.length} 天）:
${recent.map((m) => `${m.date}: 销售¥${m.salesAmount}, 订单${m.orderCount}, 访客${m.visitorCount}`).join('\n')}

请分析：
1. 整体趋势（上升/下降/平稳）
2. 周期性规律（如有）
3. 预测未来 ${forecastDays} 天的总销售额范围
4. 关键影响因子
5. 库存建议

请用结构化格式输出。`;

  return chatCompletion([{ role: 'user', content: prompt }], {});
}

// ============= AI 场景：报表解读 =============

export async function generateReport(
  context: {
    shop?: Shop;
    period: string;
    metrics: MetricsSummary;
    dailyMetrics: DailyMetric[];
    promotions: DailyPromotion[];
    costs: MonthlyCost[];
  },
): Promise<string> {
  const prompt = `请生成一份电商经营分析报告，使用 Markdown 格式。

店铺: ${context.shop?.name || '未知'}
分析周期: ${context.period}

核心数据：
- 累积销售额: ¥${context.metrics.totalSales.toFixed(2)}
- 累积退款: ¥${context.metrics.totalRefund.toFixed(2)}
- 净销售额: ¥${context.metrics.netSales.toFixed(2)}
- 退款率: ${context.metrics.refundRate.toFixed(2)}%
- 同比去年: ${context.metrics.yoyGrowth !== null ? context.metrics.yoyGrowth.toFixed(2) + '%' : '无数据'}
- 推广费: ¥${context.metrics.promoTotal.toFixed(2)}
- 推广占比: ${context.metrics.promoRate.toFixed(2)}%
- 累积净投产比: ${context.metrics.cumNetROI.toFixed(2)}
- 总成本: ¥${context.metrics.totalCost.toFixed(2)}
- 利润: ¥${context.metrics.profit.toFixed(2)}
- 利润率: ${context.metrics.profitRate.toFixed(2)}%
- 总订单量: ${context.metrics.totalOrders}
- 总访客数: ${context.metrics.totalVisitors}
- 转化率: ${context.metrics.totalVisitors > 0 ? (context.metrics.totalOrders / context.metrics.totalVisitors * 100).toFixed(2) : '0'}%

请生成包含以下章节的报告：
1. 经营概述
2. 销售分析
3. 退款分析
4. 推广效果分析
5. 成本与利润分析
6. 改进建议

报告语言为中文，专业但易懂。`;

  return chatCompletion([{ role: 'user', content: prompt }], {});
}
