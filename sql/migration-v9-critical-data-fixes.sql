-- P0-3: subscription fields remain browser-read-only while trusted database
-- execution contexts, including SECURITY DEFINER RPCs, may update them.
CREATE OR REPLACE FUNCTION public.prevent_entitlement_tampering()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user NOT IN ('postgres', 'service_role', 'supabase_admin') AND
     (NEW.plan IS DISTINCT FROM OLD.plan OR NEW.plan_expires_at IS DISTINCT FROM OLD.plan_expires_at) THEN
    RAISE EXCEPTION 'subscription state is server-owned';
  END IF;
  RETURN NEW;
END;
$$;

-- P0-4: keep the newest row from historical shop-level duplicates.
DELETE FROM public.daily_metrics older
USING public.daily_metrics newer
WHERE older.product_id IS NULL
  AND newer.product_id IS NULL
  AND older.shop_id = newer.shop_id
  AND older.date = newer.date
  AND (older.updated_at, older.id) < (newer.updated_at, newer.id);

DELETE FROM public.daily_promotion older
USING public.daily_promotion newer
WHERE older.product_id IS NULL
  AND newer.product_id IS NULL
  AND older.shop_id = newer.shop_id
  AND older.date = newer.date
  AND (older.updated_at, older.id) < (newer.updated_at, newer.id);

DELETE FROM public.monthly_cost older
USING public.monthly_cost newer
WHERE older.product_id IS NULL
  AND newer.product_id IS NULL
  AND older.shop_id = newer.shop_id
  AND older.year = newer.year
  AND older.month = newer.month
  AND (older.updated_at, older.id) < (newer.updated_at, newer.id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_daily_metrics_null_safe
  ON public.daily_metrics(shop_id, product_id, date) NULLS NOT DISTINCT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_daily_promotion_null_safe
  ON public.daily_promotion(shop_id, product_id, date) NULLS NOT DISTINCT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_monthly_cost_null_safe
  ON public.monthly_cost(shop_id, product_id, year, month) NULLS NOT DISTINCT;

-- P0-5: daily_promotion owns channel detail; daily_metrics receives its total.
CREATE OR REPLACE FUNCTION public.sync_promotion_to_metrics()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.daily_metrics
    SET promotion_cost = 0, updated_at = NOW()
    WHERE shop_id = OLD.shop_id
      AND product_id IS NOT DISTINCT FROM OLD.product_id
      AND date = OLD.date;
    RETURN OLD;
  END IF;

  INSERT INTO public.daily_metrics (
    user_id, shop_id, product_id, date, promotion_cost, data_source
  ) VALUES (
    NEW.user_id, NEW.shop_id, NEW.product_id, NEW.date, NEW.total, NEW.data_source
  )
  ON CONFLICT (shop_id, product_id, date)
  DO UPDATE SET
    promotion_cost = EXCLUDED.promotion_cost,
    updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_promotion_to_metrics ON public.daily_promotion;
CREATE TRIGGER sync_promotion_to_metrics
AFTER INSERT OR UPDATE OR DELETE ON public.daily_promotion
FOR EACH ROW EXECUTE FUNCTION public.sync_promotion_to_metrics();

-- Backfill existing promotion rows and create missing metric rows.
INSERT INTO public.daily_metrics (
  user_id, shop_id, product_id, date, promotion_cost, data_source
)
SELECT user_id, shop_id, product_id, date, total, data_source
FROM public.daily_promotion
ON CONFLICT (shop_id, product_id, date)
DO UPDATE SET promotion_cost = EXCLUDED.promotion_cost, updated_at = NOW();
