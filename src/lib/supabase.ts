import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Supabase 配置（用户提供）
export const SUPABASE_URL = 'https://kptggyteoejqrwzwzomx.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtwdGdneXRlb2VqcXJ3end6b214Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwNTM2MjgsImV4cCI6MjA5ODYyOTYyOH0.Pqt092DGkKwfpEDIsPLXm-EKcaYdBLUnVpamxC0KFI4';

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
