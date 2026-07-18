import { useEffect, useState } from 'react';
import { getCurrentUser, initAuth, signOut, subscribeAuth, isProUser } from '@/lib/auth';
import { subscribeRealtime, fetchShops } from '@/lib/db';
import { getCurrentTheme, applyTheme } from '@/lib/themes';
import type { User, Shop } from '@/types';

type Tab = 'analysis' | 'detail' | 'product' | 'shop' | 'notes' | 'ai';
import AuthScreen from '@/components/AuthScreen';
import Toast from '@/components/Toast';
import AnalysisView from '@/views/AnalysisView';
import DetailView from '@/views/DetailView';
import ProductView from '@/views/ProductView';
import ShopView from '@/views/ShopView';
import AIView from '@/views/AIView';
import NotesView from '@/views/NotesView';
import SettingsSheet from '@/components/SettingsSheet';
import ShopSwitcher from '@/components/ShopSwitcher';
import ThemeSwitcher from '@/components/ThemeSwitcher';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'analysis', label: '经营分析', icon: '📊' },
  { id: 'detail', label: '数据明细', icon: '📝' },
  { id: 'product', label: '产品中心', icon: '📦' },
  { id: 'shop', label: '店铺管理', icon: '🏪' },
  { id: 'notes', label: '运营笔记', icon: '📔' },
  { id: 'ai', label: 'AI助手', icon: '🤖' },
];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('analysis');
  const [currentShop, setCurrentShop] = useState<Shop | null>(null);
  const [shops, setShops] = useState<Shop[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showTheme, setShowTheme] = useState(false);

  // 初始化主题
  useEffect(() => {
    applyTheme(getCurrentTheme());
  }, []);

  useEffect(() => {
    initAuth().finally(() => setLoading(false));
    const unsub = subscribeAuth((u) => setUser(u));
    return unsub;
  }, []);

  // 实时同步
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeRealtime(user.id, {
      onShopChange: () => {
        // 触发顶层重新加载店铺列表
        window.dispatchEvent(new CustomEvent('realtime:shops'));
      },
      onProductChange: () => window.dispatchEvent(new CustomEvent('realtime:products')),
      onMetricChange: () => window.dispatchEvent(new CustomEvent('realtime:metrics')),
      onPromotionChange: () => window.dispatchEvent(new CustomEvent('realtime:promotions')),
      onCostChange: () => window.dispatchEvent(new CustomEvent('realtime:costs')),
    });
    return unsub;
  }, [user]);

  // 顶层加载店铺列表（解决"每次打开都提示请先添加店铺"问题）
  const loadShops = async () => {
    try {
      const data = await fetchShops();
      setShops(data);
      // 只在当前没选中店铺、或选中的店铺已被删除时才更新 currentShop
      // 避免不必要的 currentShop 引用变化导致子组件重新加载
      setCurrentShop((prev) => {
        if (prev) {
          // 检查当前选中的店铺是否还存在
          const stillExists = data.find((s) => s.id === prev.id);
          if (stillExists) {
            return prev; // 店铺仍存在，保持原引用不变（避免触发子组件重新加载）
          }
          return data[0] || null; // 店铺已删除，切换到第一个
        }
        return data[0] || null; // 没有选中店铺，选第一个
      });
    } catch (e) {
      // 静默失败
    }
  };

  useEffect(() => {
    if (!user) return;
    loadShops();
    const handler = () => loadShops();
    window.addEventListener('realtime:shops', handler);
    return () => window.removeEventListener('realtime:shops', handler);
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mb-3"></div>
          <p className="text-slate-500 text-sm">加载中...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <AuthScreen />
        <Toast />
      </>
    );
  }

  const isPro = isProUser(user);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* 顶部栏（仅 PC 显示） */}
      <header className="hidden lg:flex sticky top-0 z-30 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-3 items-center justify-between safe-top">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary-600 text-white flex items-center justify-center text-xl">📊</div>
          <div>
            <h1 className="text-base font-semibold text-slate-900 dark:text-white">电商数据分析</h1>
            <p className="text-xs text-slate-500">多店铺多产品经营分析平台</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {shops.length > 0 && <ShopSwitcher shops={shops} currentShop={currentShop} onSelect={setCurrentShop} />}
          {isPro && (
            <span className="chip bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">PRO</span>
          )}
          <div className="text-sm text-slate-600 dark:text-slate-300">
            {user.displayName} <span className="text-slate-400">·</span>{' '}
            <span className="text-slate-400">{user.email}</span>
          </div>
          <button onClick={() => setShowTheme(true)} className="btn-ghost" title="主题">
            🎨 主题
          </button>
          <button onClick={() => setShowSettings(true)} className="btn-ghost">
            ⚙ 设置
          </button>
          <button onClick={() => signOut()} className="btn-ghost">
            退出
          </button>
        </div>
      </header>

      {/* 移动端顶部 */}
      <header className="lg:hidden sticky top-0 z-30 bg-primary-600 text-white px-4 py-3 safe-top">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">📊</span>
            <span className="font-semibold">电商数据分析</span>
          </div>
          <div className="flex items-center gap-2">
            {isPro && <span className="chip bg-amber-400 text-amber-900">PRO</span>}
            <button onClick={() => setShowTheme(true)} className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center" title="主题">
              🎨
            </button>
            <button onClick={() => setShowSettings(true)} className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
              ⚙
            </button>
          </div>
        </div>
        {shops.length > 0 && (
          <div className="mt-2">
            <ShopSwitcher shops={shops} currentShop={currentShop} onSelect={setCurrentShop} />
          </div>
        )}
      </header>

      {/* 主内容区 */}
      <main className="pb-20 lg:pb-6">
        {/* PC 侧边栏布局 */}
        <div className="lg:flex">
          <aside className="hidden lg:block w-56 shrink-0 sticky top-[65px] h-[calc(100vh-65px)] border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
            <nav className="space-y-1">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                    tab === t.id
                      ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  <span className="text-lg">{t.icon}</span>
                  <span>{t.label}</span>
                </button>
              ))}
            </nav>
          </aside>

          <div className="flex-1 p-4 lg:p-6 min-w-0">
            {tab === 'analysis' && <AnalysisView currentShop={currentShop} shops={shops} setShops={setShops} />}
            {tab === 'detail' && <DetailView currentShop={currentShop} shops={shops} setShops={setShops} setCurrentShop={setCurrentShop} />}
            <div className={tab === 'product' ? '' : 'hidden'}>
              <ProductView currentShop={currentShop} shops={shops} setShops={setShops} />
            </div>
            {tab === 'shop' && <ShopView shops={shops} setShops={setShops} setCurrentShop={setCurrentShop} currentShop={currentShop} />}
            {tab === 'notes' && <NotesView currentShop={currentShop} shops={shops} />}
            {tab === 'ai' && <AIView currentShop={currentShop} shops={shops} />}
          </div>

          {/* PC 端右侧 AI 洞察面板由 AnalysisView 内部渲染（需要传入 range） */}
        </div>
      </main>

      {/* 移动端底部 Tab */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 safe-bottom">
        <div className="grid grid-cols-6">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex flex-col items-center justify-center py-2 transition ${
                tab === t.id ? 'text-primary-600' : 'text-slate-400'
              }`}
            >
              <span className="text-xl mb-0.5">{t.icon}</span>
              <span className="text-xs">{t.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {showSettings && <SettingsSheet onClose={() => setShowSettings(false)} />}
      {showTheme && <ThemeSwitcher onClose={() => setShowTheme(false)} />}
      <Toast />
    </div>
  );
}
