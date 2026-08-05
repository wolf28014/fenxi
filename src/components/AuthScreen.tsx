import { useState } from 'react';
import { signInWithEmail, signUpWithEmail, sendOtp, verifyOtp } from '@/lib/auth';
import { showToast } from './Toast';

type Mode = 'signin' | 'signup' | 'phone';

export default function AuthScreen() {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleEmailAuth = async () => {
    if (!email || !password) {
      showToast('请填写邮箱和密码', 'warning');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'signin') {
        await signInWithEmail(email, password);
        showToast('登录成功', 'success');
      } else {
        await signUpWithEmail(email, password, displayName);
        showToast('注册成功，请查收邮箱激活', 'success');
      }
    } catch (e: any) {
      showToast(e.message || '操作失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async () => {
    if (!phone) {
      showToast('请输入手机号', 'warning');
      return;
    }
    setLoading(true);
    try {
      await sendOtp(phone);
      setOtpSent(true);
      showToast('验证码已发送', 'success');
    } catch (e: any) {
      showToast(e.message || '发送失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!phone || !otp) {
      showToast('请输入手机号和验证码', 'warning');
      return;
    }
    setLoading(true);
    try {
      await verifyOtp(phone, otp);
      showToast('登录成功', 'success');
    } catch (e: any) {
      showToast(e.message || '验证失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 p-4 safe-top safe-bottom">
      <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 fade-in">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex w-16 h-16 rounded-2xl bg-primary-600 items-center justify-center text-white text-3xl mb-3 shadow-lg">
            📊
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">电商数据分析</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">多店铺多产品经营分析平台</p>
        </div>

        {/* 切换标签 */}
        <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-700 rounded-lg mb-5">
          <button
            onClick={() => setMode('signin')}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition ${
              mode === 'signin' ? 'bg-white dark:bg-slate-800 shadow text-primary-600' : 'text-slate-500'
            }`}
          >
            登录
          </button>
          <button
            onClick={() => setMode('signup')}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition ${
              mode === 'signup' ? 'bg-white dark:bg-slate-800 shadow text-primary-600' : 'text-slate-500'
            }`}
          >
            注册
          </button>
          <button
            onClick={() => setMode('phone')}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition ${
              mode === 'phone' ? 'bg-white dark:bg-slate-800 shadow text-primary-600' : 'text-slate-500'
            }`}
          >
            手机号
          </button>
        </div>

        {/* 邮箱表单 */}
        {(mode === 'signin' || mode === 'signup') && (
          <div className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="label">昵称</label>
                <input
                  type="text"
                  className="input"
                  placeholder="请输入昵称"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>
            )}
            <div>
              <label className="label">邮箱</label>
              <input
                type="email"
                className="input"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="label">密码</label>
              <input
                type="password"
                className="input"
                placeholder="至少 6 位"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleEmailAuth()}
              />
            </div>
            <button
              onClick={handleEmailAuth}
              disabled={loading}
              className="btn-primary w-full py-2.5"
            >
              {loading ? '处理中...' : mode === 'signin' ? '登录' : '注册'}
            </button>
          </div>
        )}

        {/* 手机号表单 */}
        {mode === 'phone' && (
          <div className="space-y-4">
            <div>
              <label className="label">手机号</label>
              <input
                type="tel"
                className="input"
                placeholder="请输入手机号"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={otpSent}
              />
            </div>
            {otpSent && (
              <div>
                <label className="label">验证码</label>
                <input
                  type="text"
                  className="input"
                  placeholder="请输入 6 位验证码"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={(e) => e.key === 'Enter' && handleVerifyOtp()}
                />
              </div>
            )}
            {!otpSent ? (
              <button onClick={handleSendOtp} disabled={loading} className="btn-primary w-full py-2.5">
                {loading ? '发送中...' : '发送验证码'}
              </button>
            ) : (
              <button onClick={handleVerifyOtp} disabled={loading} className="btn-primary w-full py-2.5">
                {loading ? '验证中...' : '登录'}
              </button>
            )}
          </div>
        )}

        <p className="text-xs text-slate-400 text-center mt-5">
          登录即代表同意《用户协议》和《隐私政策》
        </p>
      </div>
    </div>
  );
}
