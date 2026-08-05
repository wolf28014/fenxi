import type { DailyMetric, DailyPromotion, Shop } from '@/types';
import { upsertDailyMetric, upsertDailyPromotion } from './db';

// ============= 淘宝开放平台 API 对接 =============
// 本期采用 Mock 数据演示，预留真实对接位置
// 后期填入 AppKey/AppSecret 后即可启用真实同步

export interface TaobaoApiConfig {
  appKey: string;
  appSecret: string;
  redirectUri?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
}

const STORAGE_KEY = 'ecom_taobao_api_config';

export function getTaobaoConfig(): TaobaoApiConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setTaobaoConfig(config: TaobaoApiConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function clearTaobaoConfig() {
  localStorage.removeItem(STORAGE_KEY);
}

// ============= 同步状态 =============

export interface SyncStatus {
  shopId: string;
  lastSyncAt: string | null;
  lastSyncCount: number;
  lastSyncError: string | null;
  isMock: boolean;
}

const SYNC_STATUS_KEY = 'ecom_sync_status';

export function getSyncStatus(shopId: string): SyncStatus | null {
  try {
    const raw = localStorage.getItem(SYNC_STATUS_KEY);
    if (!raw) return null;
    const all = JSON.parse(raw);
    return all[shopId] || null;
  } catch {
    return null;
  }
}

export function setSyncStatus(shopId: string, status: Partial<SyncStatus>) {
  try {
    const raw = localStorage.getItem(SYNC_STATUS_KEY);
    const all = raw ? JSON.parse(raw) : {};
    all[shopId] = { ...all[shopId], ...status, shopId };
    localStorage.setItem(SYNC_STATUS_KEY, JSON.stringify(all));
  } catch {}
}

// ============= Mock 数据生成 =============

function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function generateMockMetrics(date: string, shop: Shop): Partial<DailyMetric> {
  const baseSales = randomBetween(500, 5000);
  const basePromo = randomBetween(50, 500);
  return {
    date,
    salesAmount: Math.round(baseSales * 100) / 100,
    orderCount: Math.round(randomBetween(10, 100)),
    refundAmount: Math.round(baseSales * randomBetween(0.02, 0.08) * 100) / 100,
    promotionCost: Math.round(basePromo * 100) / 100,
    visitorCount: Math.round(randomBetween(200, 1500)),
    dataSource: 'mock',
  };
}

function generateMockPromotion(date: string): Partial<DailyPromotion> {
  const items = {
    productSitePromo: randomBetween(50, 300),
    keywordPromo: randomBetween(30, 200),
    audiencePromo: randomBetween(20, 150),
    storeDirect: randomBetween(10, 80),
    contentMarketing: randomBetween(10, 100),
    taobaoKe: randomBetween(20, 120),
    otherPromo: randomBetween(5, 30),
  };
  // 取整
  const rounded: any = {};
  for (const k in items) {
    rounded[k] = Math.round((items as any)[k] * 100) / 100;
  }
  return { date, ...rounded, isTotalOverridden: false };
}

// ============= 同步函数 =============

export async function syncShopData(
  shop: Shop,
  options: { days?: number; onProgress?: (current: number, total: number) => void } = {},
): Promise<{ count: number; isMock: boolean }> {
  const config = getTaobaoConfig();
  const days = options.days || 7;
  const isMock = !config?.appKey || !config?.appSecret || !config?.accessToken;

  setSyncStatus(shop.id, {
    lastSyncAt: new Date().toISOString(),
    lastSyncError: null,
    isMock,
  });

  try {
    const today = new Date();
    let count = 0;

    for (let i = 0; i < days; i++) {
      const date = new Date(today.getTime() - i * 86400000).toISOString().slice(0, 10);

      // 真实 API 调用位置（预留）
      // if (!isMock) {
      //   const realData = await callTaobaoApi(config!, shop, date);
      //   await upsertDailyMetric(realData.metric);
      //   await upsertDailyPromotion(realData.promotion);
      // } else {
      //   Mock 数据
      // }

      const mockMetric = generateMockMetrics(date, shop);
      await upsertDailyMetric({ ...mockMetric, shopId: shop.id, productId: null, date } as any);

      const mockPromo = generateMockPromotion(date);
      await upsertDailyPromotion({ ...mockPromo, shopId: shop.id, productId: null, date } as any);

      count++;
      options.onProgress?.(i + 1, days);
    }

    setSyncStatus(shop.id, {
      lastSyncAt: new Date().toISOString(),
      lastSyncCount: count,
      lastSyncError: null,
    });

    return { count, isMock };
  } catch (e: any) {
    setSyncStatus(shop.id, { lastSyncError: e.message });
    throw e;
  }
}

// ============= 真实 API 调用占位 =============
// 实际对接时取消注释并实现签名计算

/*
async function callTaobaoApi(config: TaobaoApiConfig, shop: Shop, date: string) {
  const params = {
    method: 'taobao.data.analytics.daily.get',
    app_key: config.appKey,
    sign: '', // 需要按淘宝规则计算签名
    timestamp: new Date().toISOString().slice(0, 19).replace('T', ' '),
    format: 'json',
    v: '2.0',
    session: config.accessToken,
    date,
    shop_id: shop.platformAccount,
  };

  const url = 'https://eco.taobao.com/router/rest';
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params as any),
  });

  const json = await response.json();
  return parseTaobaoResponse(json);
}

function parseTaobaoResponse(json: any) {
  // 解析淘宝 API 返回的数据，转换为内部格式
  // ...
}
*/
