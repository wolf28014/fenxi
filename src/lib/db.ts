import { supabase } from './supabase';
import type {
  Shop,
  Product,
  DailyMetric,
  DailyPromotion,
  MonthlyCost,
} from '@/types';
import { calculatePromoTotal, calculateCostTotal } from './calc';

// ============= 店铺 CRUD =============

export async function fetchShops(): Promise<Shop[]> {
  const { data, error } = await supabase
    .from('shops')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []).map(mapShop);
}

export async function createShop(input: Omit<Shop, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<Shop> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('未登录');

  const payload = {
    user_id: user.id,
    name: input.name,
    platform: input.platform,
    platform_account: input.platformAccount || null,
    status: input.status || 'active',
    sort_order: input.sortOrder ?? 0,
    default_cost_rate: Number(input.defaultCostRate) || 0,
  };

  const { data, error } = await supabase
    .from('shops')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return mapShop(data);
}

export async function updateShop(id: string, updates: Partial<Shop>): Promise<void> {
  const payload: any = {};
  if (updates.name != null) payload.name = updates.name;
  if (updates.platform != null) payload.platform = updates.platform;
  if (updates.platformAccount != null) payload.platform_account = updates.platformAccount;
  if (updates.status != null) payload.status = updates.status;
  if (updates.sortOrder != null) payload.sort_order = updates.sortOrder;
  if (updates.defaultCostRate != null) payload.default_cost_rate = Number(updates.defaultCostRate) || 0;

  const { error } = await supabase.from('shops').update(payload).eq('id', id);
  if (error) throw error;
}

export async function deleteShop(id: string): Promise<void> {
  const { error } = await supabase.from('shops').delete().eq('id', id);
  if (error) throw error;
}

// ============= 产品 CRUD =============

export async function fetchProducts(shopId?: string): Promise<Product[]> {
  let q = supabase.from('products').select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: true });
  if (shopId) q = q.eq('shop_id', shopId);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map(mapProduct);
}

export async function createProduct(input: Omit<Product, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<Product> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('未登录');

  const payload = {
    user_id: user.id,
    shop_id: input.shopId,
    name: input.name,
    sku: input.sku || null,
    category: input.category || null,
    image_url: input.imageUrl || null,
    status: input.status || 'active',
    sort_order: input.sortOrder ?? 0,
  };

  const { data, error } = await supabase
    .from('products')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return mapProduct(data);
}

export async function updateProduct(id: string, updates: Partial<Product>): Promise<void> {
  const payload: any = {};
  if (updates.name != null) payload.name = updates.name;
  if (updates.sku != null) payload.sku = updates.sku;
  if (updates.category != null) payload.category = updates.category;
  if (updates.imageUrl != null) payload.image_url = updates.imageUrl;
  if (updates.status != null) payload.status = updates.status;
  if (updates.sortOrder != null) payload.sort_order = updates.sortOrder;

  const { error } = await supabase.from('products').update(payload).eq('id', id);
  if (error) throw error;
}

export async function deleteProduct(id: string): Promise<void> {
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) throw error;
}

// ============= 每日指标 =============

export async function fetchDailyMetrics(
  shopId: string | null, // null 表示所有店铺
  productId: string | null,
  start: string,
  end: string,
): Promise<DailyMetric[]> {
  let q = supabase.from('daily_metrics').select('*').gte('date', start).lte('date', end);
  if (shopId) q = q.eq('shop_id', shopId);
  if (productId) q = q.eq('product_id', productId);
  else q = q.is('product_id', null);
  const { data, error } = await q.order('date', { ascending: true });
  if (error) throw error;
  return (data || []).map(mapDailyMetric);
}

