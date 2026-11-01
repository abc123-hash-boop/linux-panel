import React, { useState, useEffect } from 'react';
import {
  Newspaper,
  ExternalLink,
  AlertTriangle,
  AlertCircle,
  Info,
  RefreshCw,
  Flame,
} from 'lucide-react';
import apiClient from '../api/client';
import { useI18n } from '../i18n';

const cn = (...classes) => classes.filter(Boolean).join(' ');

// 重要性档位映射
function importanceTier(imp) {
  if (imp >= 7) return 'high';    // 高危 7-10
  if (imp >= 4) return 'warn';    // 警告 4-6
  return 'info';                  // 提示 1-3
}

const TIER_META = {
  high: {
    badge: 'bg-red-500/20 text-red-300 border-red-500/30',
    glow: 'from-red-500/20 via-red-600/5 to-transparent',
    bar: 'from-red-500 to-red-400',
    ring: 'hover:border-red-500/40 hover:shadow-[0_0_28px_rgba(239,68,68,0.18)]',
    dot: 'bg-red-500',
  },
  warn: {
    badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    glow: 'from-amber-500/15 via-amber-600/5 to-transparent',
    bar: 'from-amber-500 to-yellow-400',
    ring: 'hover:border-amber-500/40 hover:shadow-[0_0_28px_rgba(245,158,11,0.15)]',
    dot: 'bg-amber-500',
  },
  info: {
    badge: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
    glow: 'from-sky-500/15 via-sky-600/5 to-transparent',
    bar: 'from-sky-500 to-cyan-400',
    ring: 'hover:border-sky-500/40 hover:shadow-[0_0_28px_rgba(56,189,248,0.15)]',
    dot: 'bg-sky-500',
  },
};

const News = () => {
  const { t, lang } = useI18n();
  const [news, setNews] = useState(null);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);

  const fetchNews = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/news');
      setNews(res.data);
      setError(null);
    } catch (e) {
      console.error('news fetch failed:', e);
      setError(t('news.error', 'Failed to load news'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNews();
  }, [tick]);

  const tierLabel = {
    high: t('news.tier.high', '高危'),
    warn: t('news.tier.warn', '警告'),
    info: t('news.tier.info', '提示'),
  };

  const articles = news?.articles || [];
  const visible = articles
    .filter((a) => filter === 'all' || importanceTier(a.importance) === filter)
    .sort((a, b) => b.importance - a.importance);

  const counts = {
    all: articles.length,
    high: articles.filter((a) => importanceTier(a.importance) === 'high').length,
    warn: articles.filter((a) => importanceTier(a.importance) === 'warn').length,
    info: articles.filter((a) => importanceTier(a.importance) === 'info').length,
  };

  if (error) {
    return (
      <div className="glass border border-red-500/30 text-red-200 px-4 py-3 rounded-xl flex items-center gap-3">
        <AlertCircle size={20} />
        <span>{error}</span>
        <button onClick={() => setTick((v) => v + 1)} className="ml-auto underline text-sm font-medium hover:text-red-100">
          {t('news.retry', '重试')}
        </button>
      </div>
    );
  }

  if (loading || !news) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-12 h-12 border-4 border-sky-500/30 border-t-sky-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 标题区 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-sky-200 bg-clip-text text-transparent flex items-center gap-2">
            <Newspaper size={24} className="text-white/60" />
            {t('news.title', '新闻与通告')}
          </h1>
          <p className="text-white/50">
            {t('news.subtitle', '系统安全通告与重要事件 · 按重要性排序')}
            {news.updatedAt ? ` · ${t('news.updated', '更新')} ${news.updatedAt}` : ''}
          </p>
        </div>
        <button
          onClick={() => setTick((v) => v + 1)}
          className="glass-btn p-2.5 text-white/80 hover:text-white rounded-xl transition-all disabled:opacity-50"
          disabled={loading}
        >
          <RefreshCw className={cn('h-5 w-5', loading && 'animate-spin')} />
        </button>
      </div>

      {/* 筛选标签 + 统计 */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { key: 'all', label: t('news.filter.all', '全部'), count: counts.all, active: 'border-white/40 bg-white/10 text-white' },
          { key: 'high', label: tierLabel.high, count: counts.high, active: 'border-red-500/50 bg-red-500/15 text-red-300' },
          { key: 'warn', label: tierLabel.warn, count: counts.warn, active: 'border-amber-500/50 bg-amber-500/15 text-amber-300' },
          { key: 'info', label: tierLabel.info, count: counts.info, active: 'border-sky-500/50 bg-sky-500/15 text-sky-300' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={cn(
              'px-4 py-1.5 rounded-lg text-sm font-medium border transition-all',
              filter === tab.key ? tab.active : 'border-white/10 text-white/50 hover:text-white/80 hover:border-white/25'
            )}
          >
            {tab.label}
            <span className={cn('ml-2 px-1.5 py-0.5 rounded-md text-xs', filter === tab.key ? 'bg-black/20' : 'bg-white/5')}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* 新闻卡片 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {visible.map((a, i) => {
          const tier = importanceTier(a.importance);
          const meta = TIER_META[tier];
          const hasUrl = a.url && a.url.trim() !== '';
          const Icon = tier === 'high' ? Flame : tier === 'warn' ? AlertTriangle : Info;
          const pct = Math.min(100, Math.max(0, (a.importance / 10) * 100));

          return (
            <a
              key={`${a.title}-${i}`}
              href={hasUrl ? a.url : undefined}
              target={hasUrl ? '_blank' : undefined}
              rel={hasUrl ? 'noopener noreferrer' : undefined}
              onClick={(e) => { if (!hasUrl) e.preventDefault(); }}
              className={cn(
                'group glass-strong p-5 rounded-2xl relative overflow-hidden block',
                'hover:-translate-y-0.5 transition-all duration-300',
                meta.ring,
                !hasUrl && 'cursor-default'
              )}
            >
              {/* 档位光晕 */}
              <div className={cn('absolute inset-0 bg-gradient-to-br pointer-events-none', meta.glow)} />

              {/* 左侧重要性条 */}
              <div className="absolute left-0 top-0 bottom-0 w-1 flex">
                <div className={cn('w-1 bg-gradient-to-b', meta.bar)} style={{ height: `${pct}%` }} />
              </div>

              <div className="relative pl-3">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border', meta.badge)}>
                    <Icon size={13} />
                    {tierLabel[tier]}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-white/40 text-xs font-medium">
                      {t('news.importance', '重要性')} {a.importance}/10
                    </span>
                    {hasUrl && (
                      <ExternalLink size={15} className="text-white/30 group-hover:text-white/70 transition-colors" />
                    )}
                  </div>
                </div>

                <h3 className="text-base font-semibold text-white leading-snug">
                  {a.title}
                </h3>
                {a.subtitle && (
                  <p className="text-white/55 text-sm mt-1.5 line-clamp-2">{a.subtitle}</p>
                )}

                {/* 重要性进度条 */}
                <div className="mt-4 h-1.5 rounded-full bg-white/8 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full bg-gradient-to-r', meta.bar)}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </a>
          );
        })}
      </div>

      {visible.length === 0 && (
        <div className="glass p-10 rounded-2xl text-center text-white/40">
          {t('news.empty', '暂无新闻')}
        </div>
      )}
    </div>
  );
};

export default News;
