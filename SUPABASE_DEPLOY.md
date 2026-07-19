# Supabase deployment

1. For a new project, run `sql/schema.sql`, then every `sql/migration-v*.sql` file in numeric order through `sql/migration-v9-critical-data-fixes.sql`. For an existing project already on v8, run only `sql/migration-v9-critical-data-fixes.sql`.
2. Deploy the Edge Function:

```bash
supabase functions deploy ai-proxy
```

Supabase hosted Edge Functions provide `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and the legacy `SUPABASE_SERVICE_ROLE_KEY` automatically. You normally do not need to create these in the Dashboard. Never put the service role key or `ai_api_key` in the frontend build.

For a custom secret, use the CLI:

```bash
supabase secrets set MY_SECRET="value"
```

3. Set the `app_config.ai_api_key` value only through the Supabase dashboard or a service-role migration. The browser must only call `ai-proxy`.
4. Configure GitHub Actions secrets `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` before enabling Pages or APK builds.

The Edge Function performs the entitlement and daily quota checks. Client-side `isProUser` remains a UI hint only and is not an authorization boundary.