// 按 id 更新每日指标（编辑时用，避免 upsert onConflict 对 NULL product_id 不生效的问题）
export async function updateDailyMetricById(id: string, updates: Partial<DailyMetric>): Promise<void> {
  const payload: any = {};
  if (updates.salesAmount != null) payload.sales_amount = Number(updates.salesAmount) || 0;
  if (updates.orderCount != null) payload.order_count = Number(updates.orderCount) || 0;
  if (updates.refundAmount != null) payload.refund_amount = Number(updates.refundAmount) || 0;
  if (updates.promotionCost != null) payload.promotion_cost = Number(updates.promotionCost) || 0;
  if (updates.visitorCount != null) payload.visitor_count = Number(updates.visitorCount) || 0;
  if (updates.dataSource != null) payload.data_source = updates.dataSource;

  const { error } = await supabase.from('daily_metrics').update(payload).eq('id', id);
  if (error) throw error;
}

// 按 id 更新月度成本（编辑时用）
export async function updateMonthlyCostById(id: string, updates: Partial<MonthlyCost>): Promise<void> {
  const payload: any = {};
  if (updates.productCost != null) payload.product_cost = Number(updates.productCost) || 0;
  if (updates.redPacket != null) payload.red_packet = Number(updates.redPacket) || 0;
  if (updates.labor != null) payload.labor = Number(updates.labor) || 0;
  if (updates.otherCost != null) payload.other_cost = Number(updates.otherCost) || 0;
  if (updates.tax != null) payload.tax = Number(updates.tax) || 0;
  if (updates.consumerExperienceFee != null) payload.consumer_experience_fee = Number(updates.consumerExperienceFee) || 0;
  if (updates.bnplFee != null) payload.bnpl_fee = Number(updates.bnplFee) || 0;
  if (updates.basicSoftwareFee != null) payload.basic_software_fee = Number(updates.basicSoftwareFee) || 0;
  if (updates.limitedRedPacket != null) payload.limited_red_packet = Number(updates.limitedRedPacket) || 0;
  if (updates.logisticsFee != null) payload.logistics_fee = Number(updates.logisticsFee) || 0;
  if (updates.brandGiftFee != null) payload.brand_gift_fee = Number(updates.brandGiftFee) || 0;
  if (updates.charityBaby != null) payload.charity_baby = Number(updates.charityBaby) || 0;
  if (updates.quickPaymentFee != null) payload.quick_payment_fee = Number(updates.quickPaymentFee) || 0;
  if (updates.marketingPlatform != null) payload.marketing_platform = Number(updates.marketingPlatform) || 0;
  if (updates.isTotalOverridden != null) payload.is_total_overridden = Boolean(updates.isTotalOverridden);
  if (updates.costSource != null) payload.cost_source = updates.costSource;
  // 重新计算 total
  const total = calculateCostTotal(updates);
  payload.total = total;

  const { error } = await supabase.from('monthly_cost').update(payload).eq('id', id);
  if (error) throw error;
}

export async function upsertDailyMetric(input: Partial<DailyMetric> & { shopId: string; productId?: string | null; date: string }): Promise<DailyMetric> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('未登录');

  const payload = {
    user_id: user.id,
    shop_id: input.shopId,
    product_id: input.productId || null,
    date: input.date,
    sales_amount: Number(input.salesAmount) || 0,
    order_count: Number(input.orderCount) || 0,
    refund_amount: Number(input.refundAmount) || 0,
    promotion_cost: Number(input.promotionCost) || 0,
    visitor_count: Number(input.visitorCount) || 0,
    data_source: input.dataSource || 'manual',
  };

  const { data, error } = await supabase
    .from('daily_metrics')
    .upsert(payload, { onConflict: 'shop_id,product_id,date' })
    .select()
    .single();
  if (error) throw error;
  return mapDailyMetric(data);
}

