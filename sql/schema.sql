-- ============================================================
-- 电商数据分析软件 - 数据库 Schema
-- 创建时间: 2026-07-03
-- 说明: 多店铺多产品经营分析平台
-- ============================================================

-- ============= 1. 用户设置表 =============
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'pro_lifetime', 'pro_monthly', 'pro_yearly')),
  plan_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============= 2. 兑换码表 =============
CREATE TABLE IF NOT EXISTS public.license_codes (
  code TEXT PRIMARY KEY,
  plan TEXT NOT NULL CHECK (plan IN ('pro_lifetime', 'pro_monthly', 'pro_yearly')),
  used_by UUID REFERENCES auth.users(id),
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============= 3. 应用配置表（存储内置 AI Key 等敏感配置） =============
CREATE TABLE IF NOT EXISTS public.app_config (
  id INT PRIMARY KEY DEFAULT 1,
  ai_provider TEXT DEFAULT 'zhipu',
  ai_base_url TEXT DEFAULT 'https://open.bigmodel.cn/api/paas/v4',
  ai_model TEXT DEFAULT 'glm-4-flash',
  ai_api_key TEXT,  -- Pro 用户使用的内置 Key
  ai_quota_chat INT DEFAULT 30,
  ai_quota_insight INT DEFAULT 20,
  ai_quota_suggestion INT DEFAULT 10,
  ai_quota_forecast INT DEFAULT 5,
  ai_quota_report INT DEFAULT 3,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT single_row CHECK (id = 1)
);

-- 插入默认配置
INSERT INTO public.app_config (id) VALUES (1) ON CONFLICT DO NOTHING;

-- ============= 4. 店铺表 =============
CREATE TABLE IF NOT EXISTS public.shops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('taobao', 'tmall', 'pdd', 'jd', 'douyin', 'other')),
  platform_account TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  sort_order INT DEFAULT 0,
  default_cost_rate NUMERIC(5,2) DEFAULT 0,  -- 默认货品成本百分比（0-100）
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shops_user_id ON public.shops(user_id);

-- ============= 5. 产品表 =============
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sku TEXT,
  category TEXT,
  image_url TEXT,
  sale_price NUMERIC(14,2),
  unit_cost NUMERIC(14,2),
  cost_mode TEXT NOT NULL DEFAULT 'fixed' CHECK (cost_mode IN ('fixed', 'percent')),
  cost_rate NUMERIC(5,2),
  target_margin NUMERIC(5,2),
  launch_date DATE,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'discontinued')),
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_user_id ON public.products(user_id);
CREATE INDEX IF NOT EXISTS idx_products_shop_id ON public.products(shop_id);

