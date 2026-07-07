import { supabase } from './supabase';
import type { User, PlanType } from '@/types';

let currentUser: User | null = null;
const listeners = new Set<(user: User | null) => void>();

export function getCurrentUser(): User | null {
  return currentUser;
}

export function subscribeAuth(cb: (user: User | null) => void): () => void {
  listeners.add(cb);
  cb(currentUser);
  return () => listeners.delete(cb);
}

function notify(user: User | null) {
  currentUser = user;
  listeners.forEach((cb) => cb(user));
}

export async function initAuth() {
  const { data } = await supabase.auth.getSession();
  if (data.session?.user) {
    await loadUserFromSession(data.session.user);
  }

  supabase.auth.onAuthStateChange(async (_event, session) => {
    if (session?.user) {
      await loadUserFromSession(session.user);
    } else {
      notify(null);
    }
  });
}

async function loadUserFromSession(authUser: any) {
  // 拉取用户设置
  const { data: settings } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', authUser.id)
    .single();

  const user: User = {
    id: authUser.id,
    email: authUser.email || '',
    displayName: settings?.display_name || (authUser.email?.split('@')[0] ?? '用户'),
    avatarUrl: settings?.avatar_url,
    plan: (settings?.plan as PlanType) || 'free',
    planExpiresAt: settings?.plan_expires_at,
  };
  notify(user);
}

// ============= 注册 =============
export async function signUpWithEmail(email: string, password: string, displayName?: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName || email.split('@')[0] },
    },
  });
  if (error) throw error;
  return data;
}

// ============= 登录 =============
export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

// ============= 手机号登录 =============
export async function sendOtp(phone: string) {
  // 转换为 +86 格式
  const formattedPhone = phone.startsWith('+') ? phone : `+86${phone}`;
  const { data, error } = await supabase.auth.signInWithOtp({
    phone: formattedPhone,
    options: { channel: 'sms' },
  } as any);
  if (error) throw error;
  return data;
}

export async function verifyOtp(phone: string, token: string) {
  const formattedPhone = phone.startsWith('+') ? phone : `+86${phone}`;
  const { data, error } = await supabase.auth.verifyOtp({
    phone: formattedPhone,
    token,
    type: 'sms',
  });
  if (error) throw error;
  return data;
}

// ============= 退出 =============
export async function signOut() {
  await supabase.auth.signOut();
  notify(null);
}

// ============= Pro 会员 =============
export function isProUser(user: User | null): boolean {
  if (!user) return false;
  if (user.plan === 'free') return false;
  if (user.plan === 'pro_lifetime') return true;
  if (user.planExpiresAt) {
    return new Date(user.planExpiresAt).getTime() > Date.now();
  }
  return false;
}

export async function redeemLicenseCode(code: string) {
  const { data, error } = await supabase.rpc('redeem_license_code', { p_code: code });
  if (error) throw error;
  // 刷新用户信息
  const session = await supabase.auth.getSession();
  if (session.data.session?.user) {
    await loadUserFromSession(session.data.session.user);
  }
  return data;
}

// ============= 更新用户信息 =============
export async function updateUserProfile(updates: { display_name?: string; avatar_url?: string }) {
  const user = getCurrentUser();
  if (!user) throw new Error('未登录');

  const { error } = await supabase.from('user_settings').update(updates).eq('user_id', user.id);
  if (error) throw error;

  notify({ ...user, displayName: updates.display_name ?? user.displayName, avatarUrl: updates.avatar_url ?? user.avatarUrl });
}