// 批量 upsert 每日指标（一次请求写入多条，速度快 10-50 倍）
export async function upsertDailyMetrics(inputs: Array<Partial<DailyMetric> & { shopId: string; productId?: string | null; date: string }>): Promise<void> {
  if (inputs.length === 0) return;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('未登录');

  const payloads = inputs.map((input) => ({
    user_id: user.id,
    shop_id: input.shopId,
    product_id: input.productId || null,
    date: input.date,
    sales_amount: Number(input.salesAmount) || 0,
    order_count: Number(input.orderCount) || 0,
    refund_amount: Number(input.refundAmount) || 0,
    promotion_cost: Number(input.promotionCost) || 0,
    visitor_count: Number(input.visitorCount) || 0,
    data_source: input.dataSource || 'manual',
  }));

  const { error } = await supabase
    .from('daily_metrics')
    .upsert(payloads, { onConflict: 'shop_id,product_id,date' });
  if (error) throw error;
}

export async function deleteDailyMetric(id: string): Promise<void> {
  const { error } = await supabase.from('daily_metrics').delete().eq('id', id);
  if (error) throw error;
}

// 批量删除每日指标（一次请求，速度快）
export async function deleteDailyMetrics(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  // Supabase 支持 in 过滤器，一次删除多条
  const { error } = await supabase.from('daily_metrics').delete().in('id', ids);
  if (error) throw error;
}

// ============= 每日推广 =============

export async function fetchDailyPromotions(
  shopId: string | null,
  productId: string | null,
  start: string,
  end: string,
): Promise<DailyPromotion[]> {
  let q = supabase.from('daily_promotion').select('*').gte('date', start).lte('date', end);
  if (shopId) q = q.eq('shop_id', shopId);
  if (productId) q = q.eq('product_id', productId);
  else q = q.is('product_id', null);
  const { data, error } = await q.order('date', { ascending: true });
  if (error) throw error;
  return (data || []).map(mapDailyPromotion);
}

export async function upsertDailyPromotion(input: Partial<DailyPromotion> & { shopId: string; productId?: string | null; date: string }): Promise<DailyPromotion> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('未登录');

  const total = calculatePromoTotal(input);

  const payload = {
    user_id: user.id,
    shop_id: input.shopId,
    product_id: input.productId || null,
    date: input.date,
    product_site_promo: Number(input.productSitePromo) || 0,
    keyword_promo: Number(input.keywordPromo) || 0,
    audience_promo: Number(input.audiencePromo) || 0,
    store_direct: Number(input.storeDirect) || 0,
    content_marketing: Number(input.contentMarketing) || 0,
    taobao_ke: Number(input.taobaoKe) || 0,
    other_promo: Number(input.otherPromo) || 0,
    total,
    is_total_overridden: Boolean(input.isTotalOverridden),
  };

  const { data, error } = await supabase
    .from('daily_promotion')
    .upsert(payload, { onConflict: 'shop_id,product_id,date' })
    .select()
    .single();
  if (error) throw error;
  return mapDailyPromotion(data);
}

export async function deleteDailyPromotion(id: string): Promise<void> {
  const { error } = await supabase.from('daily_promotion').delete().eq('id', id);
  if (error) throw error;
}

// 批量 upsert 每日推广（一次请求写入多条）
export async function upsertDailyPromotions(inputs: Array<Partial<DailyPromotion> & { shopId: string; productId?: string | null; date: string }>): Promise<void> {
  if (inputs.length === 0) return;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('未登录');

  const payloads = inputs.map((input) => {
    const total = calculatePromoTotal(input);
    return {
      user_id: user.id,
      shop_id: input.shopId,
      product_id: input.productId || null,
      date: input.date,
      product_site_promo: Number(input.productSitePromo) || 0,
      keyword_promo: Number(input.keywordPromo) || 0,
      audience_promo: Number(input.audiencePromo) || 0,
      store_direct: Number(input.storeDirect) || 0,
      content_marketing: Number(input.contentMarketing) || 0,
      taobao_ke: Number(input.taobaoKe) || 0,
      other_promo: Number(input.otherPromo) || 0,
      total,
      is_total_overridden: Boolean(input.isTotalOverridden),
    };
  });

  const { error } = await supabase
    .from('daily_promotion')
    .upsert(payloads, { onConflict: 'shop_id,product_id,date' });
  if (error) throw error;
}

// ============= 月度成本 =============

