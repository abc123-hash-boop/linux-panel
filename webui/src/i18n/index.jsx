import React, { createContext, useContext, useState, useCallback } from 'react';

const I18nContext = createContext(null);

// 从 localStorage 读取语言偏好，默认 zh
function getInitialLang() {
  try {
    const saved = localStorage.getItem('panel_language');
    if (saved === 'zh' || saved === 'en') return saved;
  } catch {}
  return 'zh';
}

// 嵌套 key 取值: t('nav.dashboard') -> dict.nav.dashboard
function lookup(dict, path) {
  const parts = path.split('.');
  let cur = dict;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return null;
    cur = cur[p];
  }
  return typeof cur === 'string' ? cur : null;
}

export function I18nProvider({ dicts, children }) {
  const [lang, setLangState] = useState(getInitialLang());

  const setLang = useCallback((next) => {
    if (next !== 'zh' && next !== 'en') return;
    setLangState(next);
    try { localStorage.setItem('panel_language', next); } catch {}
  }, []);

  const t = useCallback((key, fallback) => {
    const val = lookup(dicts[lang], key);
    if (val != null) return val;
    const en = lookup(dicts.en, key);
    if (en != null) return en;
    return fallback != null ? fallback : key;
  }, [lang, dicts]);

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Provider 外使用时的兜底（避免崩溃）
    return {
      lang: 'zh',
      setLang: () => {},
      t: (key, fallback) => (fallback != null ? fallback : key),
    };
  }
  return ctx;
}
