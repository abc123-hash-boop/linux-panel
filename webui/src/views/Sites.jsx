import React, { useState, useEffect } from 'react';
import {
  Server,
  RefreshCw,
  Play,
  Square,
  RotateCw,
  CheckCircle2,
  XCircle,
  Search,
  FileWarning,
  Loader2,
  Trash2,
  Wrench,
  Zap,
  ShieldCheck, Pencil, X, Database, Plus, Copy,
} from 'lucide-react';
import apiClient from '../api/client';
import { useI18n } from '../i18n';

const cn = (...classes) => classes.filter(Boolean).join(' ');

// ---------- Nginx Tab ----------
const QUICK_TEMPLATES = [
  { key: 'static', label: 'Static Site', hint: '静态网站 (HTML/CSS/JS)' },
  { key: 'proxy', label: 'Reverse Proxy', hint: '反向代理 (Node/Python/...)' },
  { key: 'php', label: 'PHP App', hint: 'PHP 应用 (需安装 php-fpm)' },
  { key: 'loadbalance', label: 'Load Balancer', hint: '负载均衡 (多个后端)' },
  { key: 'redirect', label: 'Domain Redirect', hint: '域名 / URL 重定向' },
];

const TEMPLATE_CONTENT = {
  static: (name, domain, port) => `server {
    listen ${port};
    server_name ${domain};

    root /var/www/${name.replace('.conf', '')};
    index index.html index.htm;

    location / {
        try_files $uri $uri/ =404;
    }
}`,
  proxy: (name, domain, port, target) => `server {
    listen ${port};
    server_name ${domain};

    location / {
        proxy_pass ${target};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}`,
  php: (name, domain, port) => `server {
    listen ${port};
    server_name ${domain};

    root /var/www/${name.replace('.conf', '')};
    index index.php index.html index.htm;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \\.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/run/php/php-fpm.sock;
    }

    location ~ /\\.ht {
        deny all;
    }
}`,

  loadbalance: (name, domain, port, targets) => {
    const nodes = String(targets || '').split(/[\n,;]+/).map(x => x.trim()).filter(Boolean);
    const upstream = `panel_${name.replace(/[^A-Za-z0-9_]/g, '_')}`;
    return `upstream ${upstream} {\n${nodes.map(node => `    server ${node};`).join('\n')}\n}\n\nserver {\n    listen ${port};\n    server_name ${domain};\n\n    location / {\n        proxy_pass http://${upstream};\n        proxy_set_header Host $host;\n        proxy_set_header X-Real-IP $remote_addr;\n        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n        proxy_set_header X-Forwarded-Proto $scheme;\n    }\n}`;
  },
  redirect: (name, domain, port, target) => `server {\n    listen ${port};\n    server_name ${domain};\n    return 301 ${target}$request_uri;\n}`,

};
function NginxTab() {
  const { t } = useI18n();
  const [status, setStatus] = useState(null);
  const [sites, setSites] = useState([]);
  const [busy, setBusy] = useState(null); // {site, action}
  const [actionMsg, setActionMsg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createMode, setCreateMode] = useState('quick'); // 'quick' | 'expert'
  const [newSiteName, setNewSiteName] = useState('');
  const [quickDomain, setQuickDomain] = useState('example.com');
  const [quickPort, setQuickPort] = useState('80');
  const [quickTemplate, setQuickTemplate] = useState('static');
  const [quickTarget, setQuickTarget] = useState('http://127.0.0.1:3000');
  const [createDatabase, setCreateDatabase] = useState(false);
  const [databaseName, setDatabaseName] = useState('');
  const [databaseUser, setDatabaseUser] = useState('');
  const [databasePassword, setDatabasePassword] = useState('');
  const [newSiteContent, setNewSiteContent] = useState('');
  const [createErr, setCreateErr] = useState(null);
  const [search, setSearch] = useState('');
  const [siteFilter, setSiteFilter] = useState('all');
  const [editingSite, setEditingSite] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [editVersion, setEditVersion] = useState('');
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState('');

  // 更新快速建站的配置内容（支持 DB 字段）
  const updateQuickContent = () => {
    setNewSiteContent(
      TEMPLATE_CONTENT[quickTemplate](
        newSiteName || 'mysite',
        quickDomain,
        quickPort,
        quickTarget
      )
    );
  };

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

  // Rebuild the quick template after React state changes. Calling the builder
  // directly inside onChange handlers reads stale state and can generate the
  // previous site name/template/root (causing PHP sites to serve the wrong dir).
  useEffect(() => {
    if (createMode === 'quick') updateQuickContent();
  }, [newSiteName, quickDomain, quickPort, quickTemplate, quickTarget, createMode]);

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
  const filteredSites = sites.filter((site) => {
    const q = search.trim().toLowerCase();
    const matches = !q || [site.name, site.domains, site.path, site.root, site.proxy_target]
      .some((v) => String(v || '').toLowerCase().includes(q));
    return matches && (siteFilter === 'all' || (siteFilter === 'enabled' ? site.enabled : siteFilter === 'ssl' ? site.ssl : site.kind === siteFilter));
  });
  const openEditor = async (site) => {
    setEditingSite(site); setEditError(''); setEditContent('');
    try {
      const res = await apiClient.get('/sites/nginx/site/' + encodeURIComponent(site.name) + '/config');
      setEditContent(res.data.content || '');
      setEditVersion(res.data.resourceVersion || '');
    } catch (e) { setEditError(e.response?.data?.error || String(e)); }
  };
  const saveEditor = async () => {
    if (!editingSite) return;
    setEditBusy(true); setEditError('');
    try {
      await apiClient.put('/sites/nginx/site/' + encodeURIComponent(editingSite.name) + '/config', { content: editContent, resourceVersion: editVersion });
      setEditingSite(null); setActionMsg({ ok: true, text: '配置已保存，Nginx 已重载' }); fetchAll();
    } catch (e) { setEditError(e.response?.data?.error || String(e)); }
    finally { setEditBusy(false); }
  };

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
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                <Zap size={15} className="text-violet-300" />
                {t('sites.nginx.createSite', '新建 Nginx 站点')}
              </h4>
              {/* 模式切换 */}
              <div className="flex gap-1">
                <button
                  onClick={() => {
                    setCreateMode('quick');
                    updateQuickContent();
                  }}
                  className={cn('px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all',
                    createMode === 'quick'
                      ? 'bg-gradient-to-br from-violet-500/25 to-indigo-500/15 border border-violet-500/40 text-white'
                      : 'border border-white/10 text-white/50 hover:text-white/80')}
                >
                  <Zap size={12} />
                  {t('sites.nginx.quickMode', '简易模式')}
                </button>
                <button
                  onClick={() => setCreateMode('expert')}
                  className={cn('px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all',
                    createMode === 'expert'
                      ? 'bg-gradient-to-br from-violet-500/25 to-indigo-500/15 border border-violet-500/40 text-white'
                      : 'border border-white/10 text-white/50 hover:text-white/80')}
                >
                  <Wrench size={12} />
                  {t('sites.nginx.expertMode', '专家模式')}
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs text-white/60 block mb-1">{t('sites.nginx.siteName', '配置文件名 (如 mysite.conf)')}</label>
              <input
                type="text"
                value={newSiteName}
                onChange={(e) => {
                  const v = e.target.value;
                  setNewSiteName(v);
                  if (createMode === 'quick') {
                    updateQuickContent();
                  }
                }}
                placeholder="mysite.conf"
                className="glass-input w-full px-3 py-2 rounded-lg text-sm outline-none"
              />
            </div>

            {createMode === 'quick' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-white/60 block mb-1">{t('sites.nginx.template', '站点类型')}</label>
                  <div className="flex flex-col gap-1.5">
                    {QUICK_TEMPLATES.map((tpl) => (
                      <button
                        key={tpl.key}
                        onClick={() => {
                          setQuickTemplate(tpl.key);
                          updateQuickContent();
                        }}
                        className={cn('px-3 py-1.5 rounded-lg text-xs flex items-center justify-between transition-all text-left',
                          quickTemplate === tpl.key
                            ? 'bg-violet-500/15 border border-violet-500/40 text-white'
                            : 'border border-white/10 text-white/50 hover:text-white/80')}
                      >
                        <span>{tpl.label}</span>
                        <span className="text-white/30 text-[10px]">{tpl.hint}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-white/60 block mb-1">{t('sites.nginx.domain', '域名 (server_name)')}</label>
                  <input
                    type="text"
                    value={quickDomain}
                    onChange={(e) => {
                      setQuickDomain(e.target.value);
                      updateQuickContent();
                    }}
                    placeholder="example.com"
                    className="glass-input w-full px-3 py-2 rounded-lg text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-white/60 block mb-1">{t('sites.nginx.port', '端口')}</label>
                  <input
                    type="text"
                    value={quickPort}
                    onChange={(e) => {
                      setQuickPort(e.target.value);
                      updateQuickContent();
                    }}
                    placeholder="80"
                    className="glass-input w-full px-3 py-2 rounded-lg text-sm outline-none"
                  />
                </div>
                {(quickTemplate === 'proxy' || quickTemplate === 'loadbalance' || quickTemplate === 'redirect') && (
                  <div className="md:col-span-3">
                    <label className="text-xs text-white/60 block mb-1">{quickTemplate === 'loadbalance' ? '后端节点（每行一个，例如 127.0.0.1:3000）' : quickTemplate === 'redirect' ? '跳转目标（例如 https://www.example.com）' : t('sites.nginx.proxyTarget', '代理目标 (如 http://127.0.0.1:3000)')}</label>
                    <input
                      type="text"
                      value={quickTarget}
                      onChange={(e) => {
                        setQuickTarget(e.target.value);
                        updateQuickContent();
                      }}
                      placeholder={quickTemplate === 'loadbalance' ? '127.0.0.1:3000\n127.0.0.1:3001' : quickTemplate === 'redirect' ? 'https://www.example.com' : 'http://127.0.0.1:3000'}
                      className="glass-input w-full px-3 py-2 rounded-lg text-sm outline-none"
                    />
                  </div>
                )}
              </div>
            )}

            {createMode === 'quick' && quickTemplate === 'php' && (() => {
              const base = (newSiteName || 'mysite').replace(/\.conf$/i, '').toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/^[^a-z]+/, '') || 'mysite';
              const suggested = base.slice(0, 48);
              const suggestedUser = base.slice(0, 32);
              return (
                <div className="md:col-span-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 space-y-3">
                  <label className="flex items-center gap-2 text-sm text-white">
                    <input type="checkbox" checked={createDatabase} onChange={e => setCreateDatabase(e.target.checked)} />
                    为此 PHP 站点创建附加 MariaDB 数据库
                    <span className="text-xs text-white/40">（可选，默认关闭）</span>
                  </label>
                  {createDatabase && <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div><label className="block text-xs text-white/60 mb-1">数据库名</label>
                      <input value={databaseName || suggested} onChange={e => setDatabaseName(e.target.value)} className="glass-input w-full rounded-lg px-3 py-2 text-sm" /></div>
                    <div><label className="block text-xs text-white/60 mb-1">数据库用户名</label>
                      <input value={databaseUser || suggestedUser} maxLength={32} onChange={e => setDatabaseUser(e.target.value)} className="glass-input w-full rounded-lg px-3 py-2 text-sm" /></div>
                    <div><label className="block text-xs text-white/60 mb-1">数据库密码（留空自动生成）</label>
                      <input type="password" autoComplete="new-password" value={databasePassword} onChange={e => setDatabasePassword(e.target.value)} placeholder="自动生成安全密码" className="glass-input w-full rounded-lg px-3 py-2 text-sm" /></div>
                    <p className="md:col-span-3 text-xs text-white/45">将创建独立数据库用户，仅授予该数据库的权限。密码只在创建成功时显示一次；删除站点配置不会删除数据库。</p>
                  </div>}
                </div>
              );
            })()}

            <div>
              <label className="text-xs text-white/60 block mb-1">
                {t('sites.nginx.siteContent', 'Nginx 配置内容')}
                {createMode === 'quick' && <span className="text-white/30 ml-2">({t('sites.nginx.autoGen', '自动生成的配置')})</span>}
              </label>
              <textarea
                value={newSiteContent}
                onChange={(e) => setNewSiteContent(e.target.value)}
                rows={createMode === 'expert' ? 10 : 6}
                spellCheck={false}
                readOnly={createMode === 'quick'}
                className={cn('glass-input w-full px-3 py-2 rounded-lg text-xs font-mono outline-none resize-y',
                  createMode === 'quick' ? 'bg-white/5 text-white/70' : '')}
              />
            </div>

            {createErr && <p className="text-xs text-red-300">{createErr}</p>}
            <div className="flex justify-end gap-2">
              <button onClick={() => { setShowCreate(false); setCreateErr(null); }} className="glass-btn px-3 py-1.5 rounded-lg text-xs text-white/70">
                {t('sites.cancel', '取消')}
              </button>
              <button
                onClick={async () => {
                  if (!window.confirm(t('sites.nginx.createConfirm', '确定创建站点 "{name}"？').replace('{name}', newSiteName || 'mysite'))) return;
                  const name = newSiteName.trim() ? (newSiteName.endsWith('.conf') ? newSiteName : newSiteName + '.conf') : '';
                  if (!name) { setCreateErr(t('sites.nginx.nameRequired', '请填写配置文件名')); return; }
                  if (!/^[A-Za-z0-9_.-]+\.conf$/.test(name) || name.includes('..')) {
                    setCreateErr('配置文件名仅允许字母、数字、点、下划线和连字符'); return;
                  }
                  if (createMode === 'quick') {
                    const domain = quickDomain.trim();
                    if (!domain || !/^[A-Za-z0-9*._-]+$/.test(domain) || domain.includes('..')) {
                      setCreateErr('请输入有效域名或 server_name'); return;
                    }
                    const port = Number(quickPort);
                    if (!Number.isInteger(port) || port < 1 || port > 65535) {
                      setCreateErr('端口必须是 1-65535 之间的整数'); return;
                    }
                    if (quickTemplate === 'proxy' || quickTemplate === 'redirect') {
                      try {
                        const url = new URL(quickTarget.trim());
                        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || /[\r\n;]/.test(quickTarget)) throw new Error('invalid');
                      } catch { setCreateErr(quickTemplate === 'redirect' ? '请输入有效的 HTTP/HTTPS 跳转目标' : '请输入有效的 HTTP/HTTPS 代理目标'); return; }
                    }
                    if (quickTemplate === 'loadbalance') {
                      const nodes = quickTarget.split(/[\n,;]+/).map(x => x.trim()).filter(Boolean);
                      if (nodes.length < 2 || nodes.some(x => !/^(?:[A-Za-z0-9.-]+|\[[0-9A-Fa-f:]+\]):[0-9]{1,5}$/.test(x) || Number(x.split(':').pop()) > 65535 || Number(x.split(':').pop()) < 1)) {
                        setCreateErr('负载均衡至少需要两个有效后端，格式为 host:port'); return;
                      }
                    }
                  }
                  try {
                    setCreateErr(null);
                    const base = (name.replace(/\.conf$/i, '').toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/^[^a-z]+/, '') || 'mysite').slice(0, 48);
                    const payload = { name, content: newSiteContent };
                    if (createDatabase && createMode === 'quick' && quickTemplate === 'php') {
                      payload.createDatabase = true;
                      payload.databaseName = databaseName || base;
                      payload.databaseUser = databaseUser || base;
                      payload.databasePassword = databasePassword;
                    }
                    const res = await apiClient.post('/sites/nginx/site/create', payload);
                    const db = res.data?.database;
                    const info = [t('sites.nginx.createOk', '创建成功！')];
                    if (db) info.push(`MariaDB: ${db.database}\n用户: ${db.username}\n密码: ${db.password}\n主机: ${db.host}\n\n请立即复制并妥善保存密码，此密码不会再次显示。`);
                    alert(info.join('\n\n'));
                    setShowCreate(false);
                    setNewSiteName('');
                    setQuickDomain('example.com');
                    setQuickPort('80');
                    setQuickTemplate('static');
                    setQuickTarget('http://127.0.0.1:3000');
                    setCreateDatabase(false); setDatabaseName(''); setDatabaseUser(''); setDatabasePassword('');
                    setNewSiteContent('');
                    fetchAll();
                  } catch (e) {
                    setCreateErr(e.response?.data?.error || String(e));
                  }
                }}
                className="glass-btn-primary px-4 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5"
              >
                <CheckCircle2 size={13} />
                {t('sites.saveCreate', '创建并重载')}
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
          {[
            ['全部站点', sites.length, 'all'],
            ['运行配置', sites.filter(x => x.enabled).length, 'enabled'],
            ['反向代理', sites.filter(x => x.kind === 'proxy').length, 'proxy'],
            ['SSL', sites.filter(x => x.ssl).length, 'ssl'],
          ].map(([label, count, key]) => (
            <button key={key} onClick={() => setSiteFilter(key)}
              className={cn('glass-input rounded-xl p-3 text-left transition-colors', siteFilter === key && 'border border-violet-400/40 bg-violet-500/10')}>
              <p className="text-xs text-white/45">{label}</p><p className="text-xl font-semibold text-white mt-1">{count}</p>
            </button>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/35" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索域名、配置文件或目录…"
              className="glass-input w-full rounded-lg py-2 pl-9 pr-3 text-sm outline-none" />
          </div>
          <select value={siteFilter} onChange={e => setSiteFilter(e.target.value)} className="glass-input rounded-lg px-3 py-2 text-sm">
            <option value="all">全部类型</option><option value="enabled">仅启用</option><option value="ssl">已配置 SSL</option>
            <option value="static">静态网站</option><option value="php">PHP 网站</option>
            <option value="proxy">反向代理</option><option value="loadbalance">负载均衡</option><option value="redirect">域名重定向</option><option value="custom">自定义配置</option>
          </select>
        </div>
        {editingSite && (
          <div className="mb-4 glass-input rounded-xl border border-violet-400/30 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div><p className="text-sm font-semibold text-white">编辑 Nginx 配置</p><p className="text-xs text-white/40">{editingSite.path}</p></div>
              <button onClick={() => setEditingSite(null)} className="glass-btn p-2 rounded-lg"><X size={15}/></button>
            </div>
            <textarea value={editContent} onChange={e => setEditContent(e.target.value)} spellCheck={false} rows={16}
              className="glass-input w-full rounded-lg p-3 font-mono text-xs text-white/85 outline-none resize-y" />
            {editError && <pre className="text-xs text-red-300 whitespace-pre-wrap">{editError}</pre>}
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditingSite(null)} className="glass-btn px-3 py-2 rounded-lg text-xs">取消</button>
              <button onClick={saveEditor} disabled={editBusy} className="glass-btn-primary px-4 py-2 rounded-lg text-xs flex items-center gap-2">
                {editBusy && <Loader2 size={13} className="animate-spin"/>}保存并校验重载
              </button>
            </div>
          </div>
        )}
        {filteredSites.length === 0 ? (
          <p className="text-sm text-white/40 text-center py-8">{sites.length ? '没有匹配的站点' : (installed ? t('sites.nginx.noSites', '暂无站点配置') : t('sites.nginx.notInstalled', '未安装'))}</p>
        ) : (
          <div className="space-y-2">
            {filteredSites.map((s) => (
              <div key={s.path} className="glass-input px-4 py-3 rounded-xl space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                  <span className={cn('w-2 h-2 rounded-full shrink-0', s.enabled ? 'bg-green-400' : 'bg-white/20')} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{s.domains || s.name}</p>
                    <p className="text-xs text-white/40 truncate">{s.name} · {s.path}</p>
                  </div>
                  <span className="px-2 py-1 rounded-md text-[11px] bg-sky-500/10 text-sky-300">{({static:'静态网站',php:'PHP 网站',proxy:'反向代理',loadbalance:'负载均衡',redirect:'域名重定向',custom:'自定义'})[s.kind] || '自定义'}</span>
                  {s.ssl && <span className="px-2 py-1 rounded-md text-[11px] bg-emerald-500/10 text-emerald-300 flex items-center gap-1"><ShieldCheck size={12}/>SSL</span>}
                  <span className={cn('px-2 py-1 rounded-md text-[11px]', s.enabled ? 'bg-green-500/15 text-green-300' : 'bg-white/8 text-white/40')}>
                    {s.enabled ? '已启用' : '未启用'}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1 text-xs text-white/45 pl-5">
                  {s.root && <p className="truncate">网站目录：<span className="text-white/70">{s.root}</span></p>}
                  {s.proxy_target && <p className="truncate">代理目标：<span className="text-white/70">{s.proxy_target}</span></p>}
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <button onClick={() => openEditor(s)} className="glass-btn px-2.5 py-1.5 rounded-lg text-xs text-sky-300 flex items-center gap-1"><Pencil size={12}/>编辑配置</button>
                  <button onClick={() => doSite(s.name, s.enabled ? 'disable' : 'enable')} disabled={!!busy}
                    className={cn('glass-btn px-2.5 py-1.5 rounded-lg text-xs disabled:opacity-50', s.enabled ? 'text-amber-300' : 'text-green-300')}>
                    {s.enabled ? '停用' : '启用'}
                  </button>
                  <button onClick={() => { if (window.confirm('确定删除站点配置 ' + s.name + '？此操作不会删除网站文件。')) doSite(s.name, 'delete'); }}
                    disabled={!!busy} className="glass-btn px-2.5 py-1.5 rounded-lg text-xs text-red-300 disabled:opacity-50"><Trash2 size={12}/></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- MariaDB Management ----------
const MariaDBTab = () => {
  const [databases, setDatabases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ database: '', username: '', password: '' });
  const [credentials, setCredentials] = useState(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await apiClient.get('/sites/mariadb');
      setDatabases(data.databases || []);
    } catch (e) {
      setError(e.response?.data?.error || e.message || '无法读取 MariaDB 数据库');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault();
    setCreating(true); setError(''); setCredentials(null);
    try {
      const { data } = await apiClient.post('/sites/mariadb/create', form);
      setCredentials(data.credentials);
      setForm({ database: '', username: '', password: '' });
      await load();
    } catch (e) {
      setError(e.response?.data?.error || e.message || '创建数据库失败');
    } finally { setCreating(false); }
  };

  const remove = async (db, username) => {
    const warning = `确定删除数据库 ${db} 及用户 ${username}？此操作不可恢复，将永久删除数据库中的所有数据。`;
    if (!window.confirm(warning)) return;
    setError('');
    try {
      await apiClient.post('/sites/mariadb/delete', { database: db, username });
      await load();
    } catch (e) { setError(e.response?.data?.error || e.message || '删除数据库失败'); }
  };

  const copy = async (value) => {
    try { await navigator.clipboard.writeText(value); } catch { window.prompt('复制以下内容：', value); }
  };
  const update = (key, value) => setForm(old => ({ ...old, [key]: value }));
  const formatSize = (bytes) => {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${(bytes / Math.pow(1024, i)).toFixed(i ? 1 : 0)} ${units[i]}`;
  };

  return (
    <div className="space-y-4">
      <div className="glass-panel rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div><h2 className="text-base font-semibold text-white flex items-center gap-2"><Database size={17}/> MariaDB 数据库</h2>
            <p className="text-xs text-white/45 mt-1">创建独立数据库和专用用户，适用于 WordPress、PHP 应用等。</p></div>
          <button onClick={load} disabled={loading} className="glass-btn p-2 rounded-lg text-white/70"><RefreshCw size={15} className={loading ? 'animate-spin' : ''}/></button>
        </div>
        {error && <p className="text-sm text-red-300 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}
        <form onSubmit={create} className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <input required maxLength={64} pattern="[A-Za-z][A-Za-z0-9_]*" value={form.database} onChange={e => update('database', e.target.value)} placeholder="数据库名" className="glass-input rounded-lg px-3 py-2 text-sm" />
          <input required maxLength={32} pattern="[A-Za-z][A-Za-z0-9_]*" value={form.username} onChange={e => update('username', e.target.value)} placeholder="用户名（最多32位）" className="glass-input rounded-lg px-3 py-2 text-sm" />
          <input type="password" autoComplete="new-password" minLength={form.password ? 12 : undefined} maxLength={128} value={form.password} onChange={e => update('password', e.target.value)} placeholder="密码（留空自动生成）" className="glass-input rounded-lg px-3 py-2 text-sm" />
          <button type="submit" disabled={creating} className="glass-btn rounded-lg px-3 py-2 text-sm text-emerald-300 flex items-center justify-center gap-2 disabled:opacity-50"><Plus size={15}/>{creating ? '创建中…' : '创建数据库'}</button>
          <p className="md:col-span-4 text-[11px] text-white/40">名称以英文字母开头，只能包含字母、数字和下划线。用户只获得对应数据库的权限。密码留空时自动生成。</p>
        </form>
      </div>

      {credentials && <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-2">
        <div className="text-sm font-semibold text-emerald-200">数据库创建成功 — 请立即保存凭据</div>
        {[['数据库', credentials.database], ['用户名', credentials.username], ['密码', credentials.password], ['主机', '127.0.0.1']].map(([label, value]) => <div key={label} className="flex items-center gap-2 text-sm"><span className="w-16 text-white/50">{label}</span><code className="flex-1 min-w-0 break-all text-white">{value}</code><button onClick={() => copy(value)} className="glass-btn p-1.5 rounded-md text-white/70" title="复制"><Copy size={13}/></button></div>)}
        <p className="text-xs text-amber-200/80">密码仅在创建成功时显示一次，离开此页面后无法再次查看。</p>
        <button onClick={() => setCredentials(null)} className="text-xs text-white/50 underline">我已保存，关闭</button>
      </div>}

      <div className="glass-panel rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-white">数据库列表</h3><span className="text-xs text-white/40">{databases.length} 个数据库</span></div>
        {loading && databases.length === 0 ? <div className="text-sm text-white/40 py-6 text-center">正在加载…</div> : databases.length === 0 ? <div className="text-sm text-white/40 py-6 text-center">暂无业务数据库</div> : <div className="space-y-2">
          {databases.map(db => <div key={db.name} className="glass-input rounded-xl px-3 py-3 flex flex-wrap items-center gap-3">
            <Database size={17} className="text-sky-300"/><div className="flex-1 min-w-0"><div className="text-sm text-white font-medium break-all">{db.name}</div><div className="text-xs text-white/40 mt-1">{db.tables} 张表 · {formatSize(db.size)} · 用户：{db.users?.length ? db.users.join(', ') : '未检测到专用用户'}</div></div>
            {db.users?.length === 1 && <button onClick={() => remove(db.name, db.users[0])} className="glass-btn px-2.5 py-1.5 rounded-lg text-xs text-red-300 flex items-center gap-1"><Trash2 size={12}/>删除</button>}
            {db.users?.length > 1 && <span className="text-xs text-white/35">多个用户关联，暂不支持一键删除</span>}
          </div>)}
        </div>}
      </div>
    </div>
  );
};

// ---------- SQLite Management ----------
const SQLiteTab = () => {
  const [databases, setDatabases] = useState([]);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [created, setCreated] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try { const { data } = await apiClient.get('/sites/sql'); setDatabases(Array.isArray(data) ? data : []); }
    catch (e) { setError(e.response?.data?.error || e.message || '无法读取 SQLite 数据库'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault(); setError(''); setCreated(null);
    try {
      const { data } = await apiClient.post('/sites/sql/create', { name, password });
      setCreated(data); setName(''); setPassword(''); await load();
    } catch (e) { setError(e.response?.data?.error || e.message || '创建 SQLite 数据库失败'); }
  };
  const remove = async (db) => {
    if (!window.confirm(`确定删除 SQLite 数据库 ${db.path}？此操作不可恢复。`)) return;
    try { await apiClient.post('/sites/sql/delete', { path: db.path }); await load(); }
    catch (e) { setError(e.response?.data?.error || e.message || '删除失败'); }
  };
  const copy = async (value) => { try { await navigator.clipboard.writeText(value); } catch { window.prompt('复制以下内容：', value); } };

  return <div className="space-y-4">
    <div className="glass-panel rounded-2xl p-4 space-y-3">
      <div><h2 className="text-base font-semibold text-white">SQLite 数据库</h2><p className="text-xs text-white/45 mt-1">轻量级文件数据库，适合本地应用；PHP WordPress 等应用建议使用 MariaDB。</p></div>
      {error && <p className="text-sm text-red-300 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}
      <form onSubmit={create} className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <input required maxLength={64} value={name} onChange={e => setName(e.target.value)} placeholder="数据库文件名" className="glass-input rounded-lg px-3 py-2 text-sm" />
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="初始管理员密码（可留空）" className="glass-input rounded-lg px-3 py-2 text-sm" />
        <button type="submit" className="glass-btn rounded-lg px-3 py-2 text-sm text-emerald-300 flex items-center justify-center gap-2"><Plus size={15}/>创建 SQLite 数据库</button>
      </form>
    </div>
    {created && <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-2 text-sm"><div className="font-semibold text-emerald-200">SQLite 数据库创建成功</div><div className="break-all text-white/80">文件：{created.path}</div><div className="flex items-center gap-2"><span className="text-white/50">初始密码：</span><code className="break-all text-white">{created.password}</code><button onClick={() => copy(created.password)} className="glass-btn p-1.5 rounded-md"><Copy size={13}/></button></div><p className="text-xs text-amber-200/80">请立即保存密码。</p><button onClick={() => setCreated(null)} className="text-xs text-white/50 underline">关闭</button></div>}
    <div className="glass-panel rounded-2xl p-4 space-y-3"><div className="flex justify-between items-center"><h3 className="text-sm font-semibold text-white">SQLite 文件列表</h3><button onClick={load} disabled={loading} className="glass-btn p-2 rounded-lg text-white/70"><RefreshCw size={15} className={loading ? 'animate-spin' : ''}/></button></div>
      {databases.length === 0 ? <p className="text-sm text-white/40 text-center py-6">{loading ? '正在加载…' : '未发现 SQLite 数据库文件'}</p> : <div className="space-y-2">{databases.map(db => <div key={db.path} className="glass-input rounded-xl px-3 py-3 flex items-center gap-3"><Database size={17} className="text-sky-300"/><div className="flex-1 min-w-0"><div className="text-sm text-white break-all">{db.path}</div><div className="text-xs text-white/40 mt-1">{db.tables?.length || 0} 张表 · {formatBytes(db.size)}</div></div><button onClick={() => remove(db)} className="glass-btn px-2.5 py-1.5 rounded-lg text-xs text-red-300 flex items-center gap-1"><Trash2 size={12}/>删除</button></div>)}</div>}
    </div>
  </div>;
};

const formatBytes = (bytes = 0) => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, i)).toFixed(i ? 1 : 0)} ${units[i]}`;
};

// ---------- 主组件 ----------
const Sites = () => {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState('nginx');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-violet-200 bg-clip-text text-transparent flex items-center gap-2">
          <FileWarning size={24} className="text-white/60" />
          {t('sites.title', '站点管理')}
        </h1>
        <p className="text-white/50">{t('sites.subtitle', 'Nginx 站点与数据库管理')}</p>
      </div>
      <div className="flex gap-2 border-b border-white/10 pb-2">
        <button onClick={() => setActiveTab('nginx')} className={cn('px-4 py-2 rounded-lg text-sm', activeTab === 'nginx' ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white')}>Nginx 站点</button>
        <button onClick={() => setActiveTab('mariadb')} className={cn('px-4 py-2 rounded-lg text-sm flex items-center gap-2', activeTab === 'mariadb' ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white')}><Database size={15}/>MariaDB</button>
        <button onClick={() => setActiveTab('sqlite')} className={cn('px-4 py-2 rounded-lg text-sm flex items-center gap-2', activeTab === 'sqlite' ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white')}>SQLite</button>
      </div>
      {activeTab === 'nginx' ? <NginxTab /> : activeTab === 'mariadb' ? <MariaDBTab /> : <SQLiteTab />}
    </div>
  );
};

export default Sites;