-- ============= 6. 每日核心指标表（5项） =============
CREATE TABLE IF NOT EXISTS public.daily_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  sales_amount NUMERIC(14,2) DEFAULT 0,        -- 销售额
  order_count INT DEFAULT 0,                    -- 订单量
  sold_quantity INT DEFAULT 0,
  refund_quantity INT DEFAULT 0,
  refund_amount NUMERIC(14,2) DEFAULT 0,        -- 退款金额
  promotion_cost NUMERIC(14,2) DEFAULT 0,       -- 推广费用（总额，用户主录入）
  visitor_count INT DEFAULT 0,                  -- 访客数
  data_source TEXT DEFAULT 'manual' CHECK (data_source IN ('manual', 'excel', 'api', 'mock')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(shop_id, product_id, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_metrics_user_id ON public.daily_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_metrics_shop_id ON public.daily_metrics(shop_id);
CREATE INDEX IF NOT EXISTS idx_daily_metrics_product_id ON public.daily_metrics(product_id);
CREATE INDEX IF NOT EXISTS idx_daily_metrics_date ON public.daily_metrics(date);
CREATE UNIQUE INDEX IF NOT EXISTS uq_daily_metrics_null_safe ON public.daily_metrics(shop_id, product_id, date) NULLS NOT DISTINCT;

-- ============= 周商品经营数据 =============
CREATE TABLE IF NOT EXISTS public.weekly_product_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  sales_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  sold_quantity INT NOT NULL DEFAULT 0,
  refund_quantity INT NOT NULL DEFAULT 0,
  order_count INT NOT NULL DEFAULT 0,
  refund_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  visitor_count INT NOT NULL DEFAULT 0,
  promotion_cost NUMERIC(14,2) NOT NULL DEFAULT 0,
  platform_fee NUMERIC(14,2) NOT NULL DEFAULT 0,
  shipping_cost NUMERIC(14,2) NOT NULL DEFAULT 0,
  other_cost NUMERIC(14,2) NOT NULL DEFAULT 0,
  data_source TEXT NOT NULL DEFAULT 'manual' CHECK (data_source IN ('manual', 'excel', 'api', 'mock')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(shop_id, product_id, week_start)
);
CREATE INDEX IF NOT EXISTS idx_weekly_product_metrics_lookup ON public.weekly_product_metrics(user_id, shop_id, product_id, week_start);

-- ============= 7. 每日推广明细表（8项） =============
CREATE TABLE IF NOT EXISTS public.daily_promotion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  product_site_promo NUMERIC(14,2) DEFAULT 0,   -- 货品全站推广
  keyword_promo NUMERIC(14,2) DEFAULT 0,         -- 关键词推广
  audience_promo NUMERIC(14,2) DEFAULT 0,        -- 人群推广
  store_direct NUMERIC(14,2) DEFAULT 0,          -- 店铺直达
  content_marketing NUMERIC(14,2) DEFAULT 0,     -- 内容营销
  taobao_ke NUMERIC(14,2) DEFAULT 0,             -- 淘宝客
  other_promo NUMERIC(14,2) DEFAULT 0,           -- 其它
  total NUMERIC(14,2) DEFAULT 0,                 -- 合计（会同步到 daily_metrics.promotion_cost）
  is_total_overridden BOOLEAN DEFAULT FALSE,     -- 是否手动覆盖合计
  data_source TEXT DEFAULT 'manual' CHECK (data_source IN ('manual', 'excel', 'api', 'mock')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(shop_id, product_id, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_promotion_user_id ON public.daily_promotion(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_promotion_shop_id ON public.daily_promotion(shop_id);
CREATE INDEX IF NOT EXISTS idx_daily_promotion_date ON public.daily_promotion(date);
CREATE UNIQUE INDEX IF NOT EXISTS uq_daily_promotion_null_safe ON public.daily_promotion(shop_id, product_id, date) NULLS NOT DISTINCT;

-- ============= 8. 月度成本表（13项） =============
CREATE TABLE IF NOT EXISTS public.monthly_cost (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  year INT NOT NULL,
  month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  product_cost NUMERIC(14,2) DEFAULT 0,                  -- 货品成本
  red_packet NUMERIC(14,2) DEFAULT 0,                    -- 红包
  labor NUMERIC(14,2) DEFAULT 0,                          -- 人工
  other_cost NUMERIC(14,2) DEFAULT 0,                     -- 其它
  tax NUMERIC(14,2) DEFAULT 0,                            -- 税务
  consumer_experience_fee NUMERIC(14,2) DEFAULT 0,        -- 消费者体验提升计划服务费
  bnpl_fee NUMERIC(14,2) DEFAULT 0,                       -- 先用后付技术服务费
  basic_software_fee NUMERIC(14,2) DEFAULT 0,             -- 基础软件服务费
  limited_red_packet NUMERIC(14,2) DEFAULT 0,             -- 限时红包代商家垫付扣回
  logistics_fee NUMERIC(14,2) DEFAULT 0,                  -- 商家集运物流服务费
  brand_gift_fee NUMERIC(14,2) DEFAULT 0,                 -- 品牌新享淘宝礼金软件服务费
  charity_baby NUMERIC(14,2) DEFAULT 0,                   -- 公益宝贝
  quick_payment_fee NUMERIC(14,2) DEFAULT 0,              -- 淘宝极速回款手动回款服务费
  marketing_platform NUMERIC(14,2) DEFAULT 0,             -- 营销平台
  total NUMERIC(14,2) DEFAULT 0,                          -- 合计
  is_total_overridden BOOLEAN DEFAULT FALSE,              -- 是否手动覆盖合计
  cost_source TEXT DEFAULT 'manual' CHECK (cost_source IN ('auto', 'manual')),  -- 货品成本来源
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(shop_id, product_id, year, month)
);

CREATE INDEX IF NOT EXISTS idx_monthly_cost_user_id ON public.monthly_cost(user_id);
CREATE INDEX IF NOT EXISTS idx_monthly_cost_shop_id ON public.monthly_cost(shop_id);
CREATE INDEX IF NOT EXISTS idx_monthly_cost_year_month ON public.monthly_cost(year, month);
CREATE UNIQUE INDEX IF NOT EXISTS uq_monthly_cost_null_safe ON public.monthly_cost(shop_id, product_id, year, month) NULLS NOT DISTINCT;

-- ============= 9. AI 对话历史表 =============
CREATE TABLE IF NOT EXISTS public.ai_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  context JSONB,
  tokens_used INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_chats_user_id ON public.ai_chats(user_id);

-- ============= 10. AI 使用记录表（配额管理） =============
CREATE TABLE IF NOT EXISTS public.ai_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature TEXT NOT NULL,  -- chat, insight, suggestion, forecast, report
  tokens_used INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_user_id ON public.ai_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_feature ON public.ai_usage(feature);

-- ============= 11. 应用版本表（OTA 更新检查） =============
CREATE TABLE IF NOT EXISTS public.app_versions (
  id SERIAL PRIMARY KEY,
  version TEXT NOT NULL,
  version_code INT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('web', 'android')),
  download_url TEXT,
  release_notes TEXT,
  is_force_update BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============= 触发器：自动更新 updated_at =============
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_user_settings_updated ON public.user_settings;
CREATE TRIGGER trigger_user_settings_updated BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trigger_shops_updated ON public.shops;
CREATE TRIGGER trigger_shops_updated BEFORE UPDATE ON public.shops
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trigger_products_updated ON public.products;
CREATE TRIGGER trigger_products_updated BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trigger_daily_metrics_updated ON public.daily_metrics;
CREATE TRIGGER trigger_daily_metrics_updated BEFORE UPDATE ON public.daily_metrics
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trigger_daily_promotion_updated ON public.daily_promotion;
CREATE TRIGGER trigger_daily_promotion_updated BEFORE UPDATE ON public.daily_promotion
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trigger_monthly_cost_updated ON public.monthly_cost;
CREATE TRIGGER trigger_monthly_cost_updated BEFORE UPDATE ON public.monthly_cost
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE FUNCTION public.sync_promotion_to_metrics()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.daily_metrics SET promotion_cost = 0, updated_at = NOW()
    WHERE shop_id = OLD.shop_id AND product_id IS NOT DISTINCT FROM OLD.product_id AND date = OLD.date;
    RETURN OLD;
  END IF;
  INSERT INTO public.daily_metrics (user_id, shop_id, product_id, date, promotion_cost, data_source)
  VALUES (NEW.user_id, NEW.shop_id, NEW.product_id, NEW.date, NEW.total, NEW.data_source)
  ON CONFLICT (shop_id, product_id, date) DO UPDATE SET promotion_cost = EXCLUDED.promotion_cost, updated_at = NOW();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS sync_promotion_to_metrics ON public.daily_promotion;
CREATE TRIGGER sync_promotion_to_metrics AFTER INSERT OR UPDATE OR DELETE ON public.daily_promotion
FOR EACH ROW EXECUTE FUNCTION public.sync_promotion_to_metrics();

-- ============= 触发器：注册时自动创建 user_settings =============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_settings (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.prevent_entitlement_tampering()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF current_user NOT IN ('postgres', 'service_role', 'supabase_admin') AND
     (NEW.plan IS DISTINCT FROM OLD.plan OR NEW.plan_expires_at IS DISTINCT FROM OLD.plan_expires_at) THEN
    RAISE EXCEPTION 'subscription state is server-owned';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS prevent_entitlement_tampering ON public.user_settings;
CREATE TRIGGER prevent_entitlement_tampering
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.prevent_entitlement_tampering();

-- ============= RLS 行级安全策略 =============

-- user_settings
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "用户可读自己设置" ON public.user_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "用户可更新自己设置" ON public.user_settings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "用户可插入自己设置" ON public.user_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
REVOKE UPDATE (plan, plan_expires_at) ON public.user_settings FROM anon, authenticated;

-- app_config is service-role only; the browser uses the ai-proxy Edge Function.
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_config FROM anon, authenticated;

-- shops
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "用户可读自己店铺" ON public.shops FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "用户可管理自己店铺" ON public.shops FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- products
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "用户可读自己产品" ON public.products FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "用户可管理自己产品" ON public.products FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.user_id = auth.uid()));

-- daily_metrics
ALTER TABLE public.daily_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "用户可读自己数据" ON public.daily_metrics FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "用户可管理自己数据" ON public.daily_metrics FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.user_id = auth.uid()) AND (product_id IS NULL OR EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.user_id = auth.uid() AND p.shop_id = shop_id)));

-- daily_promotion
ALTER TABLE public.daily_promotion ENABLE ROW LEVEL SECURITY;
CREATE POLICY "用户可读自己推广" ON public.daily_promotion FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "用户可管理自己推广" ON public.daily_promotion FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.user_id = auth.uid()) AND (product_id IS NULL OR EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.user_id = auth.uid() AND p.shop_id = shop_id)));

