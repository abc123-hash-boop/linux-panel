import React, { useState, useEffect, useRef } from 'react';
import apiClient from '../api/client';
import { Send, Settings as SettingsIcon, Bot, User, Sparkles, Plus, Trash2, Loader2, RefreshCw, Key, Globe, Cpu, ChevronDown } from 'lucide-react';

const DEFAULT_API_BASE = 'https://api.openai.com/v1';
const DEFAULT_MODEL = 'gpt-4o';

// 预设提供商
const PRESET_PROVIDERS = [
  { name: 'OpenAI', icon: '🟢', api_base: 'https://api.openai.com/v1' },
  { name: 'Azure OpenAI', icon: '🔵', api_base: '' },
  { name: 'Anthropic', icon: '🟠', api_base: 'https://api.anthropic.com/v1' },
  { name: 'DeepSeek', icon: '🔷', api_base: 'https://api.deepseek.com/v1' },
  { name: '通义千问', icon: '🟣', api_base: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
  { name: 'Moonshot', icon: '🌙', api_base: 'https://api.moonshot.cn/v1' },
  { name: '硅基流动', icon: '⚡', api_base: 'https://api.siliconflow.cn/v1' },
  { name: '自定义', icon: '⚙️', api_base: '' },
];

const CopilotView = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 设置弹窗
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [providersOpen, setProvidersOpen] = useState(false);

  // 当前选中的提供商 & 模型
  const [activeProvider, setActiveProvider] = useState(null);
  const [providers, setProviders] = useState([]);
  const [models, setModels] = useState([]);
  const [fetchingModels, setFetchingModels] = useState(false);

  // 当前编辑中的提供商表单
  const [editProvider, setEditProvider] = useState(null); // null = 新建
  const [editName, setEditName] = useState('');
  const [editIcon, setEditIcon] = useState('');
  const [editAPIKey, setEditAPIKey] = useState('');
  const [editAPIBase, setEditAPIBase] = useState(DEFAULT_API_BASE);
  const [savingProvider, setSavingProvider] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // 手动输入模型
  const [manualModel, setManualModel] = useState('');
  const [showManual, setShowManual] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { loadSettings(); loadHistory(); loadProviders(); }, []);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { if (activeProvider) fetchModels(activeProvider); }, [activeProvider]);

  const loadSettings = async () => {
    try {
      const res = await apiClient.get('/copilot/settings');
      const d = res.data;
      setEditAPIKey(d.api_key || '');
      setEditAPIBase(d.api_base || DEFAULT_API_BASE);
      if (d.model) {
        setManualModel(d.model);
        setShowManual(true);
      }
    } catch {}
  };

  const loadHistory = async () => {
    try {
      const res = await apiClient.get('/copilot/history');
      if (Array.isArray(res.data)) setMessages(res.data);
    } catch {}
  };

  const loadProviders = async () => {
    try {
      const res = await apiClient.get('/copilot/providers');
      setProviders(res.data);
      // 自动选中第一个
      if (res.data.length > 0 && !activeProvider) {
        setActiveProvider(res.data[0]);
      }
    } catch {}
  };

  const fetchModels = async (prov) => {
    if (!prov.api_base) return;
    setFetchingModels(true);
    setModels([]);
    try {
      const res = await apiClient.post('/copilot/fetch-models', {
        api_base: prov.api_base,
        api_key: prov.api_key,
      });
      if (Array.isArray(res.data)) setModels(res.data);
    } catch {
      // fetch failed, models stays empty
    } finally {
      setFetchingModels(false);
    }
  };

  const saveCurrentSettings = async () => {
    try {
      await apiClient.post('/copilot/settings', {
        api_key: editAPIKey,
        api_base: editAPIBase,
        model: manualModel,
      });
    } catch {}
  };

  // 打开新建/编辑提供商
  const openAddProvider = (prov) => {
    if (prov) {
      setEditProvider(prov);
      setEditName(prov.name);
      setEditIcon(prov.icon || '');
      setEditAPIKey(prov.api_key || '');
      setEditAPIBase(prov.api_base || '');
    } else {
      setEditProvider(null);
      setEditName('');
      setEditIcon('');
      setEditAPIKey('');
      setEditAPIBase(DEFAULT_API_BASE);
    }
  };

  const saveProvider = async () => {
    if (!editName.trim() || !editAPIBase.trim()) return;
    setSavingProvider(true);
    try {
      const updated = [...providers];
      const idx = updated.findIndex(p => p.name === editProvider?.name);
      const newProv = { name: editName.trim(), icon: editIcon.trim(), api_key: editAPIKey, api_base: editAPIBase.trim() };
      if (idx >= 0) updated[idx] = newProv;
      else updated.push(newProv);
      setProviders(updated);
      await apiClient.post('/copilot/providers', updated);
      // 同时保存当前 active
      setActiveProvider(newProv);
      setEditProvider(null);
      // 保存 settings
      await saveCurrentSettings();
    } catch (e) { console.error(e); } finally { setSavingProvider(false); }
  };

  const deleteProvider = async (prov) => {
    const updated = providers.filter(p => p.name !== prov.name);
    setProviders(updated);
    await apiClient.post('/copilot/providers', updated);
    if (activeProvider?.name === prov.name) {
      setActiveProvider(updated[0] || null);
    }
    setDeleteConfirm(null);
  };

  const selectModel = (mId) => {
    setManualModel(mId);
    setShowManual(false);
    saveCurrentSettings();
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;
    if (!editAPIKey) {
      setError('请先配置 API Key（点击右上角齿轮）');
      setSettingsOpen(true);
      return;
    }

    setError('');
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setInput('');
    setLoading(true);

    const history = [...messages.slice(-20), { role: 'user', content: text }];

    try {
      const res = await fetch(`${editAPIBase}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${editAPIKey}` },
        body: JSON.stringify({
          model: manualModel,
          messages: [
            { role: 'system', content: '你是一个专业的 Linux 服务器管理助手。请简洁、准确地回答用户的问题。使用中文回答。' },
            ...history.map(m => ({ role: m.role, content: m.content })),
          ],
          max_tokens: 2048,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error?.message || `API 错误 ${res.status}`);
      }

      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content || '（无回复）';
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);

      try {
        await apiClient.post('/copilot/history', [...history, { role: 'assistant', content: reply }]);
      } catch {}
    } catch (err) {
      setError(err.message || '请求失败');
      setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  return (
    <div className="flex h-[calc(100vh-80px)] gap-4">
      {/* ===== 主聊天区 ===== */}
      <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg flex items-center justify-center">
            <Sparkles className="text-white" size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-gray-800">Copilot</h1>
            <p className="text-xs text-gray-400 truncate">
              {activeProvider ? `${activeProvider.icon} ${activeProvider.name}` : '未选择提供商'}
              {manualModel && <span> · {manualModel}</span>}
            </p>
          </div>
          <button onClick={() => setProvidersOpen(true)} className="p-2 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors" title="Model Providers">
            <Cpu size={18} />
          </button>
          <button onClick={() => setSettingsOpen(true)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" title="设置">
            <SettingsIcon size={18} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-3">
              <div className="w-12 h-12 bg-violet-100 rounded-xl flex items-center justify-center"><Sparkles className="text-violet-500" size={24} /></div>
              <p className="text-sm">开始与 Copilot 对话</p>
              <p className="text-xs text-gray-300">支持 OpenAI 兼容 API · 可在 Providers 中切换提供商</p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-blue-500 text-white' : 'bg-violet-500 text-white'}`}>
                {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
              </div>
              <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap ${msg.role === 'user' ? 'bg-blue-500 text-white rounded-tr-sm' : 'bg-gray-100 text-gray-800 rounded-tl-sm'}`}>
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-violet-500 text-white flex items-center justify-center shrink-0"><Bot size={14} /></div>
              <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex gap-1.5">
                  {[0, 150, 300].map(d => <span key={d} className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />)}
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {error && (
          <div className="mx-4 mb-2 px-4 py-2 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">{error}</div>
        )}

        {/* Input */}
        <div className="p-4 border-t border-gray-100">
          <div className="flex gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
              placeholder="输入消息… (Enter 发送，Shift+Enter 换行)"
              className="flex-1 resize-none border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              disabled={loading}
            />
            <button onClick={sendMessage} disabled={loading || !input.trim()} className="px-4 bg-violet-600 text-white rounded-xl hover:bg-violet-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center">
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* ===== 设置侧栏 ===== */}
      {settingsOpen && (
        <div className="w-80 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">设置</h2>
            <button onClick={() => setSettingsOpen(false)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
          </div>
          <div className="p-5 space-y-4 flex-1 overflow-y-auto">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
              <div className="relative">
                <Key className="absolute left-3 top-2.5 text-gray-400" size={14} />
                <input type="password" value={editAPIKey} onChange={e => setEditAPIKey(e.target.value)} placeholder="sk-..." className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-violet-500 font-mono" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">API Base URL</label>
              <div className="relative">
                <Globe className="absolute left-3 top-2.5 text-gray-400" size={14} />
                <input type="text" value={editAPIBase} onChange={e => setEditAPIBase(e.target.value)} placeholder="https://api.openai.com/v1" className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-violet-500 font-mono" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Model ID</label>
              <input type="text" value={manualModel} onChange={e => { setManualModel(e.target.value); setShowManual(false); }} onFocus={() => setShowManual(true)} placeholder="输入模型名称…" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-violet-500 font-mono" />
              {showManual && (
                <div className="mt-1 max-h-40 overflow-y-auto border border-gray-200 rounded-lg">
                  {models.length > 0 && models.map(m => (
                    <button key={m} onClick={() => { selectModel(m); setShowManual(false); }} className="w-full text-left px-3 py-2 text-sm hover:bg-violet-50 text-gray-700 first-rounded">{m}</button>
                  ))}
                  {!showManual && models.length === 0 && <div className="px-3 py-2 text-xs text-gray-400">在 Providers 中选择提供商以获取模型列表</div>}
                </div>
              )}
            </div>
            <button onClick={saveCurrentSettings} className="w-full py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors">保存设置</button>
          </div>
        </div>
      )}

      {/* ===== Model Providers 弹窗 ===== */}
      {providersOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) setProvidersOpen(false); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-violet-50 to-purple-50">
              <div>
                <h2 className="font-bold text-gray-800 text-lg">Model Providers</h2>
                <p className="text-xs text-gray-400 mt-0.5">管理 API 提供商及可用模型</p>
              </div>
              <button onClick={() => setProvidersOpen(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>

            {/* Provider list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {PRESET_PROVIDERS.map(p => {
                const isCustom = p.name === '自定义';
                const existing = providers.find(pr => pr.name === p.name && !isCustom);
                const isActive = activeProvider?.name === p.name && !isCustom;
                return (
                  <div key={p.name} className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all cursor-pointer ${isActive ? 'border-violet-400 bg-violet-50' : 'border-gray-100 hover:border-gray-200'}`}
                    onClick={() => !isCustom && setActiveProvider(existing || null)}>
                    <span className="text-xl">{p.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 text-sm">{p.name}</p>
                      {existing && <p className="text-xs text-gray-400 truncate">{existing.api_base}</p>}
                    </div>
                    {isActive && <div className="w-2 h-2 rounded-full bg-violet-500" />}
                    {isCustom && (
                      <button onClick={e => { e.stopPropagation(); openAddProvider(); }} className="p-1.5 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors" title="添加自定义">
                        <Plus size={14} />
                      </button>
                    )}
                    {!isCustom && existing && (
                      <button onClick={e => { e.stopPropagation(); openAddProvider(existing); }} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="编辑">
                        <SettingsIcon size={14} />
                      </button>
                    )}
                  </div>
                );
              })}

              {/* 已保存的自定义提供商 */}
              {providers.filter(p => !PRESET_PROVIDERS.find(pp => pp.name === p.name)).map(p => (
                <div key={p.name} className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all cursor-pointer ${activeProvider?.name === p.name ? 'border-violet-400 bg-violet-50' : 'border-gray-100 hover:border-gray-200'}`}
                  onClick={() => setActiveProvider(p)}>
                  <span className="text-xl">{p.icon || '⚙️'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 text-sm">{p.name}</p>
                    <p className="text-xs text-gray-400 truncate">{p.api_base}</p>
                  </div>
                  {activeProvider?.name === p.name && <div className="w-2 h-2 rounded-full bg-violet-500" />}
                  <button onClick={e => { e.stopPropagation(); openAddProvider(p); }} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><SettingsIcon size={14} /></button>
                  <button onClick={e => { e.stopPropagation(); setDeleteConfirm(p); }} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>

            {/* 模型列表 */}
            {activeProvider && (
              <div className="border-t border-gray-100 p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-gray-600">可用模型</p>
                  <button onClick={() => fetchModels(activeProvider)} disabled={fetchingModels || !activeProvider.api_base} className="p-1.5 text-gray-400 hover:text-violet-600 disabled:opacity-40 transition-colors">
                    <RefreshCw size={14} className={fetchingModels ? 'animate-spin' : ''} />
                  </button>
                </div>
                {fetchingModels ? (
                  <div className="text-xs text-gray-400 text-center py-3">加载中…</div>
                ) : models.length > 0 ? (
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {models.map(m => (
                      <button key={m} onClick={() => selectModel(m)} className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${manualModel === m ? 'bg-violet-100 text-violet-700' : 'hover:bg-gray-50 text-gray-600'}`}>{m}</button>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-gray-400 text-center py-2">
                    {activeProvider.api_base
                      ? <button onClick={() => fetchModels(activeProvider)} className="text-violet-600 hover:underline">点击刷新获取模型列表</button>
                      : '请先填写 Base URL'}
                  </div>
                )}
                {/* 手动输入 */}
                <div className="mt-2 flex gap-2">
                  <input type="text" value={manualModel} onChange={e => { setManualModel(e.target.value); setShowManual(false); }} placeholder="或手动输入模型 ID…"
                    className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-mono outline-none focus:ring-1 focus:ring-violet-500" />
                  <button onClick={() => { selectModel(manualModel); }} className="px-3 bg-violet-600 text-white rounded-lg text-xs hover:bg-violet-700">确定</button>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="px-6 py-3 border-t border-gray-100 flex justify-end">
              <button onClick={() => setProvidersOpen(false)} className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors">完成</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== 编辑/新建 Provider 弹窗 ===== */}
      {editProvider !== undefined && editProvider !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) { setEditProvider(null); setEditName(''); } }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-800">{editProvider?.name ? '编辑提供商' : '添加提供商'}</h3>
              <button onClick={() => setEditProvider(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">名称</label>
                  <input type="text" value={editName} onChange={e => setEditName(e.target.value)} placeholder="如：MyProvider" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-violet-500" />
                </div>
                <div className="w-16">
                  <label className="block text-sm font-medium text-gray-700 mb-1">图标</label>
                  <input type="text" value={editIcon} onChange={e => setEditIcon(e.target.value)} placeholder="🏢" maxLength={2} className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm text-center outline-none focus:ring-2 focus:ring-violet-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">API Base URL</label>
                <input type="text" value={editAPIBase} onChange={e => setEditAPIBase(e.target.value)} placeholder="https://api.example.com/v1" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-violet-500 font-mono" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                <input type="password" value={editAPIKey} onChange={e => setEditAPIKey(e.target.value)} placeholder="sk-..." className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-violet-500 font-mono" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => { setEditProvider(null); setEditName(''); }} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm">取消</button>
              <button onClick={saveProvider} disabled={savingProvider || !editName.trim() || !editAPIBase.trim()} className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                {savingProvider ? <Loader2 size={14} className="inline animate-spin" /> : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== 删除确认 ===== */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) setDeleteConfirm(null); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <h3 className="font-bold text-gray-800 mb-2">删除提供商</h3>
            <p className="text-sm text-gray-500 mb-6">确定要删除 "{deleteConfirm.name}" 吗？</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm">取消</button>
              <button onClick={() => deleteProvider(deleteConfirm)} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700">删除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CopilotView;
