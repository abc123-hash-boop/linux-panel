import React, { useState } from 'react';
import { Lock, Globe, CheckCircle, AlertCircle } from 'lucide-react';
import apiClient from '../api/client';

const SettingsView = () => {
  // 密码修改
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdStatus, setPwdStatus] = useState({ type: '', msg: '' });
  const [pwdLoading, setPwdLoading] = useState(false);

  // 语言设置
  const [language, setLanguage] = useState('zh');
  const [langSaved, setLangSaved] = useState(false);

  // 处理密码修改
  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwdStatus({ type: '', msg: '' });

    if (newPassword !== confirmPassword) {
      setPwdStatus({ type: 'error', msg: '两次输入的新密码不一致' });
      return;
    }
    if (newPassword.length < 6) {
      setPwdStatus({ type: 'error', msg: '新密码长度不能少于6位' });
      return;
    }

    setPwdLoading(true);
    try {
      await apiClient.post('/user/password', {
        old_password: oldPassword,
        new_password: newPassword,
      });
      setPwdStatus({ type: 'success', msg: '密码修改成功' });
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      const msg = err.response?.data?.error || '修改失败，请检查旧密码是否正确';
      setPwdStatus({ type: 'error', msg });
    } finally {
      setPwdLoading(false);
    }
  };

  // 处理语言切换
  const handleLanguageChange = (value) => {
    setLanguage(value);
    localStorage.setItem('panel_language', value);
    setLangSaved(true);
    setTimeout(() => setLangSaved(false), 2000);
  };

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Settings</h1>
        <p className="text-gray-500">Change password & language</p>
      </div>

      {/* 修改密码 */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <Lock className="text-gray-400" size={20} />
          <h2 className="text-lg font-semibold text-gray-800">Change Password</h2>
        </div>
        <div className="p-6">
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Old Password</label>
              <input
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Enter old password"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Enter new password (min 6 chars)"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Re-enter new password"
                required
              />
            </div>

            {pwdStatus.msg && (
              <div className={`flex items-center gap-2 px-4 py-3 rounded-lg ${
                pwdStatus.type === 'success'
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {pwdStatus.type === 'success'
                  ? <CheckCircle size={18} />
                  : <AlertCircle size={18} />
                }
                <span>{pwdStatus.msg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={pwdLoading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition-colors font-medium"
            >
              {pwdLoading ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </div>
      </section>

      {/* 语言设置 */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <Globe className="text-gray-400" size={20} />
          <h2 className="text-lg font-semibold text-gray-800">Language</h2>
        </div>
        <div className="p-6">
          <div className="space-y-3">
            {[
              { value: 'zh', label: '中文 (简体)', flag: '🇨🇳' },
              { value: 'en', label: 'English', flag: '🇺🇸' },
            ].map((lang) => (
              <label
                key={lang.value}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-colors ${
                  language === lang.value
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="language"
                  value={lang.value}
                  checked={language === lang.value}
                  onChange={(e) => handleLanguageChange(e.target.value)}
                  className="sr-only"
                />
                <span className="text-xl">{lang.flag}</span>
                <span className="font-medium text-gray-700">{lang.label}</span>
                {language === lang.value && (
                  <CheckCircle className="ml-auto text-blue-600" size={18} />
                )}
              </label>
            ))}
          </div>
          {langSaved && (
            <p className="mt-3 text-sm text-green-600 flex items-center gap-1">
              <CheckCircle size={14} /> Language saved
            </p>
          )}
        </div>
      </section>
    </div>
  );
};

export default SettingsView;
