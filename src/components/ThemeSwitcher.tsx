import { useState, useEffect } from 'react';
import { THEMES, getCurrentTheme, setTheme, applyTheme, type Theme } from '@/lib/themes';
import { showToast } from './Toast';

interface Props {
  onClose: () => void;
}

export default function ThemeSwitcher({ onClose }: Props) {
  const [currentId, setCurrentId] = useState<string>('');

  useEffect(() => {
    const t = getCurrentTheme();
    setCurrentId(t.id);
    applyTheme(t);
  }, []);

  const handleSelect = (theme: Theme) => {
    setTheme(theme.id);
    setCurrentId(theme.id);
    showToast(`已切换到「${theme.name}」主题`, 'success');
  };

  const categories = [
    { key: 'light', label: '浅色系', icon: '☀️' },
    { key: 'medium', label: '中间色', icon: '🌗' },
    { key: 'dark', label: '深色系', icon: '🌙' },
    { key: 'art', label: '艺术主题', icon: '🎨' },
  ];

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* 头部 */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">🎨 主题设计</h2>
            <p className="text-sm text-slate-500 mt-0.5">选择你喜欢的风格，包括背景和UI设计</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500">
            ✕
          </button>
        </div>

        {/* 主题网格 */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {categories.map((cat) => {
            const themes = THEMES.filter((t) => t.category === cat.key);
            return (
              <div key={cat.key}>
                <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                  <span>{cat.icon}</span>
                  <span>{cat.label}</span>
                  <span className="text-xs text-slate-400">({themes.length})</span>
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {themes.map((theme) => {
                    const isSelected = theme.id === currentId;
                    return (
                      <button
                        key={theme.id}
                        onClick={() => handleSelect(theme)}
                        className={`relative rounded-xl overflow-hidden border-2 transition-all ${
                          isSelected
                            ? 'border-blue-500 ring-2 ring-blue-500/30 scale-[1.02]'
                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                        }`}
                        style={{ height: '120px' }}
                      >
                        {/* 主题预览 */}
                        <div
                          style={{
                            background: theme.bgImage || theme.bg,
                            width: '100%',
                            height: '100%',
                            padding: '10px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                          }}
                        >
                          {/* 顶部色块 */}
                          <div className="flex gap-1.5">
                            <div style={{ width: 12, height: 12, borderRadius: 4, background: theme.primary }} />
                            <div style={{ width: 12, height: 12, borderRadius: 4, background: theme.accent }} />
                            <div style={{ width: 12, height: 12, borderRadius: 4, background: theme.border }} />
                          </div>

                          {/* 模拟卡片 */}
                          <div
                            style={{
                              background: theme.cardBg,
                              borderRadius: theme.cardRadius,
                              padding: '6px 8px',
                              boxShadow: theme.cardShadow,
                            }}
                          >
                            <div
                              style={{
                                fontSize: 10,
                                color: theme.text,
                                fontWeight: 600,
                                lineHeight: 1.2,
                              }}
                            >
                              {theme.name}
                            </div>
                            <div
                              style={{
                                fontSize: 8,
                                color: theme.textMuted,
                                marginTop: 2,
                                lineHeight: 1.2,
                              }}
                            >
                              {theme.description}
                            </div>
                          </div>

                          {/* 底部小条 */}
                          <div
                            style={{
                              height: 4,
                              borderRadius: 2,
                              background: `linear-gradient(90deg, ${theme.primary}, ${theme.accent})`,
                            }}
                          />
                        </div>

                        {/* 选中标识 */}
                        {isSelected && (
                          <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center font-bold">
                            ✓
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* 底部 */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 text-center text-xs text-slate-500">
          共 {THEMES.length} 个精心设计的主题 · 从浅色到深色 · 含艺术画面背景
        </div>
      </div>
    </div>
  );
}