export async function fetchMonthlyCosts(
  shopId: string | null,
  productId: string | null,
  startYear: number,
  startMonth: number,
  endYear: number,
  endMonth: number,
): Promise<MonthlyCost[]> {
  let q = supabase.from('monthly_cost').select('*');
  if (shopId) q = q.eq('shop_id', shopId);
  if (productId) q = q.eq('product_id', productId);
  else q = q.is('product_id', null);

  const { data, error } = await q;
  if (error) throw error;

  return (data || [])
    .map(mapMonthlyCost)
    .filter((c) => {
      const inStart = c.year > startYear || (c.year === startYear && c.month >= startMonth);
      const inEnd = c.year < endYear || (c.year === endYear && c.month <= endMonth);
      return inStart && inEnd;
    });
}

export async function upsertMonthlyCost(input: Partial<MonthlyCost> & { shopId: string; productId?: string | null; year: number; month: number }): Promise<MonthlyCost> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('未登录');

  const total = calculateCostTotal(input);

  const payload = {
    user_id: user.id,
    shop_id: input.shopId,
    product_id: input.productId || null,
    year: input.year,
    month: input.month,
    product_cost: Number(input.productCost) || 0,
    red_packet: Number(input.redPacket) || 0,
    labor: Number(input.labor) || 0,
    other_cost: Number(input.otherCost) || 0,
    tax: Number(input.tax) || 0,
    consumer_experience_fee: Number(input.consumerExperienceFee) || 0,
    bnpl_fee: Number(input.bnplFee) || 0,
    basic_software_fee: Number(input.basicSoftwareFee) || 0,
    limited_red_packet: Number(input.limitedRedPacket) || 0,
    logistics_fee: Number(input.logisticsFee) || 0,
    brand_gift_fee: Number(input.brandGiftFee) || 0,
    charity_baby: Number(input.charityBaby) || 0,
    quick_payment_fee: Number(input.quickPaymentFee) || 0,
    marketing_platform: Number(input.marketingPlatform) || 0,
    total,
    is_total_overridden: Boolean(input.isTotalOverridden),
    cost_source: input.costSource || 'manual',
  };

  const { data, error } = await supabase
    .from('monthly_cost')
    .upsert(payload, { onConflict: 'shop_id,product_id,year,month' })
    .select()
    .single();
  if (error) throw error;
  return mapMonthlyCost(data);
}

export async function deleteMonthlyCost(id: string): Promise<void> {
  const { error } = await supabase.from('monthly_cost').delete().eq('id', id);
  if (error) throw error;
}

// 批量 upsert 月度成本（一次请求写入多条，速度快 10-50 倍）
export async function upsertMonthlyCosts(inputs: Array<Partial<MonthlyCost> & { shopId: string; productId?: string | null; year: number; month: number }>): Promise<void> {
  if (inputs.length === 0) return;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('未登录');

  const payloads = inputs.map((input) => {
    const total = calculateCostTotal(input);
    return {
      user_id: user.id,
      shop_id: input.shopId,
      product_id: input.productId || null,
      year: input.year,
      month: input.month,
      product_cost: Number(input.productCost) || 0,
      red_packet: Number(input.redPacket) || 0,
      labor: Number(input.labor) || 0,
      other_cost: Number(input.otherCost) || 0,
      tax: Number(input.tax) || 0,
      consumer_experience_fee: Number(input.consumerExperienceFee) || 0,
      bnpl_fee: Number(input.bnplFee) || 0,
      basic_software_fee: Number(input.basicSoftwareFee) || 0,
      limited_red_packet: Number(input.limitedRedPacket) || 0,
      logistics_fee: Number(input.logisticsFee) || 0,
      brand_gift_fee: Number(input.brandGiftFee) || 0,
      charity_baby: Number(input.charityBaby) || 0,
      quick_payment_fee: Number(input.quickPaymentFee) || 0,
      marketing_platform: Number(input.marketingPlatform) || 0,
      total,
      is_total_overridden: Boolean(input.isTotalOverridden),
      cost_source: input.costSource || 'manual',
    };
  });

  const { error } = await supabase
    .from('monthly_cost')
    .upsert(payloads, { onConflict: 'shop_id,product_id,year,month' });
  if (error) throw error;
}

