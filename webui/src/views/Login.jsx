import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n';
import apiClient from '../api/client';

const Login = () => {
  const { t, lang, setLang } = useI18n();
  const navigate = useNavigate();
  const [langMenuOpen, setLangMenuOpen] = useState(false);

  const langOptions = [
    { code: 'zh', name: '简体中文', flag: '🇨🇳' },
    { code: 'en', name: 'English', flag: '🇺🇸' },
  ];

  const currentLang = langOptions.find((l) => l.code === lang);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 键盘 Enter 提交
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      handleSubmit(e);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password.trim()) {
      setError(t('login.error.empty', '请输入用户名和密码'));
      return;
    }
    setLoading(true);

    try {
      const response = await apiClient.post('/login', {
        username: username.trim(),
        password,
      });
      if (response.data && response.data.message === 'ok') {
        navigate('/');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError(err.response?.data?.error || t('login.error.loginFailed', '登录失败，请检查用户名和密码'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-indigo-950 to-gray-900 flex items-center justify-center p-4 overflow-hidden relative">
      {/* 动态背景光斑 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -right-[10%] w-[70vh] h-[70vh] bg-indigo-600/30 rounded-full mix-blend-multiply filter blur-[100px] animate-pulse"></div>
        <div className="absolute -bottom-[20%] -left-[10%] w-[70vh] h-[70vh] bg-violet-600/30 rounded-full mix-blend-multiply filter blur-[100px] animate-pulse delay-700"></div>
        <div className="absolute top-[40%] left-[30%] w-[40vh] h-[40vh] bg-blue-600/20 rounded-full mix-blend-multiply filter blur-[80px] animate-pulse delay-1000"></div>
        {/* 网格装饰 */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:60px_60px]"></div>
      </div>

      {/* 主卡片 */}
      <div className="relative w-full max-w-md z-10">
        {/* 顶部品牌区 */}
        <div className="relative text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl mb-5 shadow-2xl transform hover:scale-105 transition-transform duration-300">
            <svg className="w-11 h-11 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
          </div>
          <h1 className="text-4xl font-black text-white mb-3 tracking-tight">
            PPanel
          </h1>
          <p className="text-lg text-white/60">
            {t('login.subtitle', 'Linux Server Management Panel')}
          </p>

          {/* 右上角语言切换器 */}
          <div className="absolute -top-2 -right-2 group">
            <div className="relative">
              <button
                onClick={() => setLangMenuOpen(!langMenuOpen)}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 backdrop-blur-sm transition-all duration-200 hover:scale-105"
                title={t('login.changeLang', 'Change language')}
              >
                <span className="text-lg">{currentLang?.flag}</span>
                <span className="text-sm font-medium text-white/90">
                  {currentLang?.name}
                </span>
                <svg
                  className={`w-4 h-4 text-white/70 transition-transform ${
                    langMenuOpen ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {langMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setLangMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-40 rounded-xl bg-gray-900/95 backdrop-blur-xl border border-white/15 shadow-2xl overflow-hidden z-20">
                    {langOptions.map((option) => (
                      <button
                        key={option.code}
                        onClick={() => {
                          setLang(option.code);
                          setLangMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-white/10 first:mt-0"
                      >
                        <span className="text-lg">{option.flag}</span>
                        <span
                          className={`${
                            lang === option.code
                              ? 'text-indigo-400 font-semibold'
                              : 'text-white/90'
                          }`}
                        >
                          {option.name}
                        </span>
                        {lang === option.code && (
                          <svg
                            className="ml-auto w-4 h-4 text-indigo-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* 登录卡片 */}
        <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-white/10">
          <h2 className="text-2xl font-bold text-white mb-2">
            {t('login.title', 'Welcome Back')}
          </h2>
          <p className="text-white/40 text-sm mb-7">
            {t('login.description', 'Sign in to your admin account')}
          </p>

          {error && (
            <div className="mb-6 bg-red-500/20 border border-red-500/40 rounded-xl px-4 py-3 text-sm text-red-200 flex items-center gap-2 backdrop-blur-sm animate-[pulse_2s_ease-in-out_infinite]">
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* 用户名 */}
            <div className="group">
              <label className="block text-sm font-medium text-white/70 mb-2 ml-1">
                {t('login.username', '用户名')}
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 group-focus-within:text-indigo-400 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 bg-white/5 border border-white/15 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all duration-200"
                  placeholder={t('login.usernamePlaceholder', '请输入您的用户名')}
                  required
                  autoComplete="username"
                />
              </div>
            </div>

            {/* 密码 */}
            <div className="group">
              <label className="block text-sm font-medium text-white/70 mb-2 ml-1">
                {t('login.password', '密码')}
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 group-focus-within:text-indigo-400 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 bg-white/5 border border-white/15 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all duration-200"
                  placeholder={t('login.passwordPlaceholder', '请输入您的密码')}
                  required
                  autoComplete="current-password"
                />
              </div>
            </div>

            {/* 登录按钮 */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-300 shadow-lg hover:shadow-indigo-500/25 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                  </svg>
                  {t('login.signingIn', '登录中...')}
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                  {t('login.signIn', '登 录')}
                </>
              )}
            </button>
          </form>
        </div>

        {/* 默认凭证提示 */}
        <div className="mt-6 text-center">
          <p className="text-white/40 text-sm">
            {t('login.defaultCredentials', '默认凭据：')}
            <span className="text-indigo-400 font-mono ml-1 bg-indigo-500/10 px-2 py-0.5 rounded text-sm">admin / 123456</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;