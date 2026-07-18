-- Production hardening migration. Run once after schema.sql and migration-v4.sql.

-- Promotion rows need an origin so cleanup cannot delete user data.
ALTER TABLE public.daily_promotion
  ADD COLUMN IF NOT EXISTS data_source TEXT NOT NULL DEFAULT 'manual'
  CHECK (data_source IN ('manual', 'excel', 'api', 'mock'));

-- Do not expose entitlement or provider secrets to the browser.
DROP POLICY IF EXISTS "登录用户可读配置" ON public.app_config;
REVOKE ALL ON public.app_config FROM anon, authenticated;
CREATE OR REPLACE VIEW public.app_public_config AS
  SELECT id, ai_provider, ai_base_url, ai_model,
         ai_quota_chat, ai_quota_insight, ai_quota_suggestion,
         ai_quota_forecast, ai_quota_report, updated_at
  FROM public.app_config;
GRANT SELECT ON public.app_public_config TO authenticated;

DROP POLICY IF EXISTS "用户可读未使用兑换码" ON public.license_codes;
REVOKE ALL ON public.license_codes FROM anon, authenticated;

-- Users may edit profile fields, but subscription state is server-owned.
REVOKE UPDATE (plan, plan_expires_at) ON public.user_settings FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.prevent_entitlement_tampering()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF auth.role() <> 'service_role' AND
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

-- Enforce ownership across foreign-key relationships, not only user_id.
DROP POLICY IF EXISTS "用户可管理自己产品" ON public.products;
CREATE POLICY "用户可管理自己产品" ON public.products FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "用户可管理自己数据" ON public.daily_metrics;
CREATE POLICY "用户可管理自己数据" ON public.daily_metrics FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.user_id = auth.uid()) AND
    (product_id IS NULL OR EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_id AND p.user_id = auth.uid() AND p.shop_id = shop_id
    ))
  );

DROP POLICY IF EXISTS "用户可管理自己推广" ON public.daily_promotion;
CREATE POLICY "用户可管理自己推广" ON public.daily_promotion FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.user_id = auth.uid()) AND
    (product_id IS NULL OR EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_id AND p.user_id = auth.uid() AND p.shop_id = shop_id
    ))
  );

DROP POLICY IF EXISTS "用户可管理自己成本" ON public.monthly_cost;
CREATE POLICY "用户可管理自己成本" ON public.monthly_cost FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.user_id = auth.uid()) AND
    (product_id IS NULL OR EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_id AND p.user_id = auth.uid() AND p.shop_id = shop_id
    ))
  );

-- SECURITY DEFINER functions must have a fixed search path and should not be
-- callable by anonymous users.
ALTER FUNCTION public.redeem_license_code(TEXT) SET search_path = public, auth, pg_temp;
REVOKE EXECUTE ON FUNCTION public.redeem_license_code(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.redeem_license_code(TEXT) TO authenticated;

-- Keep the old nullable unique constraints for existing product rows; the
-- client now handles shop-level NULL product_id writes by id lookup/update.
CREATE INDEX IF NOT EXISTS idx_daily_promotion_data_source
  ON public.daily_promotion(user_id, data_source);
