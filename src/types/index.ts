// ============= 类型定义 =============

export type Platform = 'taobao' | 'tmall' | 'pdd' | 'jd' | 'douyin' | 'other';

export type PlanType = 'free' | 'pro_lifetime' | 'pro_monthly' | 'pro_yearly';

export type DataSource = 'manual' | 'excel' | 'api' | 'mock';

export type Tab = 'analysis' | 'detail' | 'product' | 'shop' | 'ai';

export type DateRange = {
  start: string;
  end: string;
};

export type YearType = 'natural' | 'seasonal';

export interface User {
  id: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
  plan: PlanType;
  planExpiresAt?: string;
}

export interface Shop {
  id: string;
  userId: string;
  name: string;
  platform: Platform;
  platformAccount?: string;
  status: 'active' | 'inactive';
  sortOrder: number;
  defaultCostRate: number; // 默认货品成本百分比 (0-100)
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  userId: string;
  shopId: string;
  name: string;
  sku?: string;
  category?: string;
  imageUrl?: string;
  status: 'active' | 'inactive' | 'discontinued';
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface DailyMetric {
  id: string;
  userId: string;
  shopId: string;
  productId?: string | null;
  date: string;
  salesAmount: number;
  orderCount: number;
  refundAmount: number;
  promotionCost: number; // 推广费用（总额，用户主录入）
  visitorCount: number;
  dataSource: DataSource;
  createdAt: string;
  updatedAt: string;
}

export interface DailyPromotion {
  id: string;
  userId: string;
  shopId: string;
  productId?: string | null;
  date: string;
  productSitePromo: number;
  keywordPromo: number;
  audiencePromo: number;
  storeDirect: number;
  contentMarketing: number;
  taobaoKe: number;
  otherPromo: number;
  total: number;
  isTotalOverridden: boolean;
  dataSource: DataSource;
  createdAt: string;
  updatedAt: string;
}

export interface MonthlyCost {
  id: string;
  userId: string;
  shopId: string;
  productId?: string | null;
  year: number;
  month: number;
  productCost: number;
  redPacket: number;
  labor: number;
  otherCost: number;
  tax: number;
  consumerExperienceFee: number;
  bnplFee: number;
  basicSoftwareFee: number;
  limitedRedPacket: number;
  logisticsFee: number;
  brandGiftFee: number;
  charityBaby: number;
  quickPaymentFee: number;
  marketingPlatform: number;
  total: number;
  isTotalOverridden: boolean;
  costSource: 'auto' | 'manual'; // 货品成本来源：auto=按店铺百分比自动算，manual=手动录入
  createdAt: string;
  updatedAt: string;
}

// ============= 计算指标 =============

export interface MetricsSummary {
  totalSales: number;        // 累积销售额
  totalRefund: number;       // 累积退款
  netSales: number;          // 净销售额
  refundRate: number;        // 退款率
  yoyGrowth: number | null;  // 同比去年
  promoTotal: number;        // 当期推广费
  promoRate: number;         // 推广占比
  cumPromoRate: number;      // 累积推广占比
  cumNetSales: number;       // 累积净销售额
  cumPromoTotal: number;     // 累积推广费
  cumNetPromoRate: number;   // 累积净推广费率
  dailyROI: number;          // 当日投产比
  cumNetROI: number;         // 累积净投产比
  totalCost: number;         // 总成本
  productCost: number;       // 货品成本（自动算+手动录入）
  autoProductCost: number;   // 自动算出的货品成本（按净销售额×店铺百分比）
  recordedProductCost: number; // 手动录入的货品成本
  otherCosts: number;        // 其他成本（不含货品成本）
  profit: number;            // 利润
  profitRate: number;        // 利润率
  totalOrders: number;       // 累积订单量
  totalVisitors: number;     // 累积访客数
}

// ============= 平台信息 =============

export const PLATFORM_LABELS: Record<Platform, string> = {
  taobao: '淘宝',
  tmall: '天猫',
  pdd: '拼多多',
  jd: '京东',
  douyin: '抖音电商',
  other: '其他',
};

export const PLATFORM_COLORS: Record<Platform, string> = {
  taobao: '#FF6A00',
  tmall: '#FF0036',
  pdd: '#E02E24',
  jd: '#E1251B',
  douyin: '#000000',
  other: '#64748B',
};

export const PLATFORM_OPTIONS = [
  { value: 'taobao', label: '淘宝', color: '#FF6A00' },
  { value: 'tmall', label: '天猫', color: '#FF0036' },
  { value: 'pdd', label: '拼多多', color: '#E02E24' },
  { value: 'jd', label: '京东', color: '#E1251B' },
  { value: 'douyin', label: '抖音电商', color: '#000000' },
  { value: 'other', label: '其他', color: '#64748B' },
] as const;

// ============= 推广项目配置（7项，税务已挪到成本） =============

export const PROMOTION_FIELDS = [
  { key: 'productSitePromo', label: '货品全站推广' },
  { key: 'keywordPromo', label: '关键词推广' },
  { key: 'audiencePromo', label: '人群推广' },
  { key: 'storeDirect', label: '店铺直达' },
  { key: 'contentMarketing', label: '内容营销' },
  { key: 'taobaoKe', label: '淘宝客' },
  { key: 'otherPromo', label: '其它' },
] as const;

// ============= 成本项目配置（14项，含税务） =============

export const COST_FIELDS = [
  { key: 'productCost', label: '货品成本' },
  { key: 'redPacket', label: '红包' },
  { key: 'labor', label: '人工' },
  { key: 'otherCost', label: '其它' },
  { key: 'tax', label: '税务' },
  { key: 'consumerExperienceFee', label: '消费者体验提升计划服务费' },
  { key: 'bnplFee', label: '先用后付技术服务费' },
  { key: 'basicSoftwareFee', label: '基础软件服务费' },
  { key: 'limitedRedPacket', label: '限时红包代商家垫付扣回' },
  { key: 'logisticsFee', label: '商家集运物流服务费' },
  { key: 'brandGiftFee', label: '品牌新享淘宝礼金软件服务费' },
  { key: 'charityBaby', label: '公益宝贝' },
  { key: 'quickPaymentFee', label: '淘宝极速回款手动回款服务费' },
  { key: 'marketingPlatform', label: '营销平台' },
] as const;

// ============= AI 相关 =============

export interface AIChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  context?: Record<string, unknown>;
  createdAt: string;
}

export interface AIConfig {
  provider: 'zhipu' | 'openai' | 'deepseek' | 'moonshot' | 'custom' | 'proxy';
  baseUrl: string;
  model: string;
  apiKey: string;
}

export const AI_PRESETS: Record<string, { label: string; baseUrl: string; model: string }> = {
  zhipu: { label: '智谱 GLM (免费推荐)', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash' },
  openai: { label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  deepseek: { label: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  moonshot: { label: 'Moonshot (月之暗面)', baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' },
};
