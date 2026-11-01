import React, { useState, useEffect } from 'react';
import {
  Server,
  Database,
  RefreshCw,
  Play,
  Square,
  RotateCw,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Terminal,
  Search,
  FileWarning,
  Loader2,
} from 'lucide-react';
import apiClient from '../api/client';
import { useI18n } from '../i18n';

const cn = (...classes) => classes.filter(Boolean).join(' ');

// ---------- 格式化 ----------
function fmtBytes(n) {
  if (n == null) return '-';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

// ---------- Nginx Tab ----------
function NginxTab() {
  const { t } = useI18n();
  const [showCreate, setShowCreate] = useState(false);
  const [newSiteName, setNewSiteName] = useState('');
  const [newSiteContent, setNewSiteContent] = useState(`server {
    listen 80;
    server_name example.com;

    location / {
        root /var/www/html;
        index index.html index.htm;
    }
}`);
  const [createErr, setCreateErr] = useState(null);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [st, s] = await Promise.all([
        apiClient.get('/sites/nginx'),
        apiClient.get('/sites/nginx/sites'),
      ]);
      setStatus(st.data || {});
      setSites(s.data || []);
    } catch (e) {
      console.error('nginx fetch failed:', e);
      setStatus({});
      setSites([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const doService = async (action) => {
    setBusy({ svc: action });
    setActionMsg(null);
    try {
      await apiClient.post(`/sites/nginx/${action}`);
      setActionMsg({ ok: true, text: t('sites.nginx.done', '操作已执行') });
      fetchAll();
    } catch (e) {
      setActionMsg({ ok: false, text: e.response?.data?.error || String(e) });
    } finally {
      setBusy(null);
    }
  };

  const doSite = async (name, action) => {
    setBusy({ site: name, action });
    setActionMsg(null);
    try {
      await apiClient.post(`/sites/nginx/site/${encodeURIComponent(name)}/${action}`);
      setActionMsg({ ok: true, text: `${name}: ${t('sites.nginx.done', '操作已执行')}` });
      fetchAll();
    } catch (e) {
      setActionMsg({ ok: false, text: e.response?.data?.error || String(e) });
    } finally {
      setBusy(null);
    }
  };

  const installed = status?.installed;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* 状态卡 */}
      <div className="glass-strong p-5 rounded-2xl relative overflow-hidden">
        <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="flex flex-wrap items-center gap-3 relative">
          <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br shadow-lg',
            installed ? 'from-amber-500 to-orange-600' : 'from-gray-500 to-gray-600')}>
            <Server size={22} className="text-white" />
          </div>
          <div className="flex-1 min-w-[120px]">
            <p className="text-sm font-semibold text-white">{t('sites.nginx.status', 'Nginx 状态')}</p>
            <p className="text-xs text-white/50">{status?.version || (installed ? '' : t('sites.nginx.notInstalled', '未安装'))}</p>
          </div>

          {/* 状态徽章 */}
          <span className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border',
            status?.running
              ? 'bg-green-500/15 text-green-300 border-green-500/30'
              : 'bg-red-500/15 text-red-300 border-red-500/30')}>
            <span className={cn('w-2 h-2 rounded-full', status?.running ? 'bg-green-400 animate-pulse' : 'bg-red-400')} />
            {status?.running ? t('sites.nginx.running', '运行中') : t('sites.nginx.stopped', '已停止')}
          </span>

          <span className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border',
            status?.config_ok
              ? 'bg-green-500/15 text-green-300 border-green-500/30'
              : 'bg-red-500/15 text-red-300 border-red-500/30')}>
            {status?.config_ok ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
            {status?.config_ok ? t('sites.nginx.cfgOk', '配置有效') : t('sites.nginx.cfgErr', '配置错误')}
          </span>

          {installed && (
            <div className="flex gap-2 ml-auto">
              {[['start', Play, '启动'], ['stop', Square, '停止'], ['reload', RotateCw, '重载']].map(([act, Icon, label]) => (
                <button
                  key={act}
                  onClick={() => doService(act)}
                  disabled={!!busy}
                  className={cn('glass-btn px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 disabled:opacity-50',
                    act === 'start' && 'text-green-300', act === 'stop' && 'text-red-300', act === 'reload' && 'text-sky-300')}
                >
                  {busy?.svc ? <Loader2 size={13} className="animate-spin" /> : <Icon size={13} />}
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {actionMsg && (
          <p className={cn('mt-3 text-xs relative', actionMsg.ok ? 'text-green-300' : 'text-red-300')}>
            {actionMsg.text}
          </p>
        )}
        {status?.config_msg && !status.config_ok && (
          <pre className="mt-3 text-xs text-red-300 bg-black/30 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap max-h-32">
            {status.config_msg}
          </pre>
        )}
      </div>

      {/* 站点列表 */}
      <div className="glass-strong p-5 rounded-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <CheckCircle2 size={16} className="text-white/50" />
            {t('sites.nginx.sites', '站点')}
            <span className="text-xs text-white/40 font-normal">{sites.length}</span>
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setShowCreate(!showCreate); setCreateErr(null); }}
              className="glass-btn px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 text-violet-300"
            >
              + {t('sites.nginx.createSite', '新建站点')}
            </button>
            <button onClick={fetchAll} className="glass-btn p-1.5 rounded-lg text-white/60 hover:text-white">
              <RefreshCw size={14} className={cn(loading && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* 新建站点弹窗/面板 */}
        {showCreate && (
          <div className="mb-5 glass-input p-4 rounded-xl space-y-3 animate-fade-in border border-violet-500/30">
            <h4 className="text-sm font-semibold text-white">{t('sites.nginx.createSite', '新建 Nginx 站点')}</h4>
            <div>
              <label className="text-xs text-white/60 block mb-1">{t('sites.nginx.siteName', '站点配置文件名 (如 myapp.conf)')}</label>
              <input
                type="text"
                value={newSiteName}
                onChange={(e) => setNewSiteName(e.target.value)}
                placeholder="myapp.conf"
                className="glass-input w-full px-3 py-2 rounded-lg text-sm outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-white/60 block mb-1">{t('sites.nginx.siteContent', 'Nginx 配置内容')}</label>
              <textarea
                value={newSiteContent}
                onChange={(e) => setNewSiteContent(e.target.value)}
                rows={8}
                spellCheck={false}
                className="glass-input w-full px-3 py-2 rounded-lg text-xs font-mono outline-none resize-y"
              />
            </div>
            {createErr && <p className="text-xs text-red-300">{createErr}</p>}
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowCreate(false)} className="glass-btn px-3 py-1.5 rounded-lg text-xs text-white/70">
                {t('sites.cancel', '取消')}
              </button>
              <button
                onClick={async () => {
                  if (!newSiteName.trim()) { setCreateErr('Filename required'); return; }
                  try {
                    setCreateErr(null);
                    await apiClient.post('/sites/nginx/site/create', { name: newSiteName, content: newSiteContent });
                    setShowCreate(false);
                    setNewSiteName('');
                    fetchAll();
                  } catch (e) {
                    setCreateErr(e.response?.data?.error || String(e));
                  }
                }}
                className="glass-btn-primary px-4 py-1.5 rounded-lg text-xs font-medium"
              >
                {t('sites.saveCreate', '创建并重载')}
              </button>
            </div>
          </div>
        )}

        {sites.length === 0 ? (
          <p className="text-sm text-white/40 text-center py-6">
            {installed ? t('sites.nginx.noSites', '暂无站点配置') : t('sites.nginx.notInstalled', '未安装')}
          </p>
        ) : (
          <div className="space-y-2">
            {sites.map((s) => (
              <div key={s.path} className="glass-input flex items-center gap-3 px-4 py-3 rounded-xl">
                <span className={cn('w-2 h-2 rounded-full shrink-0', s.enabled ? 'bg-green-400' : 'bg-white/20')} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{s.name}</p>
                  <p className="text-xs text-white/40 truncate">{s.path}</p>
                </div>
                <span className={cn('px-2 py-0.5 rounded-md text-xs font-medium',
                  s.enabled ? 'bg-green-500/15 text-green-300' : 'bg-white/8 text-white/40')}>
                  {s.enabled ? t('sites.nginx.enabled', '启用') : t('sites.nginx.disabled', '停用')}
                </span>
                <button
                  onClick={() => doSite(s.name, s.enabled ? 'disable' : 'enable')}
                  disabled={!!busy}
                  className={cn('glass-btn px-2.5 py-1 rounded-lg text-xs flex items-center gap-1 disabled:opacity-50',
                    s.enabled ? 'text-red-300' : 'text-green-300')}
                >
                  <ChevronRight size={12} />
                  {s.enabled ? t('sites.nginx.disable', '停用') : t('sites.nginx.enable', '启用')}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- SQLite Tab ----------
function SqlTab() {
  const { t } = useI18n();
  const [dbs, setDbs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState(null); // 选中的 db
  const [query, setQuery] = useState('');
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [expanded, setExpanded] = useState({});

  const fetchDBs = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/sites/sql');
      setDbs(res.data || []);
    } catch (e) {
      console.error('sql db list failed:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDBs(); }, []);

  const selectDB = (db) => {
    setSel(db);
    setResult(null);
    setQuery(`SELECT * FROM ${db.tables[0]?.name || ''} LIMIT 50`);
  };

  const runQuery = async () => {
    if (!sel || !query.trim()) return;
    setRunning(true);
    setResult(null);
    try {
      const res = await apiClient.post('/sites/sql/query', { path: sel.path, query });
      setResult(res.data);
    } catch (e) {
      setResult({ error: e.response?.data?.error || String(e) });
    } finally {
      setRunning(false);
    }
  };

  const cols = result?.columns || [];
  const rows = result?.rows || [];

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-white flex items-center gap-2">
          <Database size={16} className="text-white/50" />
          {t('sites.sql.dbs', '数据库文件')}
          <span className="text-xs text-white/40 font-normal">{dbs.length}</span>
        </h3>
        <button onClick={fetchDBs} className="glass-btn p-1.5 rounded-lg text-white/60 hover:text-white">
          <RefreshCw size={14} className={cn(loading && 'animate-spin')} />
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-white/40 text-sm">{t('sites.sql.scanning', '正在扫描数据库文件...')}</div>
      ) : dbs.length === 0 ? (
        <p className="text-sm text-white/40 text-center py-8">{t('sites.sql.none', '未找到数据库文件')}</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {dbs.map((db) => (
            <button
              key={db.path}
              onClick={() => selectDB(db)}
              className={cn('glass-strong p-4 rounded-xl text-left transition-all hover:-translate-y-0.5',
                sel?.path === db.path ? 'ring-2 ring-violet-500/50 border-violet-500/30' : 'hover:border-white/20')}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <Database size={16} className={sel?.path === db.path ? 'text-violet-300' : 'text-white/40'} />
                <span className="text-sm font-medium text-white truncate flex-1">{db.path.split('/').pop()}</span>
                <span className="text-xs text-white/40 shrink-0">{fmtBytes(db.size)}</span>
              </div>
              <p className="text-xs text-white/40 truncate mb-2">{db.path}</p>
              <p className="text-xs text-white/50">{t('sites.sql.tables', '表')}: {db.tables.length}
                {db.tables[0] && <span className="text-white/30"> · {db.tables[0].name}</span>}
              </p>
            </button>
          ))}
        </div>
      )}

      {/* 查询面板 */}
      {sel && (
        <div className="glass-strong p-5 rounded-2xl space-y-4">
          <div className="flex items-center gap-2 text-sm">
            <Terminal size={15} className="text-violet-300" />
            <span className="text-white/70 font-medium truncate flex-1">{sel.path}</span>
            <button onClick={() => setExpanded((m) => ({ ...m, [sel.path]: !m[sel.path] }))} className="text-white/40 hover:text-white/70 text-xs">
              {expanded[sel.path] ? t('sites.sql.hideSchema', '隐藏表结构') : t('sites.sql.showSchema', '表结构')}
            </button>
          </div>

          {expanded[sel.path] && (
            <div className="glass-input rounded-lg p-3 space-y-1.5">
              {sel.tables.map((tb) => (
                <div key={tb.name} className="flex items-center gap-2 text-xs">
                  <span className="text-violet-300 font-mono font-medium">{tb.name}</span>
                  <span className="text-white/40">{t('sites.sql.rows', '行数')} {tb.rows}</span>
                </div>
              ))}
            </div>
          )}

          <div>
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              rows={3}
              spellCheck={false}
              placeholder={t('sites.sql.placeholder', "SELECT * FROM table_name;")}
              className="glass-input w-full rounded-xl px-4 py-3 text-sm font-mono outline-none resize-y min-h-[60px]"
            />
          </div>

          <button
            onClick={runQuery}
            disabled={running}
            className="glass-btn-primary px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 disabled:opacity-50"
          >
            {running ? <Loader2 size={15} className="animate-spin" /> : <Terminal size={15} />}
            {t('sites.sql.run', '执行查询')}
          </button>

          {result?.error && (
            <pre className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg p-3 whitespace-pre-wrap overflow-x-auto">
              {result.error}
            </pre>
          )}

          {result && !result.error && (
            <div className="overflow-x-auto rounded-xl border border-white/10">
              {rows.length === 0 ? (
                <p className="text-sm text-white/40 py-6 text-center">{result.message || t('sites.sql.empty', '无数据')}</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="glass-table-head text-left">
                      {cols.map((c) => (
                        <th key={c} className="px-3 py-2 text-white/60 font-medium whitespace-nowrap">{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 100).map((r, i) => (
                      <tr key={i} className="glass-row border-t border-white/5">
                        {cols.map((c) => (
                          <td key={c} className="px-3 py-1.5 text-white/80 whitespace-nowrap max-w-[280px] overflow-hidden text-ellipsis">
                            {String(r[c])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {rows.length > 100 && (
                <p className="text-xs text-white/40 py-2 px-3">{t('sites.sql.moreRows', '仅显示前 100 行')} · {result.count} {t('sites.sql.rows', '行数')}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- 主组件 ----------
const Sites = () => {
  const { t } = useI18n();
  const [tab, setTab] = useState('nginx');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-violet-200 bg-clip-text text-transparent flex items-center gap-2">
          <FileWarning size={24} className="text-white/60" />
          {t('sites.title', '站点管理')}
        </h1>
        <p className="text-white/50">{t('sites.subtitle', 'Nginx 站点 · SQLite 数据库管理')}</p>
      </div>

      {/* Tab 切换 */}
      <div className="flex gap-2">
        {[['nginx', 'Nginx', Server], ['sql', 'SQLite', Database]].map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn('px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-all border',
              tab === key
                ? 'bg-gradient-to-br from-violet-500/25 to-indigo-500/15 border-violet-500/40 text-white shadow-[0_0_20px_rgba(139,92,246,0.15)]'
                : 'border-white/10 text-white/50 hover:text-white/80 hover:border-white/25')}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {tab === 'nginx' ? <NginxTab /> : <SqlTab />}
    </div>
  );
};

export default Sites;
