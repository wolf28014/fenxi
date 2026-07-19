import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const quotaKeys = {
  chat: 'ai_quota_chat',
  insight: 'ai_quota_insight',
  suggestion: 'ai_quota_suggestion',
  forecast: 'ai_quota_forecast',
  report: 'ai_quota_report',
} as const;

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: 'Server is not configured' }, 500);

  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Missing authorization' }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) return json({ error: 'Unauthorized' }, 401);

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data: settings, error: settingsError } = await admin
    .from('user_settings')
    .select('plan, plan_expires_at')
    .eq('user_id', authData.user.id)
    .single();
  if (settingsError || !isActivePro(settings)) return json({ error: 'Pro subscription required' }, 403);

  const body = await request.json().catch(() => null) as { messages?: ChatMessage[]; feature?: string } | null;
  const messages = body?.messages;
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 50) {
    return json({ error: 'Invalid messages' }, 400);
  }

  const feature = body?.feature && body.feature in quotaKeys ? body.feature as keyof typeof quotaKeys : 'chat';
  const { data: config, error: configError } = await admin
    .from('app_config')
    .select('ai_base_url, ai_model, ai_api_key, ai_quota_chat, ai_quota_insight, ai_quota_suggestion, ai_quota_forecast, ai_quota_report')
    .eq('id', 1)
    .single();
  if (configError || !config?.ai_api_key || !config.ai_base_url || !config.ai_model) {
    return json({ error: 'AI provider is not configured' }, 503);
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from('ai_usage')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', authData.user.id)
    .eq('feature', feature)
    .gte('created_at', since);
  const quotaKey = quotaKeys[feature];
  const quota = Number(config[quotaKey] ?? 30);
  if ((count || 0) >= quota) return json({ error: 'AI quota exceeded' }, 429);

  const providerResponse = await fetch(`${config.ai_base_url.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.ai_api_key}` },
    body: JSON.stringify({ model: config.ai_model, messages, stream: false, temperature: 0.7 }),
  });
  const providerBody = await providerResponse.text();
  if (!providerResponse.ok) return new Response(providerBody, { status: providerResponse.status, headers: corsHeaders });

  await admin.from('ai_usage').insert({ user_id: authData.user.id, feature, tokens_used: 0 });
  return new Response(providerBody, {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});

function isActivePro(settings: { plan?: string; plan_expires_at?: string | null } | null): boolean {
  if (!settings || settings.plan === 'free') return false;
  return settings.plan === 'pro_lifetime' || Boolean(settings.plan_expires_at && new Date(settings.plan_expires_at).getTime() > Date.now());
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
