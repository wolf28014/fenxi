// ============= 20 个高级主题 =============
// 每个主题包含：颜色变量 + 背景渐变 + 卡片样式

export interface Theme {
  id: string;
  name: string;
  category: 'light' | 'medium' | 'dark' | 'art';
  description: string;
  // CSS 变量值
  bg: string; // 整体背景
  cardBg: string; // 卡片背景
  text: string; // 主文字色
  textMuted: string; // 次要文字色
  border: string; // 边框色
  primary: string; // 主色调
  primaryHover: string;
  accent: string; // 强调色
  // 背景装饰
  bgImage?: string; // 背景图（渐变或图片URL）
  // UI 风格
  cardRadius: string; // 卡片圆角
  cardShadow: string; // 卡片阴影
  headerBg: string; // 顶部栏背景
  sidebarBg?: string; // 侧边栏背景
}

export const THEMES: Theme[] = [
  // ============= 浅色系 (1-6) =============
  {
    id: 'cloud-white',
    name: '云白',
    category: 'light',
    description: '纯净云白，简约舒适',
    bg: '#fafbfc',
    cardBg: '#ffffff',
    text: '#1e293b',
    textMuted: '#64748b',
    border: '#e2e8f0',
    primary: '#3b82f6',
    primaryHover: '#2563eb',
    accent: '#0ea5e9',
    bgImage: 'linear-gradient(135deg, #fafbfc 0%, #f1f5f9 100%)',
    cardRadius: '12px',
    cardShadow: '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)',
    headerBg: '#ffffff',
    sidebarBg: '#f8fafc',
  },
  {
    id: 'sakura',
    name: '樱花粉',
    category: 'light',
    description: '樱花粉嫩，温柔浪漫',
    bg: '#fdf2f8',
    cardBg: '#ffffff',
    text: '#831843',
    textMuted: '#be185d',
    border: '#fce7f3',
    primary: '#ec4899',
    primaryHover: '#db2777',
    accent: '#f472b6',
    bgImage: 'linear-gradient(135deg, #fdf2f8 0%, #fce7f3 50%, #fbcfe8 100%)',
    cardRadius: '16px',
    cardShadow: '0 4px 12px rgba(236, 72, 153, 0.08)',
    headerBg: '#ffffff',
    sidebarBg: '#fdf2f8',
  },
  {
    id: 'matcha',
    name: '抹茶绿',
    category: 'light',
    description: '抹茶清新，自然治愈',
    bg: '#f0fdf4',
    cardBg: '#ffffff',
    text: '#14532d',
    textMuted: '#15803d',
    border: '#dcfce7',
    primary: '#16a34a',
    primaryHover: '#15803d',
    accent: '#22c55e',
    bgImage: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
    cardRadius: '12px',
    cardShadow: '0 2px 8px rgba(34, 197, 94, 0.08)',
    headerBg: '#ffffff',
    sidebarBg: '#f0fdf4',
  },
  {
    id: 'lavender',
    name: '薰衣草',
    category: 'light',
    description: '薰衣草紫，优雅宁静',
    bg: '#faf5ff',
    cardBg: '#ffffff',
    text: '#581c87',
    textMuted: '#7e22ce',
    border: '#e9d5ff',
    primary: '#9333ea',
    primaryHover: '#7e22ce',
    accent: '#a855f7',
    bgImage: 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)',
    cardRadius: '14px',
    cardShadow: '0 2px 10px rgba(147, 51, 234, 0.08)',
    headerBg: '#ffffff',
    sidebarBg: '#faf5ff',
  },
  {
    id: 'ocean-breeze',
    name: '海风蓝',
    category: 'light',
    description: '海风清爽，心旷神怡',
    bg: '#f0f9ff',
    cardBg: '#ffffff',
    text: '#0c4a6e',
    textMuted: '#0369a1',
    border: '#bae6fd',
    primary: '#0284c7',
    primaryHover: '#0369a1',
    accent: '#0ea5e9',
    bgImage: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 50%, #bae6fd 100%)',
    cardRadius: '12px',
    cardShadow: '0 2px 8px rgba(14, 165, 233, 0.1)',
    headerBg: '#ffffff',
    sidebarBg: '#f0f9ff',
  },
  {
    id: 'cream',
    name: '奶油黄',
    category: 'light',
    description: '奶油温暖，舒适惬意',
    bg: '#fffbeb',
    cardBg: '#ffffff',
    text: '#78350f',
    textMuted: '#a16207',
    border: '#fde68a',
    primary: '#d97706',
    primaryHover: '#b45309',
    accent: '#f59e0b',
    bgImage: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
    cardRadius: '14px',
    cardShadow: '0 2px 8px rgba(245, 158, 11, 0.1)',
    headerBg: '#ffffff',
    sidebarBg: '#fffbeb',
  },

  // ============= 中间色调 (7-12) =============
  {
    id: 'morning-mist',
    name: '晨雾灰',
    category: 'medium',
    description: '晨雾朦胧，沉稳大气',
    bg: '#f5f5f4',
    cardBg: '#ffffff',
    text: '#1c1917',
    textMuted: '#57534e',
    border: '#d6d3d1',
    primary: '#57534e',
    primaryHover: '#44403c',
    accent: '#78716c',
    bgImage: 'linear-gradient(135deg, #f5f5f4 0%, #e7e5e4 100%)',
    cardRadius: '10px',
    cardShadow: '0 1px 3px rgba(0,0,0,0.06)',
    headerBg: '#ffffff',
    sidebarBg: '#f5f5f4',
  },
  {
    id: 'sunset-orange',
    name: '夕阳橙',
    category: 'medium',
    description: '夕阳余晖，温暖热烈',
    bg: '#fff7ed',
    cardBg: '#ffffff',
    text: '#7c2d12',
    textMuted: '#c2410c',
    border: '#fed7aa',
    primary: '#ea580c',
    primaryHover: '#c2410c',
    accent: '#fb923c',
    bgImage: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 50%, #fed7aa 100%)',
    cardRadius: '14px',
    cardShadow: '0 4px 12px rgba(234, 88, 12, 0.1)',
    headerBg: '#ffffff',
    sidebarBg: '#fff7ed',
  },
  {
    id: 'mint-frost',
    name: '薄荷霜',
    category: 'medium',
    description: '薄荷清凉，提神醒脑',
    bg: '#ecfeff',
    cardBg: '#ffffff',
    text: '#164e63',
    textMuted: '#0e7490',
    border: '#a5f3fc',
    primary: '#0891b2',
    primaryHover: '#0e7490',
    accent: '#06b6d4',
    bgImage: 'linear-gradient(135deg, #ecfeff 0%, #cffafe 100%)',
    cardRadius: '12px',
    cardShadow: '0 2px 10px rgba(6, 182, 212, 0.1)',
    headerBg: '#ffffff',
    sidebarBg: '#ecfeff',
  },
  {
    id: 'rose-gold',
    name: '玫瑰金',
    category: 'medium',
    description: '玫瑰金色，奢华典雅',
    bg: '#fff1f2',
    cardBg: '#ffffff',
    text: '#881337',
    textMuted: '#be123c',
    border: '#fecdd3',
    primary: '#e11d48',
    primaryHover: '#be123c',
    accent: '#f43f5e',
    bgImage: 'linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%)',
    cardRadius: '16px',
    cardShadow: '0 4px 16px rgba(225, 29, 72, 0.1)',
    headerBg: '#ffffff',
    sidebarBg: '#fff1f2',
  },
  {
    id: 'forest',
    name: '森林深处',
    category: 'medium',
    description: '森林墨绿，沉稳内敛',
    bg: '#f0fdf4',
    cardBg: '#ffffff',
    text: '#052e16',
    textMuted: '#166534',
    border: '#bbf7d0',
    primary: '#15803d',
    primaryHover: '#166534',
    accent: '#16a34a',
    bgImage: 'linear-gradient(135deg, #f0fdf4 0%, #bbf7d0 100%)',
    cardRadius: '10px',
    cardShadow: '0 2px 8px rgba(21, 128, 61, 0.1)',
    headerBg: '#ffffff',
    sidebarBg: '#f0fdf4',
  },
  {
    id: 'peach-blossom',
    name: '桃花',
    category: 'medium',
    description: '桃花初绽，明艳动人',
    bg: '#fff7ed',
    cardBg: '#ffffff',
    text: '#7c2d12',
    textMuted: '#ea580c',
    border: '#fed7aa',
    primary: '#f97316',
    primaryHover: '#ea580c',
    accent: '#fb923c',
    bgImage: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 50%, #fdba74 100%)',
    cardRadius: '14px',
    cardShadow: '0 3px 12px rgba(249, 115, 22, 0.12)',
    headerBg: '#ffffff',
    sidebarBg: '#fff7ed',
  },

  // ============= 深色系 (13-17) =============
  {
    id: 'midnight',
    name: '午夜蓝',
    category: 'dark',
    description: '午夜星空，深邃神秘',
    bg: '#0f172a',
    cardBg: '#1e293b',
    text: '#f1f5f9',
    textMuted: '#94a3b8',
    border: '#334155',
    primary: '#3b82f6',
    primaryHover: '#60a5fa',
    accent: '#60a5fa',
    bgImage: 'radial-gradient(ellipse at top, #1e293b 0%, #0f172a 50%, #020617 100%)',
    cardRadius: '12px',
    cardShadow: '0 4px 12px rgba(0,0,0,0.3)',
    headerBg: '#1e293b',
    sidebarBg: '#0f172a',
  },
  {
    id: 'obsidian',
    name: '黑曜石',
    category: 'dark',
    description: '黑曜石黑，极致沉稳',
    bg: '#0a0a0a',
    cardBg: '#171717',
    text: '#fafafa',
    textMuted: '#a3a3a3',
    border: '#262626',
    primary: '#e5e5e5',
    primaryHover: '#ffffff',
    accent: '#737373',
    bgImage: 'linear-gradient(135deg, #0a0a0a 0%, #171717 100%)',
    cardRadius: '10px',
    cardShadow: '0 4px 12px rgba(0,0,0,0.5)',
    headerBg: '#171717',
    sidebarBg: '#0a0a0a',
  },
  {
    id: 'deep-ocean',
    name: '深海',
    category: 'dark',
    description: '深海幽蓝，宁静致远',
    bg: '#0c1e3a',
    cardBg: '#1e3a5f',
    text: '#dbeafe',
    textMuted: '#93c5fd',
    border: '#1e40af',
    primary: '#3b82f6',
    primaryHover: '#60a5fa',
    accent: '#06b6d4',
    bgImage: 'linear-gradient(180deg, #0c1e3a 0%, #1e3a5f 50%, #0c1e3a 100%)',
    cardRadius: '14px',
    cardShadow: '0 4px 16px rgba(0,0,0,0.4)',
    headerBg: '#1e3a5f',
    sidebarBg: '#0c1e3a',
  },
  {
    id: 'dark-forest',
    name: '暗夜森林',
    category: 'dark',
    description: '暗夜森林，静谧幽深',
    bg: '#0a1f0e',
    cardBg: '#1a3a1f',
    text: '#dcfce7',
    textMuted: '#86efac',
    border: '#15803d',
    primary: '#22c55e',
    primaryHover: '#16a34a',
    accent: '#4ade80',
    bgImage: 'linear-gradient(135deg, #0a1f0e 0%, #1a3a1f 100%)',
    cardRadius: '12px',
    cardShadow: '0 4px 12px rgba(0,0,0,0.4)',
    headerBg: '#1a3a1f',
    sidebarBg: '#0a1f0e',
  },
  {
    id: 'royal-purple',
    name: '皇家紫',
    category: 'dark',
    description: '皇家深紫，尊贵华丽',
    bg: '#1a0a2e',
    cardBg: '#2d1b4e',
    text: '#f3e8ff',
    textMuted: '#c084fc',
    border: '#6b21a8',
    primary: '#a855f7',
    primaryHover: '#c084fc',
    accent: '#d946ef',
    bgImage: 'radial-gradient(ellipse at top, #2d1b4e 0%, #1a0a2e 70%, #0f0524 100%)',
    cardRadius: '16px',
    cardShadow: '0 4px 20px rgba(168, 85, 247, 0.15)',
    headerBg: '#2d1b4e',
    sidebarBg: '#1a0a2e',
  },

  // ============= 艺术主题 (18-20) =============
  {
    id: 'aurora',
    name: '极光',
    category: 'art',
    description: '极光绚烂，梦幻流动',
    bg: '#0f0e17',
    cardBg: 'rgba(30, 28, 53, 0.6)',
    text: '#fffffe',
    textMuted: '#a7a9be',
    border: 'rgba(255, 255, 255, 0.1)',
    primary: '#ff8906',
    primaryHover: '#f25f4c',
    accent: '#e53170',
    bgImage: 'linear-gradient(135deg, #0f0e17 0%, #2d2b55 25%, #6b2d8e 50%, #e53170 75%, #ff8906 100%)',
    cardRadius: '16px',
    cardShadow: '0 8px 32px rgba(229, 49, 112, 0.2)',
    headerBg: 'rgba(30, 28, 53, 0.8)',
    sidebarBg: 'rgba(15, 14, 23, 0.6)',
  },
  {
    id: 'cherry-blossom-night',
    name: '夜樱',
    category: 'art',
    description: '夜樱绽放，浪漫唯美',
    bg: '#1a0a1f',
    cardBg: 'rgba(45, 20, 50, 0.7)',
    text: '#fce7f3',
    textMuted: '#f9a8d4',
    border: 'rgba(244, 114, 182, 0.2)',
    primary: '#ec4899',
    primaryHover: '#f472b6',
    accent: '#f9a8d4',
    bgImage: 'radial-gradient(ellipse at 20% 30%, rgba(236, 72, 153, 0.3) 0%, transparent 50%), radial-gradient(ellipse at 80% 70%, rgba(244, 114, 182, 0.25) 0%, transparent 50%), linear-gradient(135deg, #1a0a1f 0%, #2d1438 100%)',
    cardRadius: '18px',
    cardShadow: '0 8px 32px rgba(236, 72, 153, 0.2)',
    headerBg: 'rgba(45, 20, 50, 0.8)',
    sidebarBg: 'rgba(26, 10, 31, 0.6)',
  },
  {
    id: 'starry-night',
    name: '星夜',
    category: 'art',
    description: '梵高星夜，艺术浓郁',
    bg: '#0a0e27',
    cardBg: 'rgba(20, 30, 60, 0.7)',
    text: '#fbbf24',
    textMuted: '#fde68a',
    border: 'rgba(251, 191, 36, 0.15)',
    primary: '#fbbf24',
    primaryHover: '#fcd34d',
    accent: '#60a5fa',
    bgImage: 'radial-gradient(2px 2px at 20% 30%, #ffffff, transparent), radial-gradient(2px 2px at 60% 70%, #fbbf24, transparent), radial-gradient(1px 1px at 50% 50%, #ffffff, transparent), radial-gradient(1px 1px at 80% 10%, #ffffff, transparent), radial-gradient(2px 2px at 90% 60%, #60a5fa, transparent), radial-gradient(1px 1px at 33% 80%, #ffffff, transparent), radial-gradient(1px 1px at 15% 65%, #fbbf24, transparent), linear-gradient(135deg, #0a0e27 0%, #1e1b4b 50%, #0a0e27 100%)',
    cardRadius: '16px',
    cardShadow: '0 8px 32px rgba(251, 191, 36, 0.15)',
    headerBg: 'rgba(20, 30, 60, 0.8)',
    sidebarBg: 'rgba(10, 14, 39, 0.6)',
  },

  // ============= 深色科技主题 (新增 3 个) =============
  {
    id: 'cyberpunk',
    name: '赛博朋克',
    category: 'dark',
    description: '霓虹赛博，未来科技',
    bg: '#0a0014',
    cardBg: 'rgba(20, 0, 40, 0.6)',
    text: '#f0abfc',
    textMuted: '#c084fc',
    border: 'rgba(217, 70, 239, 0.25)',
    primary: '#d946ef',
    primaryHover: '#e879f9',
    accent: '#06ffa5',
    bgImage: 'linear-gradient(135deg, #0a0014 0%, #1a0033 30%, #2d0052 60%, #0a0014 100%), radial-gradient(ellipse at 20% 80%, rgba(217, 70, 239, 0.15) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(6, 255, 165, 0.1) 0%, transparent 50%)',
    cardRadius: '12px',
    cardShadow: '0 4px 24px rgba(217, 70, 239, 0.2), 0 0 0 1px rgba(217, 70, 239, 0.05)',
    headerBg: 'rgba(20, 0, 40, 0.85)',
    sidebarBg: 'rgba(10, 0, 20, 0.7)',
  },
  {
    id: 'data-stream',
    name: '数据流',
    category: 'dark',
    description: '数据矩阵，流动科技',
    bg: '#001220',
    cardBg: 'rgba(0, 30, 50, 0.6)',
    text: '#67e8f9',
    textMuted: '#22d3ee',
    border: 'rgba(34, 211, 238, 0.2)',
    primary: '#06b6d4',
    primaryHover: '#22d3ee',
    accent: '#0ea5e9',
    bgImage: 'linear-gradient(180deg, #001220 0%, #002640 50%, #001220 100%), radial-gradient(ellipse at 30% 20%, rgba(6, 182, 212, 0.15) 0%, transparent 60%), radial-gradient(ellipse at 70% 80%, rgba(14, 165, 233, 0.1) 0%, transparent 50%)',
    cardRadius: '10px',
    cardShadow: '0 4px 20px rgba(6, 182, 212, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
    headerBg: 'rgba(0, 30, 50, 0.85)',
    sidebarBg: 'rgba(0, 18, 32, 0.7)',
  },
  {
    id: 'quantum',
    name: '量子',
    category: 'dark',
    description: '量子粒子，深邃神秘',
    bg: '#0d0221',
    cardBg: 'rgba(30, 10, 60, 0.55)',
    text: '#a5b4fc',
    textMuted: '#818cf8',
    border: 'rgba(129, 140, 248, 0.18)',
    primary: '#6366f1',
    primaryHover: '#818cf8',
    accent: '#a78bfa',
    bgImage: 'radial-gradient(circle at 25% 25%, rgba(99, 102, 241, 0.18) 0%, transparent 40%), radial-gradient(circle at 75% 75%, rgba(167, 139, 250, 0.15) 0%, transparent 40%), radial-gradient(circle at 50% 50%, rgba(129, 140, 248, 0.08) 0%, transparent 60%), linear-gradient(135deg, #0d0221 0%, #1e0a40 50%, #0d0221 100%)',
    cardRadius: '14px',
    cardShadow: '0 8px 32px rgba(99, 102, 241, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
    headerBg: 'rgba(30, 10, 60, 0.85)',
    sidebarBg: 'rgba(13, 2, 33, 0.7)',
  },
];

