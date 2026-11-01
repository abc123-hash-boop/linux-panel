import React, { useState } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Lock, Globe, CheckCircle, AlertCircle } from 'lucide-react';
import apiClient from '../api/client';
import { useI18n } from '../i18n';

const cn = (...inputs) => twMerge(clsx(inputs));

const SettingsView = () => {
  const { lang, setLang, t } = useI18n();

  // 密码修改
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdStatus, setPwdStatus] = useState({ type: '', msg: '' });
  const [pwdLoading, setPwdLoading] = useState(false);

  // 语言设置
  const [langSaved, setLangSaved] = useState(false);

  // 处理密码修改
  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwdStatus({ type: '', msg: '' });

    if (newPassword !== confirmPassword) {
      setPwdStatus({ type: 'error', msg: lang === 'zh' ? '两次输入的新密码不一致' : 'New passwords do not match' });
      return;
    }
    if (newPassword.length < 6) {
      setPwdStatus({ type: 'error', msg: lang === 'zh' ? '新密码长度不能少于6位' : 'Password must be at least 6 characters' });
      return;
    }

    setPwdLoading(true);
    try {
      await apiClient.post('/user/password', {
        old_password: oldPassword,
        new_password: newPassword,
      });
      setPwdStatus({ type: 'success', msg: lang === 'zh' ? '密码修改成功' : 'Password updated successfully' });
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      const msg = err.response?.data?.error || (lang === 'zh' ? '修改失败，请检查旧密码是否正确' : 'Failed to update password');
      setPwdStatus({ type: 'error', msg });
    } finally {
      setPwdLoading(false);
    }
  };

  // 处理语言切换
  const handleLanguageChange = (value) => {
    setLang(value);
    setLangSaved(true);
    setTimeout(() => setLangSaved(false), 2000);
  };

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white bg-gradient-to-r from-white to-violet-200 bg-clip-text text-transparent">
          {t('settings.title', 'Settings')}
        </h1>
        <p className="text-white/50 mt-1">{t('settings.subtitle', 'Change password & language')}</p>
      </div>

      {/* 修改密码 */}
      <section className="glass-strong rounded-2xl overflow-hidden border border-white/10">
        <div className="px-6 py-4 border-b border-white/8 flex items-center gap-2 bg-white/5">
          <Lock className="text-violet-400" size={20} />
          <h2 className="text-lg font-semibold text-white">{t('settings.pwdTitle', 'Change Password')}</h2>
        </div>
        <div className="p-6">
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">{t('settings.oldPwd', 'Old Password')}</label>
              <input
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className="glass-input w-full px-4 py-3 rounded-xl text-sm outline-none"
                placeholder={lang === 'zh' ? '输入旧密码' : 'Enter old password'}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">{t('settings.newPwd', 'New Password')}</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="glass-input w-full px-4 py-3 rounded-xl text-sm outline-none"
                placeholder={lang === 'zh' ? '输入新密码（至少6位）' : 'Enter new password (min 6 chars)'}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">{t('settings.confirmPwd', 'Confirm New Password')}</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="glass-input w-full px-4 py-3 rounded-xl text-sm outline-none"
                placeholder={lang === 'zh' ? '再次输入新密码' : 'Re-enter new password'}
                required
              />
            </div>

            {pwdStatus.msg && (
              <div className={cn(
                "flex items-center gap-2 px-4 py-3 rounded-xl backdrop-blur-sm border",
                pwdStatus.type === 'success'
                  ? 'bg-green-500/15 border-green-500/30 text-green-200'
                  : 'bg-red-500/15 border-red-500/30 text-red-200'
              )}>
                {pwdStatus.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                <span>{pwdStatus.msg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={pwdLoading}
              className="w-full py-3 px-4 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl transition-all font-medium shadow-[0_4px_20px_rgba(139,92,246,0.3)] disabled:opacity-50"
            >
              {pwdLoading ? (lang === 'zh' ? '更新中...' : 'Updating...') : t('settings.updateBtn', 'Update Password')}
            </button>
          </form>
        </div>
      </section>

      {/* 语言设置 */}
      <section className="glass-strong rounded-2xl overflow-hidden border border-white/10">
        <div className="px-6 py-4 border-b border-white/8 flex items-center gap-2 bg-white/5">
          <Globe className="text-violet-400" size={20} />
          <h2 className="text-lg font-semibold text-white">{t('settings.langTitle', 'Language')}</h2>
        </div>
        <div className="p-6">
          <div className="space-y-3">
            {[
              { value: 'zh', label: '中文 (简体)', flag: '🇨🇳' },
              { value: 'en', label: 'English', flag: '🇺🇸' },
            ].map((item) => (
              <label
                key={item.value}
                className={cn(
                  "flex items-center gap-4 px-5 py-4 rounded-xl border cursor-pointer transition-all",
                  lang === item.value
                    ? "bg-gradient-to-r from-violet-500/20 to-indigo-500/20 border-violet-500/50 shadow-lg shadow-violet-500/10"
                    : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
                )}
              >
                <input
                  type="radio"
                  name="language"
                  value={item.value}
                  checked={lang === item.value}
                  onChange={(e) => handleLanguageChange(e.target.value)}
                  className="sr-only"
                />
                <span className="text-2xl">{item.flag}</span>
                <span className={cn("font-medium", lang === item.value ? "text-white" : "text-white/70")}>{item.label}</span>
                {lang === item.value && (
                  <CheckCircle className="ml-auto text-violet-400" size={20} />
                )}
              </label>
            ))}
          </div>
          {langSaved && (
            <p className="mt-3 text-sm text-green-400 flex items-center gap-1">
              <CheckCircle size={14} /> {t('settings.saved', 'Language saved')}
            </p>
          )}
        </div>
      </section>
    </div>
  );
};

export default SettingsView;
