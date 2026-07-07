-- ============================================================
-- 数据库迁移 v3: 货品成本按百分比自动计算
-- 1. shops 表添加 default_cost_rate 字段（默认货品成本百分比）
-- 2. monthly_cost 表添加 cost_source 字段（标记成本来源：auto/manual）
-- ============================================================

-- ============= 1. shops 表添加默认成本百分比 =============
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS default_cost_rate NUMERIC(5,2) DEFAULT 0;

-- ============= 2. monthly_cost 表添加成本来源标记 =============
-- auto: 按店铺默认百分比自动算出
-- manual: 用户手动录入
ALTER TABLE public.monthly_cost ADD COLUMN IF NOT EXISTS cost_source TEXT DEFAULT 'manual' CHECK (cost_source IN ('auto', 'manual'));

-- ============= 完毕 =============
