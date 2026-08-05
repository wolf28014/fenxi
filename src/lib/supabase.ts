import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Supabase 配置（新项目）
export const SUPABASE_URL = 'https://owmbiqowhmzjledprgfw.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_5M16MbXa3z5Ai2WS9SAgkQ_bC5vK0ng';

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
        detectSessionInUrl: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
  }
  return client;
}

export const supabase = getSupabase();
