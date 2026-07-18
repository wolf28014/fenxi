CREATE TABLE IF NOT EXISTS public.weekly_product_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  sales_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  sold_quantity INT NOT NULL DEFAULT 0,
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
ALTER TABLE public.weekly_product_metrics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "用户可读周商品数据" ON public.weekly_product_metrics;
CREATE POLICY "用户可读周商品数据" ON public.weekly_product_metrics FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "用户可管理周商品数据" ON public.weekly_product_metrics;
CREATE POLICY "用户可管理周商品数据" ON public.weekly_product_metrics FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.shop_id = shop_id AND p.user_id = auth.uid()));

-- 将已有商品级日指标回填到周记录，销售件数暂以订单数作为保守回退值。
INSERT INTO public.weekly_product_metrics (
  user_id, shop_id, product_id, week_start, sales_amount, sold_quantity,
  order_count, refund_amount, visitor_count, promotion_cost, data_source
)
SELECT
  user_id,
  shop_id,
  product_id,
  date_trunc('week', date)::date,
  SUM(sales_amount),
  SUM(order_count),
  SUM(order_count),
  SUM(refund_amount),
  SUM(visitor_count),
  SUM(promotion_cost),
  'excel'
FROM public.daily_metrics
WHERE product_id IS NOT NULL
GROUP BY user_id, shop_id, product_id, date_trunc('week', date)::date
ON CONFLICT (shop_id, product_id, week_start) DO NOTHING;
