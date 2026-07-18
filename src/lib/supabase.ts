import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// The anon key is safe to ship to a browser, but the project should be selected
// at build time so forks and deployments do not silently share one backend.
const LEGACY_SUPABASE_URL = 'https://kptggyteoejqrwzwzomx.supabase.co';
const LEGACY_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtwdGdneXRlb2VqcXJ3end6b214Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwNTM2MjgsImV4cCI6MjA5ODYyOTYyOH0.Pqt092DGkKwfpEDIsPLXm-EKcaYdBLUnVpamxC0KFI4';
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || LEGACY_SUPABASE_URL;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || LEGACY_SUPABASE_ANON_KEY;

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
