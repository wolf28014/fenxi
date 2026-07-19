# Critical Data Integrity Fixes

## Scope

Fix five confirmed issues without changing the user-facing data-entry workflow:

- Prorate monthly non-product costs for partial date ranges.
- Allow the license redemption RPC to update server-owned subscription fields.
- Make shop-level rows with a null product ID unique under concurrent writes.
- Keep promotion totals synchronized with daily metrics even when the metric row does not exist yet.
- Apply independent AI quotas for each supported feature.

## Monthly Cost Proration

`calculateMetrics` will accept the selected date range. For every `monthly_cost` row, each non-product cost field is multiplied by:

```text
overlapping calendar days / total calendar days in that month
```

The overlap is inclusive. The calculation must support partial months, cross-month ranges, cross-year ranges, and leap years. `productCost` is excluded because product cost is calculated from sales data and the configured cost rate.

A full-month selection retains the full monthly cost. A range with no overlap contributes zero. The UI will describe other costs as prorated for the selected range.

## Subscription Trigger

Direct browser updates to `plan` and `plan_expires_at` remain blocked through revoked column privileges and the tampering trigger.

The trigger will allow subscription changes only when the database execution role is a trusted server role, including the owner context used by the `SECURITY DEFINER` redemption function and `service_role`. The redemption function keeps an explicit `search_path`, row-locks the license code, and updates the license and subscription in one transaction.

## Null Product Uniqueness

PostgreSQL `NULLS NOT DISTINCT` unique indexes will replace nullable uniqueness assumptions for:

- `daily_metrics(shop_id, product_id, date)`
- `daily_promotion(shop_id, product_id, date)`
- `monthly_cost(shop_id, product_id, year, month)`

Before creating the indexes, the migration will consolidate duplicate shop-level rows by retaining the newest update and removing older duplicates. Summing duplicate rows would double-count concurrent writes.

After the indexes exist, client writes will use atomic upsert for product-level and shop-level records. The select-then-insert branches will be removed.

## Promotion Synchronization

A database trigger on `daily_promotion` will maintain `daily_metrics.promotion_cost`:

- Insert or update: atomically create or update the matching metric row.
- Delete: set the matching metric promotion cost to zero.
- Product-level and shop-level records use the same null-safe unique index.

The client-side synchronization code will be removed to avoid duplicate ownership. `calculateMetrics` will also fall back to promotion totals when metric promotion values are absent or all zero, preserving compatibility with older data.

## AI Feature Quotas

The Edge Function will accept only these feature values:

- `chat`
- `insight`
- `suggestion`
- `forecast`
- `report`

Each feature maps to its matching `app_config.ai_quota_*` column. Unknown values map to `chat`. Usage counting remains per user, feature, and rolling 24-hour period.

## Migration

Add `sql/migration-v9-critical-data-fixes.sql`. It will:

1. Consolidate existing null-product duplicate rows.
2. Replace current unique constraints with null-safe unique indexes.
3. Update the entitlement trigger.
4. Add the promotion synchronization trigger and backfill promotion totals.

The migration must be idempotent and safe to rerun.

## Verification

- A 10-day range includes exactly 10 days of each overlapping monthly non-product cost.
- Full months retain full cost; cross-month and leap-year ranges prorate correctly.
- An authenticated user cannot directly update subscription fields.
- A valid redemption RPC can update the subscription.
- Concurrent shop-level upserts produce one row per date or month.
- Saving promotion data before metrics creates the metric row and keeps totals synchronized.
- Deleting promotion data resets the synchronized metric promotion value.
- Every AI feature enforces its own configured quota.
- Type checking, unit tests, production build, and SQL static checks pass.
