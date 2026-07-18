ALTER TABLE public.products ADD COLUMN IF NOT EXISTS cost_mode TEXT NOT NULL DEFAULT 'fixed' CHECK (cost_mode IN ('fixed', 'percent'));
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS cost_rate NUMERIC(5,2);
ALTER TABLE public.daily_metrics ADD COLUMN IF NOT EXISTS sold_quantity INT NOT NULL DEFAULT 0;
ALTER TABLE public.daily_metrics ADD COLUMN IF NOT EXISTS refund_quantity INT NOT NULL DEFAULT 0;
ALTER TABLE public.weekly_product_metrics ADD COLUMN IF NOT EXISTS refund_quantity INT NOT NULL DEFAULT 0;

UPDATE public.daily_metrics SET sold_quantity = order_count WHERE sold_quantity = 0;
