-- Product Center经营分析主数据
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sale_price NUMERIC(14,2);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(14,2);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS target_margin NUMERIC(5,2);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS launch_date DATE;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_products_shop_status ON public.products(shop_id, status);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