-- monthly_cost
ALTER TABLE public.monthly_cost ENABLE ROW LEVEL SECURITY;
CREATE POLICY "用户可读自己成本" ON public.monthly_cost FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "用户可管理自己成本" ON public.monthly_cost FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.user_id = auth.uid()) AND (product_id IS NULL OR EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.user_id = auth.uid() AND p.shop_id = shop_id)));

-- ai_chats
ALTER TABLE public.ai_chats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "用户可读自己AI对话" ON public.ai_chats FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "用户可管理自己AI对话" ON public.ai_chats FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ai_usage
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "用户可读自己AI用量" ON public.ai_usage FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "用户可记录自己AI用量" ON public.ai_usage FOR INSERT WITH CHECK (auth.uid() = user_id);

-- license_codes
ALTER TABLE public.license_codes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.license_codes FROM anon, authenticated;

-- ============= Realtime 实时同步 =============
ALTER PUBLICATION supabase_realtime ADD TABLE public.shops;
ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_metrics;
ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_promotion;
ALTER PUBLICATION supabase_realtime ADD TABLE public.monthly_cost;

-- ============= 兑换码 RPC 函数 =============
CREATE OR REPLACE FUNCTION public.redeem_license_code(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_license RECORD;
  v_user_id UUID := auth.uid();
  v_plan TEXT;
  v_expires TIMESTAMPTZ;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', '未登录');
  END IF;

  SELECT * INTO v_license FROM public.license_codes WHERE code = p_code FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', '兑换码不存在');
  END IF;

  IF v_license.used_by IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', '兑换码已被使用');
  END IF;

  v_plan := v_license.plan;
  v_expires := CASE v_plan
    WHEN 'pro_monthly' THEN NOW() + INTERVAL '1 month'
    WHEN 'pro_yearly' THEN NOW() + INTERVAL '1 year'
    ELSE NULL  -- pro_lifetime
  END;

  UPDATE public.license_codes SET used_by = v_user_id, used_at = NOW() WHERE code = p_code;

  UPDATE public.user_settings
  SET plan = v_plan, plan_expires_at = v_expires
  WHERE user_id = v_user_id;

  RETURN jsonb_build_object('success', true, 'plan', v_plan, 'expires_at', v_expires);
END;
$$;

ALTER FUNCTION public.redeem_license_code(TEXT) SET search_path = public, auth, pg_temp;
REVOKE EXECUTE ON FUNCTION public.redeem_license_code(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.redeem_license_code(TEXT) TO authenticated;

-- ============= 完毕 =============
