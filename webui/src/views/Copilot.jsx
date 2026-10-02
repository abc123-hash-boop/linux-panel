import React, { useState, useEffect, useRef } from 'react';
import apiClient from '../api/client';
import { Send, Bot, User, Sparkles, Settings, MessageSquare, Loader2 } from 'lucide-react';

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
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [providers, setProviders] = useState([]);
  const [dbProviders, setDbProviders] = useState([]);
  const [activeProvider, setActiveProvider] = useState(null);
  const [allModels, setAllModels] = useState({});
  const [activeModel, setActiveModel] = useState('');
  const [fetching, setFetching] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const providersRef = useRef([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editKey, setEditKey] = useState('');
  const [savingKey, setSavingKey] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('');
  const [newBase, setNewBase] = useState('');
  const [savingNew, setSavingNew] = useState(false);

  const addProvider = async () => {
    if (!newName.trim() || !newBase.trim()) return;
    setSavingNew(true);
    try {
      await apiClient.post('/copilot/providers', { name: newName.trim(), icon: newIcon.trim(), api_base: newBase.trim() });
      await loadProviders();
      // 用 ref 获取最新 providers
      const last = providersRef.current[providersRef.current.length - 1];
      if (last) { setActiveProvider(last); setAllModels({}); }
    } catch (e) { console.error(e); } finally { setSavingNew(false); setShowAddForm(false); setNewName(''); setNewIcon(''); setNewBase(''); }
  };

  useEffect(() => { loadSessions(); loadProviders(); }, []);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { if (activeSessionId) loadSessionMessages(); }, [activeSessionId]);

  const loadSessions = async () => {
    try {
      const res = await apiClient.get('/copilot/sessions');
      const list = Array.isArray(res.data) ? res.data : [];
      setSessions(list);
      if (list.length > 0 && !activeSessionId) setActiveSessionId(list[0].id);
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
      const res = await apiClient.post('/copilot/sessions', { name: '新对话' });
      setSessions(prev => [...prev, { id: res.data.id, name: '新对话', model: 'gpt-4o' }]);
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
      if (activeSessionId === sid) setActiveSessionId(remaining[0]?.id || null);
    } catch {}
  };

  const loadProviders = async () => {
    try {
      const res = await apiClient.get('/copilot/providers');
      const db = Array.isArray(res.data) ? res.data : [];
      setDbProviders(db);
      const merged = PRESET_PROVIDERS.map(p => {
        const found = db.find(d => d.name === p.name);
        return found ? { ...found, _preset: true } : { id: 0, name: p.name, icon: p.icon, api_base: p.api_base, api_key: '', _preset: true };
      });
      db.filter(d => !PRESET_PROVIDERS.find(p => p.name === d.name)).forEach(d => {
        merged.push({ ...d, _preset: false });
      });
      setProviders(merged);
      providersRef.current = merged;
      // 保存后选最后一个（新添加的），初始加载选第一个
      setActiveProvider(merged[afterSave ? merged.length - 1 : 0]);
    } catch {}
  };

  const loadModels = async (prov) => {
    if (!prov?.api_base) return {};
    if (allModels[prov.id]) return allModels[prov.id];
    try {
      const res = await apiClient.post('/copilot/fetch-models', { api_base: prov.api_base, api_key: prov.api_key || '' });
      if (Array.isArray(res.data)) {
        setAllModels(prev => ({ ...prev, [prov.id]: res.data }));
        return res.data;
      }
    } catch {}
    return [];
  };

  const saveApiKey = async (prov) => {
    if (!prov || !prov.id || prov._preset) return;
    setSavingKey(prov.id);
    try {
      await apiClient.put(`/copilot/provider/${prov.id}`, { name: prov.name, icon: prov.icon, api_base: prov.api_base, models: prov.models || [], api_key: editKey });
      const updated = { ...prov, api_key: editKey };
      setActiveProvider(updated);
      setProviders(prev => prev.map(p => p.id === prov.id ? updated : p));
      setDbProviders(prev => prev.map(p => p.id === prov.id ? updated : p));
    } catch {} finally { setSavingKey(null); }
  };

  const selectModel = async (prov) => {
    setActiveProvider(prov);
    const models = await loadModels(prov);
    const session = sessions.find(s => s.id === activeSessionId);
    if (models.length > 0 && (!session?.model || !models.includes(session.model))) {
      setActiveModel(models[0]);
    } else if (models.length === 0 && session?.model) {
      setActiveModel(session.model);
    }
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;
    if (!activeProvider) { setError('请先选择 Provider'); return; }
    if (!activeProvider.api_key) { setError('请先在设置中填写 API Key'); setSettingsOpen(true); return; }
    if (!activeProvider.api_base) { setError('请先在设置中填写 Base URL'); setSettingsOpen(true); return; }

    setError('');
    const session = sessions.find(s => s.id === activeSessionId);
    const model = session?.model || activeModel || allModels[activeProvider.id]?.[0] || 'gpt-4o';

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
      // 保存 model 到 session
      if (model && model !== (session?.model || '')) {
        updateSession(activeSessionId, { model });
      }
    } catch (err) {
      setError(err.message || '请求失败');
      setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ ${err.message}` }]);
    } finally { setLoading(false); }
  };

  const handleKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } };

  return (
    <div className="flex h-[calc(100vh-80px)] gap-3">
      {/* 侧栏 */}
      <div className="w-52 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col overflow-hidden shrink-0">
        <div className="px-3 py-3 border-b border-gray-100 flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-500 uppercase">会话</span>
          <button onClick={createSession} className="p-1.5 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"><MessageSquare size={14} /></button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {sessions.map(s => (
            <div key={s.id} onClick={() => setActiveSessionId(s.id)}
              className={`group flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors ${activeSessionId === s.id ? 'bg-violet-50 border-r-2 border-violet-500' : ''}`}>
              <MessageSquare size={14} className="text-gray-400 shrink-0" />
              <span className="flex-1 text-sm text-gray-700 truncate">{s.name}</span>
              <button onClick={e => { e.stopPropagation(); deleteSession(s.id); }}
                className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 rounded transition-all"><Sparkles size={12} className="rotate-45" /></button>
            </div>
          ))}
          {sessions.length === 0 && <div className="px-3 py-6 text-center text-xs text-gray-400">暂无会话</div>}
        </div>
      </div>

      {/* 主聊天区 */}
      <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden min-w-0">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg flex items-center justify-center shrink-0">
            <Sparkles className="text-white" size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-gray-800">Copilot</h1>
            <p className="text-xs text-gray-400 truncate">
              {activeProvider ? `${activeProvider.icon} ${activeProvider.name}` : '未选择'}
              {' · '}
              {activeModel || '—'}
            </p>
          </div>
          <button onClick={() => setSettingsOpen(!settingsOpen)} className="p-2 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors">
            <Settings size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-3">
              <div className="w-12 h-12 bg-violet-100 rounded-xl flex items-center justify-center"><Sparkles className="text-violet-500" size={24} /></div>
              <p className="text-sm">开始与 Copilot 对话</p>
              <p className="text-xs text-gray-300">右侧设置中选择 Provider 和 API Key</p>
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

        <div className="p-4 border-t border-gray-100">
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
              placeholder="输入消息… (Enter 发送，Shift+Enter 换行)"
              className="flex-1 resize-none border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              disabled={loading}
            />
            <button onClick={sendMessage} disabled={loading || !input.trim()}
              className="px-4 bg-violet-600 text-white rounded-xl hover:bg-violet-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center">
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* ===== 设置面板 ===== */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) setSettingsOpen(false); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden max-h-[85vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-violet-50 to-purple-50 shrink-0">
              <div>
                <h2 className="font-bold text-gray-800 text-lg">Model Providers</h2>
                <p className="text-xs text-gray-400 mt-0.5">从服务端下拉选择并配置 API Key</p>
              </div>
              <button onClick={() => setSettingsOpen(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Provider 选择 */}
              <div className="flex gap-2 items-start">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">选择 Provider</label>
                  <select
                    value={activeProvider?.id || ''}
                    onChange={e => {
                      const id = parseInt(e.target.value);
                      const prov = providers.find(p => p.id === id);
                      if (prov) selectModel(prov);
                    }}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-violet-500 bg-white"
                  >
                    {providers.map(p => (
                      <option key={p.id} value={p.id}>{p.icon} {p.name}{p._preset ? ' (预设)' : ''}</option>
                    ))}
                  </select>
                </div>
                <button onClick={() => setShowAddForm(!showAddForm)}
                  className="mt-7 px-3 bg-violet-600 text-white rounded-lg text-sm hover:bg-violet-700 transition-colors whitespace-nowrap">
                  + 新建
                </button>
              </div>

              {/* 新建 Provider 表单 */}
              {showAddForm && (
                <div className="p-4 bg-gray-50 rounded-lg space-y-3">
                  <div className="flex gap-2">
                    <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="名称" maxLength={30}
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-violet-500" />
                    <input type="text" value={newIcon} onChange={e => setNewIcon(e.target.value)} placeholder="图标" maxLength={2}
                      className="w-16 px-2 py-2 border border-gray-200 rounded-lg text-sm text-center outline-none focus:ring-2 focus:ring-violet-500" />
                  </div>
                  <input type="text" value={newBase} onChange={e => setNewBase(e.target.value)} placeholder="API Base URL (https://...)"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono outline-none focus:ring-2 focus:ring-violet-500" />
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setShowAddForm(false)} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">取消</button>
                    <button onClick={addProvider} disabled={savingNew || !newName.trim() || !newBase.trim()}
                      className="px-3 py-1.5 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50">
                      {savingNew ? '创建中...' : '创建'}
                    </button>
                  </div>
                </div>
              )}

              {activeProvider && (
                <>
                  {/* Base URL */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">API Base URL</label>
                    <input type="text" value={activeProvider.api_base || ''}
                      onChange={e => setActiveProvider({ ...activeProvider, api_base: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono outline-none focus:ring-2 focus:ring-violet-500" />
                  </div>

                  {/* API Key */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">API Key</label>
                    <div className="flex gap-2">
                      <input type="password" value={editKey !== undefined ? editKey : (activeProvider.api_key || '')}
                        onChange={e => setEditKey(e.target.value)}
                        placeholder="sk-..."
                        className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono outline-none focus:ring-2 focus:ring-violet-500" />
                      {!activeProvider._preset && (
                        <button onClick={() => { saveApiKey({ ...activeProvider, api_key: editKey }); setEditKey(''); }}
                          disabled={savingKey === activeProvider.id}
                          className="px-3 bg-violet-600 text-white rounded-lg text-sm hover:bg-violet-700 disabled:opacity-50 transition-colors">
                          {savingKey === activeProvider.id ? <Loader2 size={14} className="animate-spin" /> : '保存'}
                        </button>
                      )}
                    </div>
                    {activeProvider._preset && <p className="text-xs text-gray-400 mt-1">预设 Provider，Key 仅保存在本地会话</p>}
                  </div>

                  {/* Model 选择 */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Model</label>
                    <select
                      value={activeModel}
                      onChange={e => setActiveModel(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-violet-500 bg-white"
                    >
                      {allModels[activeProvider.id]?.length > 0 ? (
                        allModels[activeProvider.id].map(m => <option key={m} value={m}>{m}</option>)
                      ) : (
                        <option value="">加载中...</option>
                      )}
                    </select>
                    {allModels[activeProvider.id]?.length === 0 && !fetching && (
                      <button onClick={() => { setFetching(true); loadModels(activeProvider).finally(() => setFetching(false)); }}
                        className="mt-1 text-xs text-violet-600 hover:underline">重新加载模型列表</button>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end shrink-0">
              <button onClick={() => setSettingsOpen(false)} className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors">完成</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CopilotView;