// 默认主题
export const DEFAULT_THEME_ID = 'cloud-white';

// 获取当前主题
export function getCurrentTheme(): Theme {
  try {
    const id = localStorage.getItem('ecom-theme') || DEFAULT_THEME_ID;
    return THEMES.find((t) => t.id === id) || THEMES[0];
  } catch {
    return THEMES[0];
  }
}

// 设置主题
export function setTheme(themeId: string) {
  localStorage.setItem('ecom-theme', themeId);
  applyTheme(getThemeById(themeId));
  // 通知其他组件
  window.dispatchEvent(new CustomEvent('theme-change', { detail: themeId }));
}

export function getThemeById(id: string): Theme {
  return THEMES.find((t) => t.id === id) || THEMES[0];
}

// 应用主题到 CSS 变量
export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.style.setProperty('--theme-bg', theme.bg);
  root.style.setProperty('--theme-bg-image', theme.bgImage || theme.bg);
  root.style.setProperty('--theme-card-bg', theme.cardBg);
  root.style.setProperty('--theme-text', theme.text);
  root.style.setProperty('--theme-text-muted', theme.textMuted);
  root.style.setProperty('--theme-border', theme.border);
  root.style.setProperty('--theme-primary', theme.primary);
  root.style.setProperty('--theme-primary-hover', theme.primaryHover);
  root.style.setProperty('--theme-accent', theme.accent);
  root.style.setProperty('--theme-card-radius', theme.cardRadius);
  root.style.setProperty('--theme-card-shadow', theme.cardShadow);
  root.style.setProperty('--theme-header-bg', theme.headerBg);
  root.style.setProperty('--theme-sidebar-bg', theme.sidebarBg || theme.bg);

  // body 背景应用
  document.body.style.background = theme.bgImage || theme.bg;
  document.body.style.color = theme.text;
  document.body.style.backgroundAttachment = 'fixed';
}