// 批量删除月度成本（一次请求，速度快）
export async function deleteMonthlyCosts(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase.from('monthly_cost').delete().in('id', ids);
  if (error) throw error;
}

// ============= 清空 Mock 数据 =============

export async function clearAllMockData(): Promise<{ metrics: number; promotions: number; costs: number }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('未登录');

  // 删除所有 mock 数据（daily_metrics、daily_promotion 都按 user_id 过滤）
  const [mRes, pRes] = await Promise.all([
    supabase.from('daily_metrics').delete().eq('user_id', user.id).eq('data_source', 'mock'),
    supabase.from('daily_promotion').delete().eq('user_id', user.id),
  ]);

  if (mRes.error) throw mRes.error;
  if (pRes.error) throw pRes.error;

  // 月度成本中 cost_source='auto' 的也清空（因为 Mock 同步会生成 auto 成本）
  const cRes = await supabase.from('monthly_cost').delete().eq('user_id', user.id).eq('cost_source', 'auto');

  if (cRes.error) throw cRes.error;

  return {
    metrics: mRes.count || 0,
    promotions: pRes.count || 0,
    costs: cRes.count || 0,
  };
}

// ============= 运营笔记 =============

export interface OperationNote {
  id: string;
  userId: string;
  shopId?: string | null;
  year: number;
  month: number;
  title?: string;
  content: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export async function fetchOperationNotes(year?: number, month?: number): Promise<OperationNote[]> {
  let q = supabase.from('operation_notes').select('*').order('created_at', { ascending: false });
  if (year) q = q.eq('year', year);
  if (month) q = q.eq('month', month);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map(mapOperationNote);
}

export async function fetchNotesByMonthRange(startYear: number, startMonth: number, endYear: number, endMonth: number): Promise<OperationNote[]> {
  const { data, error } = await supabase.from('operation_notes').select('*');
  if (error) throw error;
  return (data || [])
    .map(mapOperationNote)
    .filter((n) => {
      const inStart = n.year > startYear || (n.year === startYear && n.month >= startMonth);
      const inEnd = n.year < endYear || (n.year === endYear && n.month <= endMonth);
      return inStart && inEnd;
    });
}

export async function createOperationNote(input: Omit<OperationNote, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<OperationNote> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('未登录');
  const payload = {
    user_id: user.id,
    shop_id: input.shopId || null,
    year: input.year,
    month: input.month,
    title: input.title || null,
    content: input.content,
    tags: input.tags || null,
  };
  const { data, error } = await supabase
    .from('operation_notes')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return mapOperationNote(data);
}

export async function updateOperationNote(id: string, updates: Partial<OperationNote>): Promise<void> {
  const payload: any = {};
  if (updates.title != null) payload.title = updates.title;
  if (updates.content != null) payload.content = updates.content;
  if (updates.tags != null) payload.tags = updates.tags;
  if (updates.year != null) payload.year = updates.year;
  if (updates.month != null) payload.month = updates.month;
  if (updates.shopId !== undefined) payload.shop_id = updates.shopId || null;
  const { error } = await supabase.from('operation_notes').update(payload).eq('id', id);
  if (error) throw error;
}

export async function deleteOperationNote(id: string): Promise<void> {
  const { error } = await supabase.from('operation_notes').delete().eq('id', id);
  if (error) throw error;
}

function mapOperationNote(d: any): OperationNote {
  return {
    id: d.id,
    userId: d.user_id,
    shopId: d.shop_id,
    year: d.year,
    month: d.month,
    title: d.title,
    content: d.content,
    tags: d.tags,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
  };
}

// ============= 实时同步订阅 =============

export function subscribeRealtime(userId: string, handlers: {
  onShopChange?: () => void;
  onProductChange?: () => void;
  onMetricChange?: () => void;
  onPromotionChange?: () => void;
  onCostChange?: () => void;
}) {
  const channel = supabase
    .channel(`realtime-${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'shops', filter: `user_id=eq.${userId}` }, () => handlers.onShopChange?.())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'products', filter: `user_id=eq.${userId}` }, () => handlers.onProductChange?.())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_metrics', filter: `user_id=eq.${userId}` }, () => handlers.onMetricChange?.())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_promotion', filter: `user_id=eq.${userId}` }, () => handlers.onPromotionChange?.())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'monthly_cost', filter: `user_id=eq.${userId}` }, () => handlers.onCostChange?.())
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// ============= 映射函数 =============

function mapShop(d: any): Shop {
  return {
    id: d.id,
    userId: d.user_id,
    name: d.name,
    platform: d.platform,
    platformAccount: d.platform_account,
    status: d.status,
    sortOrder: d.sort_order,
    defaultCostRate: Number(d.default_cost_rate) || 0,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
  };
}

function mapProduct(d: any): Product {
  return {
    id: d.id,
    userId: d.user_id,
    shopId: d.shop_id,
    name: d.name,
    sku: d.sku,
    category: d.category,
    imageUrl: d.image_url,
    status: d.status,
    sortOrder: d.sort_order,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
  };
}

function mapDailyMetric(d: any): DailyMetric {
  return {
    id: d.id,
    userId: d.user_id,
    shopId: d.shop_id,
    productId: d.product_id,
    date: d.date,
    salesAmount: Number(d.sales_amount) || 0,
    orderCount: Number(d.order_count) || 0,
    refundAmount: Number(d.refund_amount) || 0,
    promotionCost: Number(d.promotion_cost) || 0,
    visitorCount: Number(d.visitor_count) || 0,
    dataSource: d.data_source,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
  };
}

function mapDailyPromotion(d: any): DailyPromotion {
  return {
    id: d.id,
    userId: d.user_id,
    shopId: d.shop_id,
    productId: d.product_id,
    date: d.date,
    productSitePromo: Number(d.product_site_promo) || 0,
    keywordPromo: Number(d.keyword_promo) || 0,
    audiencePromo: Number(d.audience_promo) || 0,
    storeDirect: Number(d.store_direct) || 0,
    contentMarketing: Number(d.content_marketing) || 0,
    taobaoKe: Number(d.taobao_ke) || 0,
    otherPromo: Number(d.other_promo) || 0,
    total: Number(d.total) || 0,
    isTotalOverridden: Boolean(d.is_total_overridden),
    createdAt: d.created_at,
    updatedAt: d.updated_at,
  };
}

function mapMonthlyCost(d: any): MonthlyCost {
  return {
    id: d.id,
    userId: d.user_id,
    shopId: d.shop_id,
    productId: d.product_id,
    year: d.year,
    month: d.month,
    productCost: Number(d.product_cost) || 0,
    redPacket: Number(d.red_packet) || 0,
    labor: Number(d.labor) || 0,
    otherCost: Number(d.other_cost) || 0,
    tax: Number(d.tax) || 0,
    consumerExperienceFee: Number(d.consumer_experience_fee) || 0,
    bnplFee: Number(d.bnpl_fee) || 0,
    basicSoftwareFee: Number(d.basic_software_fee) || 0,
    limitedRedPacket: Number(d.limited_red_packet) || 0,
    logisticsFee: Number(d.logistics_fee) || 0,
    brandGiftFee: Number(d.brand_gift_fee) || 0,
    charityBaby: Number(d.charity_baby) || 0,
    quickPaymentFee: Number(d.quick_payment_fee) || 0,
    marketingPlatform: Number(d.marketing_platform) || 0,
    total: Number(d.total) || 0,
    isTotalOverridden: Boolean(d.is_total_overridden),
    costSource: (d.cost_source as 'auto' | 'manual') || 'manual',
    createdAt: d.created_at,
    updatedAt: d.updated_at,
  };
}
