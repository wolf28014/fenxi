import { useState } from 'react';
import Modal from './Modal';
import { showToast } from './Toast';
import { getUserAIConfig, setUserAIConfig } from '@/lib/ai';
import { getTaobaoConfig, setTaobaoConfig, clearTaobaoConfig } from '@/lib/taobao-api';
import { redeemLicenseCode, signOut, getCurrentUser } from '@/lib/auth';
import { AI_PRESETS, type AIConfig } from '@/types';

interface Props {
  onClose: () => void;
}

type Section = 'general' | 'ai' | 'api' | 'pro' | 'about';

export default function SettingsSheet({ onClose }: Props) {
  const [section, setSection] = useState<Section>('general');

  // AI 配置
  const existing = getUserAIConfig();
  const [aiProvider, setAiProvider] = useState(existing?.provider || 'zhipu');
  const [aiBaseUrl, setAiBaseUrl] = useState(existing?.baseUrl || AI_PRESETS.zhipu.baseUrl);
  const [aiModel, setAiModel] = useState(existing?.model || AI_PRESETS.zhipu.model);
  const [aiApiKey, setAiApiKey] = useState(existing?.apiKey || '');

  // 淘宝 API
  const tbConfig = getTaobaoConfig();
  const [appKey, setAppKey] = useState(tbConfig?.appKey || '');
  const [appSecret, setAppSecret] = useState(tbConfig?.appSecret || '');
  const [accessToken, setAccessToken] = useState(tbConfig?.accessToken || '');

  // Pro
  const [licenseCode, setLicenseCode] = useState('');

  const handleSaveAI = () => {
    if (!aiApiKey) {
      showToast('请填写 API Key', 'warning');
      return;
    }
    const cfg: AIConfig = { provider: aiProvider as any, baseUrl: aiBaseUrl, model: aiModel, apiKey: aiApiKey };
    setUserAIConfig(cfg);
    showToast('AI 配置已保存', 'success');
  };

  const handleProviderChange = (key: string) => {
    setAiProvider(key as any);
    const preset = AI_PRESETS[key];
    if (preset) {
      setAiBaseUrl(preset.baseUrl);
      setAiModel(preset.model);
    }
  };

  const handleSaveTaobao = () => {
    setTaobaoConfig({ appKey, appSecret, accessToken });
    showToast('淘宝 API 配置已保存', 'success');
  };

  const handleClearTaobao = () => {
    clearTaobaoConfig();
    setAppKey('');
    setAppSecret('');
    setAccessToken('');
    showToast('已清除淘宝 API 配置', 'info');
  };

  const handleRedeem = async () => {
    if (!licenseCode) {
      showToast('请输入兑换码', 'warning');
      return;
    }
    try {
      const result = await redeemLicenseCode(licenseCode);
      if (result.success) {
        showToast('兑换成功，已升级为 Pro 会员', 'success');
        setLicenseCode('');
      } else {
        showToast(result.error || '兑换失败', 'error');
      }
    } catch (e: any) {
      showToast(e.message || '兑换失败', 'error');
    }
  };

  const user = getCurrentUser();

  const SECTIONS: { key: Section; label: string; icon: string }[] = [
    { key: 'general', label: '通用', icon: '⚙' },
    { key: 'ai', label: 'AI 配置', icon: '🤖' },
    { key: 'pro', label: 'Pro 会员', icon: '👑' },
    { key: 'about', label: '关于', icon: 'ℹ' },
  ];

  return (
    <Modal open={true} onClose={onClose} title="设置" size="lg">
      <div className="flex gap-4">
        {/* 侧边 */}
        <div className="w-32 shrink-0 space-y-1">
          {SECTIONS.map((s) => (
            <button
              key={s.key}
              onClick={() => setSection(s.key)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition ${
                section === s.key
                  ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-medium'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              <span>{s.icon}</span>
              <span>{s.label}</span>
            </button>
          ))}
        </div>

        {/* 内容 */}
        <div className="flex-1 min-w-0">
          {section === 'general' && (
            <div className="space-y-4">
              <div>
                <label className="label">账号</label>
                <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg text-sm">
                  <div className="text-slate-700 dark:text-slate-200">{user?.displayName}</div>
                  <div className="text-slate-400 text-xs mt-1">{user?.email}</div>
                </div>
              </div>
              <div>
                <label className="label">会员状态</label>
                <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg text-sm flex items-center justify-between">
                  <span>
                    {user?.plan === 'free' ? '免费版' : user?.plan === 'pro_lifetime' ? 'Pro 终身版' : user?.plan === 'pro_monthly' ? 'Pro 月度版' : 'Pro 年度版'}
                  </span>
                  {user?.planExpiresAt && (
                    <span className="text-xs text-slate-400">
                      到期：{new Date(user.planExpiresAt).toLocaleDateString('zh-CN')}
                    </span>
                  )}
                </div>
              </div>
              <button onClick={() => signOut().then(onClose)} className="btn-danger w-full">
                退出登录
              </button>
            </div>
          )}

          {section === 'ai' && (
            <div className="space-y-4">
              <div>
                <label className="label">AI 服务商</label>
                <select className="input" value={aiProvider} onChange={(e) => handleProviderChange(e.target.value)}>
                  {Object.entries(AI_PRESETS).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                  <option value="custom">自定义</option>
                </select>
              </div>
              <div>
                <label className="label">API Base URL</label>
                <input className="input" value={aiBaseUrl} onChange={(e) => setAiBaseUrl(e.target.value)} />
              </div>
              <div>
                <label className="label">模型名称</label>
                <input className="input" value={aiModel} onChange={(e) => setAiModel(e.target.value)} />
              </div>
              <div>
                <label className="label">API Key</label>
                <input
                  type="password"
                  className="input"
                  placeholder="sk-..."
                  value={aiApiKey}
                  onChange={(e) => setAiApiKey(e.target.value)}
                />
                <p className="text-xs text-slate-400 mt-1">
                  Pro 会员无需配置，使用内置云端 Key。免费用户请自行申请。
                </p>
              </div>
              <button onClick={handleSaveAI} className="btn-primary w-full">保存 AI 配置</button>
              <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="font-medium text-blue-700 dark:text-blue-400">如何获取 API Key：</div>
                <div>• 智谱 GLM: https://open.bigmodel.cn/ （免费）</div>
                <div>• DeepSeek: https://platform.deepseek.com/</div>
                <div>• Moonshot: https://platform.moonshot.cn/</div>
              </div>
            </div>
          )}

          {section === 'api' && (
            <div className="space-y-4">
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-xs text-amber-700 dark:text-amber-400">
                ⚠️ 淘宝开放平台 API 需要 AppKey/AppSecret 和企业资质审核。未配置时，系统将使用 Mock 演示数据。
              </div>
              <div>
                <label className="label">App Key</label>
                <input className="input" value={appKey} onChange={(e) => setAppKey(e.target.value)} placeholder="12345678" />
              </div>
              <div>
                <label className="label">App Secret</label>
                <input type="password" className="input" value={appSecret} onChange={(e) => setAppSecret(e.target.value)} />
              </div>
              <div>
                <label className="label">Access Token（授权后获取）</label>
                <input type="password" className="input" value={accessToken} onChange={(e) => setAccessToken(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <button onClick={handleSaveTaobao} className="btn-primary flex-1">保存</button>
                <button onClick={handleClearTaobao} className="btn-secondary">清除</button>
              </div>
            </div>
          )}

          {section === 'pro' && (
            <div className="space-y-4">
              <div className="p-4 bg-gradient-to-br from-amber-50 to-yellow-100 dark:from-amber-900/30 dark:to-yellow-900/20 rounded-xl text-center">
                <div className="text-4xl mb-2">👑</div>
                <div className="text-lg font-semibold text-amber-700 dark:text-amber-300">升级 Pro 会员</div>
                <div className="text-sm text-amber-600 dark:text-amber-400 mt-1">无限 AI 调用 + 内置云端 Key</div>
              </div>
              <div>
                <label className="label">兑换码</label>
                <input
                  className="input"
                  placeholder="请输入兑换码"
                  value={licenseCode}
                  onChange={(e) => setLicenseCode(e.target.value)}
                />
              </div>
              <button onClick={handleRedeem} className="btn-primary w-full">立即兑换</button>
              <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
                <div className="font-medium">Pro 会员特权：</div>
                <div>• 无限 AI 对话次数</div>
                <div>• 使用内置云端 API Key（无需自配）</div>
                <div>• 高级数据分析功能</div>
                <div>• 优先技术支持</div>
              </div>
            </div>
          )}

          {section === 'about' && (
            <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300">
              <div className="text-center py-4">
                <div className="inline-flex w-16 h-16 rounded-2xl bg-primary-600 items-center justify-center text-white text-3xl mb-3">
                  📊
                </div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">电商数据分析</h2>
                <p className="text-xs text-slate-400 mt-1">版本 1.0.0</p>
              </div>
              <div className="space-y-2 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                <div className="font-medium">功能特性：</div>
                <ul className="text-xs space-y-1 list-disc list-inside">
                  <li>多店铺多产品经营分析</li>
                  <li>每日 5 项核心指标 + 8 项推广明细</li>
                  <li>月度 13 项成本核算</li>
                  <li>自动计算 13+ 关键指标</li>
                  <li>自然年/季节年对比</li>
                  <li>AI 智能分析与预测</li>
                  <li>PC Web + Android APP 数据实时同步</li>
                  <li>Excel 批量导入</li>
                  <li>淘宝开放平台 API 对接（预留）</li>
                </ul>
              </div>
              <div className="text-xs text-slate-400 text-center">
                © 2026 电商数据分析平台
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
