# Supabase deployment

1. Run `sql/schema.sql`, then `sql/migration-v2.sql`, `sql/migration-v3.sql`, `sql/migration-v4.sql`, and `sql/migration-v5-security.sql` in order.
2. Deploy the Edge Function:

```bash
supabase functions deploy ai-proxy
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and the service role key are provided by the Supabase runtime. Never put the service role key or `ai_api_key` in the frontend build.

3. Set the `app_config.ai_api_key` value only through the Supabase dashboard or a service-role migration. The browser must only call `ai-proxy`.
4. Configure GitHub Actions secrets `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` before enabling Pages or APK builds.

The Edge Function performs the entitlement and daily quota checks. Client-side `isProUser` remains a UI hint only and is not an authorization boundary.
