import React, { useState, useEffect, useRef } from 'react';
import apiClient from '../api/client';
import { Send, Bot, User, Sparkles, Plus, Trash2, Edit3, Save, X, Loader2, RefreshCw, Settings, ChevronRight, MessageSquare } from 'lucide-react';

const PRESET_PROVIDERS = [
  { name: 'OpenAI', icon: '🟢', api_base: 'https://api.openai.com/v1' },
  { name: 'Azure OpenAI', icon: '🔵', api_base: '' },
  { name: 'Anthropic', icon: '🟠', api_base: 'https://api.anthropic.com/v1' },
  { name: 'DeepSeek', icon: '🔷', api_base: 'https://api.deepseek.com/v1' },
  { name: '通义千问', icon: '🟣', api_base: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
  { name: 'Moonshot', icon: '🌙', api_base: 'https://api.moonshot.cn/v1' },
  { name: '硅基流动', icon: '⚡', api_base: 'https://api.siliconflow.cn/v1' },
];

const CopilotView = () => {
  // 会话
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 提供商/模型设置
  const [providers, setProviders] = useState([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeProvider, setActiveProvider] = useState(null);
  const [models, setModels] = useState([]);
  const [fetchingModels, setFetchingModels] = useState(false);

  // 新建/编辑提供商
  const [editProvider, setEditProvider] = useState(null);
  const [editName, setEditName] = useState('');
  const [editIcon, setEditIcon] = useState('');
  const [editAPIBase, setEditAPIBase] = useState('');
  const [modelInput, setModelInput] = useState('');
  const [savedModels, setSavedModels] = useState([]);
  const [saving, setSaving] = useState(false);

  // 删除确认
  const [deleteTarget, setDeleteTarget] = useState(null); // {type: 'session'|'provider', data}

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { loadSessions(); loadProviders(); }, []);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { if (activeProvider) fetchModels(activeProvider); }, [activeProvider]);
  useEffect(() => { if (activeSessionId) loadSessionMessages(); }, [activeSessionId]);

  const loadSessions = async () => {
    try {
      const res = await apiClient.get('/copilot/sessions');
      setSessions(res.data);
      if (res.data.length > 0 && !activeSessionId) setActiveSessionId(res.data[0].id);
    } catch {}
  };

  const loadSessionMessages = async () => {
    try {
      const res = await apiClient.get('/copilot/history');
      if (Array.isArray(res.data)) setMessages(res.data);
    } catch {}
  };

  const createSession = async () => {
    try {
      const res = await apiClient.post('/copilot/sessions', { name: `新对话 ${sessions.length + 1}` });
      setSessions(prev => [...prev, { id: res.data.id, name: res.data.name, model: 'gpt-4o', api_key: '', api_base: 'https://api.openai.com/v1' }]);
      setActiveSessionId(res.data.id);
    } catch {}
  };

  const updateSession = async (sid, data) => {
    try {
      await apiClient.put(`/copilot/session/${sid}`, data);
      setSessions(prev => prev.map(s => s.id === sid ? { ...s, ...data } : s));
    } catch {}
  };

  const deleteSession = async (sid) => {
    try {
      await apiClient.delete(`/copilot/session/${sid}`);
      const remaining = sessions.filter(s => s.id !== sid);
      setSessions(remaining);
      if (activeSessionId === sid) {
        setActiveSessionId(remaining[0]?.id || null);
      }
    } catch {}
    setDeleteTarget(null);
  };

  const renameSession = async (sid, name) => {
    try {
      await apiClient.put(`/copilot/session/${sid}`, { name });
      setSessions(prev => prev.map(s => s.id === sid ? { ...s, name } : s));
    } catch {}
  };

  // 提供商
  const loadProviders = async () => {
    try {
      const res = await apiClient.get('/copilot/providers');
      const dbProviders = res.data;
      // 合并预设
      const merged = PRESET_PROVIDERS.map(p => {
        const db = dbProviders.find(dp => dp.name === p.name);
        return db ? { ...db, _preset: false } : { id: 0, name: p.name, icon: p.icon, api_base: p.api_base, api_key: '', models: [], _preset: true };
      }).filter(p => !dbProviders.find(dp => dp.name === p.name && !p._preset));
      // 添加自定义
      dbProviders.filter(dp => !PRESET_PROVIDERS.find(pp => pp.name === dp.name)).forEach(p => {
        merged.push({ ...p, _preset: false });
      });
      setProviders(merged);
      if (!activeProvider && merged.length > 0) {
        setActiveProvider(merged[0]);
      }
    } catch {}
  };

  const fetchModels = async (prov) => {
    if (!prov.api_base) return;
    setFetchingModels(true);
    setModels([]);
    try {
      const res = await apiClient.post('/copilot/fetch-models', { api_base: prov.api_base, api_key: prov.api_key || '' });
      if (Array.isArray(res.data)) setModels(res.data);
    } catch {} finally { setFetchingModels(false); }
  };

  const saveProvider = async () => {
    if (!editName.trim() || !editAPIBase.trim()) return;
    setSaving(true);
    try {
      const payload = { name: editName.trim(), icon: editIcon.trim(), api_base: editAPIBase.trim(), models: savedModels };
      if (editProvider) {
        await apiClient.put(`/copilot/provider/${editProvider.id}`, payload);
      } else {
        await apiClient.post('/copilot/providers', payload);
      }
      setEditProvider(null);
      await loadProviders();
    } catch (e) { console.error(e); } finally { setSaving(false); }
  };

  const deleteProvider = async (prov) => {
    try {
      await apiClient.delete(`/copilot/provider/${prov.id}`);
      setProviders(prev => prev.filter(p => p.id !== prov.id));
      if (activeProvider?.id === prov.id) setActiveProvider(null);
    } catch {}
    setDeleteTarget(null);
  };

  const selectModel = (m) => {
    setSavedModels(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);
  };

  // 发送消息
  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;
    if (!activeProvider) { setError('请先在 Providers 中选择提供商'); setSettingsOpen(true); return; }
    if (!activeProvider.api_key) { setError('该提供商缺少 API Key，请在提供商设置中填写'); setSettingsOpen(true); return; }
    if (!activeProvider.api_base) { setError('该提供商缺少 API Base URL'); setSettingsOpen(true); return; }

    setError('');
    const session = sessions.find(s => s.id === activeSessionId);
    const model = session?.model || (models[0] || 'gpt-4o');

    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setInput('');
    setLoading(true);

    const history = [...messages.slice(-20), { role: 'user', content: text }];
    try {
      const res = await fetch(`${activeProvider.api_base}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${activeProvider.api_key}` },
        body: JSON.stringify({
          model,
          messages: [{ role: 'system', content: '你是一个专业的 Linux 服务器管理助手。请简洁、准确地回答用户的问题。使用中文回答。' }, ...history.map(m => ({ role: m.role, content: m.content }))],
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
      try { await apiClient.post('/copilot/history', [...history, { role: 'assistant', content: reply }]); } catch {}
    } catch (err) {
      setError(err.message || '请求失败');
      setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ ${err.message}` }]);
    } finally { setLoading(false); }
  };

  const handleKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } };

  return (
    <div className="flex h-[calc(100vh-80px)] gap-3">
      {/* ===== 会话侧栏 ===== */}
      <div className="w-52 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col overflow-hidden shrink-0">
        <div className="px-3 py-3 border-b border-gray-100 flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">会话</span>
          <button onClick={createSession} className="p-1 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors" title="新建会话">
            <Plus size={14} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {sessions.map(s => (
            <div key={s.id} className={`group flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors ${activeSessionId === s.id ? 'bg-violet-50 border-r-2 border-violet-500' : ''}`}
              onClick={() => setActiveSessionId(s.id)}>
              <MessageSquare size={14} className="text-gray-400 shrink-0" />
              <span className="flex-1 text-sm text-gray-700 truncate">{s.name}</span>
              <button onClick={e => { e.stopPropagation(); setDeleteTarget({ type: 'session', data: s }); }}
                className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 rounded transition-all">
                <Trash2 size={12} />
              </button>
            </div>
          ))}
          {sessions.length === 0 && (
            <div className="px-3 py-6 text-center text-xs text-gray-400">暂无会话</div>
          )}
        </div>
        {/* 当前会话信息 */}
        {sessions.find(s => s.id === activeSessionId) && (
          <div className="px-3 py-2 border-t border-gray-100">
            <input
              type="text"
              value={sessions.find(s => s.id === activeSessionId)?.name || ''}
              onChange={e => renameSession(activeSessionId, e.target.value)}
              onBlur={() => renameSession(activeSessionId, sessions.find(s => s.id === activeSessionId)?.name || '')}
              className="w-full text-xs bg-transparent text-gray-500 outline-none border-b border-transparent hover:border-gray-200 focus:border-violet-400 transition-colors"
              placeholder="重命名会话..."
            />
          </div>
        )}
      </div>

      {/* ===== 主聊天区 ===== */}
      <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden min-w-0">
        {/* Header */}
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg flex items-center justify-center shrink-0">
            <Sparkles className="text-white" size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-gray-800">Copilot</h1>
            <p className="text-xs text-gray-400 truncate">
              {activeProvider ? `${activeProvider.icon} ${activeProvider.name}` : '未选择提供商'}
              {' · '}
              {sessions.find(s => s.id === activeSessionId)?.model || '—'}
            </p>
          </div>
          <button onClick={() => setSettingsOpen(true)} className="p-2 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors" title="Providers & Models">
            <Settings size={18} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-3">
              <div className="w-12 h-12 bg-violet-100 rounded-xl flex items-center justify-center"><Sparkles className="text-violet-500" size={24} /></div>
              <p className="text-sm">开始与 Copilot 对话</p>
              <p className="text-xs text-gray-300">点击右上角齿轮配置 Provider 和 Model</p>
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

        {error && <div className="mx-4 mb-2 px-4 py-2 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">{error}</div>}

        {/* Input */}
        <div className="p-4 border-t border-gray-100">
          <div className="flex gap-2">
            <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown} rows={2}
              placeholder="输入消息… (Enter 发送，Shift+Enter 换行)"
              className="flex-1 resize-none border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              disabled={loading} />
            <button onClick={sendMessage} disabled={loading || !input.trim()}
              className="px-4 bg-violet-600 text-white rounded-xl hover:bg-violet-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center">
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* ===== Providers & Models 弹窗 ===== */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) setSettingsOpen(false); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-violet-50 to-purple-50 shrink-0">
              <div>
                <h2 className="font-bold text-gray-800 text-lg">Model Providers</h2>
                <p className="text-xs text-gray-400 mt-0.5">管理 API 提供商与可用模型</p>
              </div>
              <button onClick={() => setSettingsOpen(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>

            <div className="flex flex-1 overflow-hidden">
              {/* 左列：提供商列表 */}
              <div className="w-64 border-r border-gray-100 overflow-y-auto p-3 flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-500 uppercase">Providers</span>
                  <button onClick={() => { setEditProvider({ _new: true }); setEditName(''); setEditIcon(''); setEditAPIBase(''); setSavedModels([]); }}
                    className="p-1.5 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors" title="添加">
                    <Plus size={14} />
                  </button>
                </div>
                {providers.map(p => (
                  <div key={p.id || p.name} onClick={() => { if (!p._new) setActiveProvider(p); }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg mb-1 cursor-pointer transition-all ${activeProvider?.id === p.id ? 'bg-violet-100 text-violet-700' : 'hover:bg-gray-50 text-gray-700'}`}>
                    <span className="text-base">{p.icon || '⚙️'}</span>
                    <span className="flex-1 text-sm font-medium truncate">{p.name}</span>
                    {p.models?.length > 0 && <span className="text-xs text-gray-400">{p.models.length}</span>}
                    {!p._preset && (
                      <button onClick={e => { e.stopPropagation(); setEditProvider(p); setEditName(p.name); setEditIcon(p.icon); setEditAPIBase(p.api_base); setSavedModels(p.models?.map(m => m.name) || []); }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 hover:text-blue-500 rounded"><Edit3 size={11} /></button>
                    )}
                  </div>
                ))}
              </div>

              {/* 右列：模型管理 */}
              <div className="flex-1 overflow-y-auto p-4">
                {activeProvider ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
                      <span className="text-lg">{activeProvider.icon}</span>
                      <div>
                        <h3 className="font-semibold text-gray-800">{activeProvider.name}</h3>
                        <p className="text-xs text-gray-400 font-mono truncate max-w-xs">{activeProvider.api_base || '未设置 Base URL'}</p>
                      </div>
                      <div className="ml-auto flex gap-1">
                        <button onClick={() => fetchModels(activeProvider)} disabled={fetchingModels || !activeProvider.api_base}
                          className="p-2 text-gray-400 hover:text-violet-600 disabled:opacity-40 rounded-lg transition-colors" title="从 API 获取模型">
                          <RefreshCw size={14} className={fetchingModels ? 'animate-spin' : ''} />
                        </button>
                      </div>
                    </div>

                    {/* API Key */}
                    {activeProvider._preset && (
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">API Key</label>
                        <input type="password" value={activeProvider.api_key || ''}
                          onChange={e => { const p = { ...activeProvider, api_key: e.target.value }; setActiveProvider(p); }}
                          placeholder="sk-..." className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono outline-none focus:ring-2 focus:ring-violet-500" />
                      </div>
                    )}

                    {/* 已获取的模型 */}
                    {models.length > 0 && (
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-2">已获取的模型 (点击选择)</label>
                        <div className="max-h-40 overflow-y-auto space-y-1">
                          {models.map(m => (
                            <button key={m} onClick={() => selectModel(m)}
                              className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${savedModels.includes(m) ? 'bg-violet-100 text-violet-700' : 'hover:bg-gray-50 text-gray-600'}`}>
                              {m}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 手动添加 */}
                    <div className="flex gap-2">
                      <input type="text" value={modelInput} onChange={e => setModelInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && modelInput.trim()) { selectModel(modelInput.trim()); setModelInput(''); } }}
                        placeholder="输入模型 ID 按 Enter 添加…"
                        className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono outline-none focus:ring-2 focus:ring-violet-500" />
                      <button onClick={() => { if (modelInput.trim()) { selectModel(modelInput.trim()); setModelInput(''); } }}
                        className="px-3 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200 transition-colors">添加</button>
                    </div>

                    {/* 已选模型 */}
                    {savedModels.length > 0 && (
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-2">已选模型</label>
                        <div className="flex flex-wrap gap-1">
                          {savedModels.map(m => (
                            <span key={m} className="inline-flex items-center gap-1 px-2 py-1 bg-violet-100 text-violet-700 rounded-md text-xs font-mono">
                              {m}
                              <button onClick={() => setSavedModels(prev => prev.filter(x => x !== m))} className="hover:text-red-500">×</button>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 保存按钮 */}
                    <button onClick={saveProvider} disabled={saving || !editName.trim()}
                      className="w-full py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                      {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                      保存 Provider
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <span className="text-3xl mb-2">⚙️</span>
                    <p className="text-sm">选择一个 Provider</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== 删除确认 ===== */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) setDeleteTarget(null); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <h3 className="font-bold text-gray-800 mb-2">确认删除</h3>
            <p className="text-sm text-gray-500 mb-6">确定要删除 "{deleteTarget.data.name}" 吗？</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm">取消</button>
              <button onClick={() => deleteTarget.type === 'session' ? deleteSession(deleteTarget.data.id) : deleteProvider(deleteTarget.data)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700">删除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CopilotView;
