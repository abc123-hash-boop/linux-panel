import React, { useState } from 'react';
import { KeyRound, ShieldCheck, UserRound, LockKeyhole, ArrowRight } from 'lucide-react';
import apiClient from '../api/client';

const Onboarding = () => {
  const [token, setToken] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }
    if (password.length < 8) {
      setError('密码至少需要 8 个字符');
      return;
    }

    setLoading(true);
    try {
      await apiClient.post('/setup', {
        token: token.trim(),
        username: username.trim(),
        password,
      });
      // Reload so the application-wide setup gate fetches the now-initialized state.
      window.location.replace('/');
    } catch (err) {
      setError(err.response?.data?.error || '初始化失败，请检查网络或服务器状态');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-indigo-950 to-gray-950 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-32 w-[32rem] h-[32rem] rounded-full bg-indigo-600/20 blur-[110px]" />
        <div className="absolute -bottom-40 -left-32 w-[32rem] h-[32rem] rounded-full bg-violet-600/20 blur-[110px]" />
        <div className="absolute inset-0 opacity-[0.035] bg-[linear-gradient(rgba(255,255,255,0.7)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.7)_1px,transparent_1px)] bg-[size:48px_48px]" />
      </div>

      <main className="relative z-10 w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-xl shadow-indigo-950/50 mb-5">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <p className="text-xs font-semibold tracking-[0.28em] uppercase text-indigo-300/80 mb-3">First-time setup</p>
          <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">欢迎使用 PPanel</h1>
          <p className="text-sm sm:text-base text-white/55 mt-3">完成首次初始化，创建你的管理员账户</p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl border border-white/10 bg-gray-900/75 backdrop-blur-xl shadow-2xl shadow-black/30 p-6 sm:p-8 space-y-5">
          <div className="rounded-xl border border-indigo-400/20 bg-indigo-500/10 p-4 flex gap-3">
            <KeyRound className="w-5 h-5 text-indigo-300 shrink-0 mt-0.5" />
            <p className="text-sm text-indigo-100/80 leading-relaxed">请先在运行 PPanel 的服务器控制台中找到 <code className="text-indigo-200">ONBOARDING_TOKEN</code>，将其粘贴到下方。Token 仅在本次启动期间有效，初始化成功后立即失效。</p>
          </div>

          <label className="block">
            <span className="block text-sm font-medium text-white/80 mb-2">初始化 Token</span>
            <input
              autoComplete="off"
              required
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="粘贴服务器控制台中的 Token"
              className="w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-white placeholder:text-white/25 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 font-mono text-sm"
            />
          </label>

          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="block text-sm font-medium text-white/80 mb-2">管理员用户名</span>
              <div className="relative">
                <UserRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/35" />
                <input
                  required
                  minLength={3}
                  maxLength={32}
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="3–32 个字符"
                  className="w-full rounded-xl border border-white/10 bg-black/25 pl-10 pr-4 py-3 text-white placeholder:text-white/25 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
              <span className="block text-xs text-white/35 mt-1.5">字母、数字、点、下划线或连字符</span>
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-white/80 mb-2">管理员密码</span>
              <div className="relative">
                <LockKeyhole className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/35" />
                <input
                  required
                  type="password"
                  minLength={8}
                  maxLength={72}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="至少 8 个字符"
                  className="w-full rounded-xl border border-white/10 bg-black/25 pl-10 pr-4 py-3 text-white placeholder:text-white/25 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </label>
          </div>

          <label className="block">
            <span className="block text-sm font-medium text-white/80 mb-2">确认密码</span>
            <input
              required
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="再次输入管理员密码"
              className="w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-white placeholder:text-white/25 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20"
            />
          </label>

          {error && <div role="alert" className="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}

          <button
            type="submit"
            disabled={loading || !token.trim() || !username.trim() || !password || !confirmPassword}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-950/40 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? '正在初始化…' : '创建管理员并进入面板'}
            {!loading && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>

        <p className="text-center text-xs text-white/30 mt-6">PPanel · Secure first-run configuration</p>
      </main>
    </div>
  );
};

export default Onboarding;
