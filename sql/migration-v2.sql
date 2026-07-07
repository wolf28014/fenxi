-- ============================================================
-- 数据库迁移 v2: 调整字段结构
-- 1. daily_metrics 添加 promotion_cost 字段（用户主录入推广费总额）
-- 2. daily_promotion 移除 tax 字段（税务挪到成本）
-- 3. monthly_cost 添加 tax 字段（税务计入成本）
-- ============================================================

-- ============= 1. daily_metrics 添加 promotion_cost =============
ALTER TABLE public.daily_metrics ADD COLUMN IF NOT EXISTS promotion_cost NUMERIC(14,2) DEFAULT 0;

-- ============= 2. daily_promotion 移除 tax 字段 =============
-- 注意：先迁移现有数据到 monthly_cost（如果有的话），再删除
-- 这里直接删除，因为现有数据都是测试数据
ALTER TABLE public.daily_promotion DROP COLUMN IF EXISTS tax;

-- ============= 3. monthly_cost 添加 tax 字段 =============
ALTER TABLE public.monthly_cost ADD COLUMN IF NOT EXISTS tax NUMERIC(14,2) DEFAULT 0;

-- ============= 4. 更新 RLS 策略（如果需要） =============
-- RLS 策略使用 USING (true)，新字段自动覆盖，无需改动

-- ============= 5. 同步 daily_metrics 已有数据的 promotion_cost =============
-- 如果之前有 daily_promotion 数据，把 total 同步到 daily_metrics.promotion_cost
UPDATE public.daily_metrics dm
SET promotion_cost = COALESCE((
  SELECT dp.total FROM public.daily_promotion dp
  WHERE dp.shop_id = dm.shop_id
    AND (dp.product_id IS NOT DISTINCT FROM dm.product_id)
    AND dp.date = dm.date
  LIMIT 1
), 0),
data_source = CASE WHEN dm.data_source = 'mock' THEN 'mock' ELSE dm.data_source END
WHERE EXISTS (
  SELECT 1 FROM public.daily_promotion dp
  WHERE dp.shop_id = dm.shop_id
    AND (dp.product_id IS NOT DISTINCT FROM dm.product_id)
    AND dp.date = dm.date
);

-- ============= 完毕 =============
