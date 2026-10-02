import React, { useState, useEffect, useRef } from 'react';
import apiClient from '../api/client';
import { Send, Bot, User, Sparkles, Settings, MessageSquare, Loader2, Plus, Trash2, ArrowLeftRight } from 'lucide-react';

const PRESET_PROVIDERS = [
  { name: 'OpenAI', icon: '🟢', api_base: 'https://api.openai.com/v1' },
  { name: 'Azure OpenAI', icon: '🔵', api_base: '' },
  { name: 'Anthropic', icon: '🟠', api_base: 'https://api.anthropic.com/v1' },
  { name: 'DeepSeek', icon: '🔷', api_base: 'https://api.deepseek.com/v1' },
  { name: '通义千问', icon: '🟣', api_base: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
  { name: 'Moonshot', icon: '🌙', api_base: 'https://api.moonshot.cn/v1' },
  { name: '硅基流动', icon: '⚡', api_base: 'https://api.siliconflow.cn/v1' },
];

const MAX_CONTEXT_TOKENS = 8000;

const CopilotView = () => {
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [providers, setProviders] = useState([]);
  const [activeProvider, setActiveProvider] = useState(null);
  const [allModels, setAllModels] = useState({});
  const [activeModel, setActiveModel] = useState('');
  const [fetching, setFetching] = useState(false);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editKey, setEditKey] = useState('');
  const [savingKey, setSavingKey] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('');
  const [newBase, setNewBase] = useState('');
  const [savingNew, setSavingNew] = useState(false);

  // 跨会话回忆：选中哪些其他会话作为上下文
  const [recallSessions, setRecallSessions] = useState([]);

  const messagesEndRef = useRef(null);
  const activeSessionIdRef = useRef(null);

  useEffect(() => { activeSessionIdRef.current = activeSessionId; }, [activeSessionId]);

  useEffect(() => { loadSessions(); loadProviders(); }, []);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => {
    if (activeSessionIdRef.current) loadSessionMessages();
  }, [activeSessionId]);
  useEffect(() => {
    if (activeProvider?.api_base) {
      setAllModels(prev => ({ ...prev, [activeProvider.id]: undefined }));
      loadModels(activeProvider);
    }
  }, [activeProvider?.id]);

  const loadSessions = async () => {
    try {
      const res = await apiClient.get('/copilot/sessions');
      const list = Array.isArray(res.data) ? res.data : [];
      setSessions(list);
      if (list.length > 0 && !activeSessionId) {
        setActiveSessionId(list[0].id);
        restoreSessionConfig(list[0]);
      }
    } catch {}
  };

  const restoreSessionConfig = (session) => {
    if (!session) return;
    // 恢复 provider（通过 api_base 匹配）
    if (session.api_base) {
      const prov = providers.find(p => p.api_base === session.api_base);
      if (prov) {
        setActiveProvider({ ...prov, api_key: session.api_key || '' });
        return;
      }
    }
    // 如果没有匹配的 provider，创建一个临时的
    if (session.api_base) {
      setActiveProvider({
        id: -1, name: '自定义', icon: '🔧',
        api_base: session.api_base, api_key: session.api_key || '', _preset: false
      });
    }
    // 恢复 model
    if (session.model) setActiveModel(session.model);
  };

  const loadSessionMessages = async () => {
    try {
      const res = await apiClient.get(`/copilot/history?session_id=${activeSessionId}`);
      if (Array.isArray(res.data)) setMessages(res.data);
    } catch {}
  };

  const createSession = async () => {
    try {
      const res = await apiClient.post('/copilot/sessions', { name: '新对话' });
      const newSession = { id: res.data.id, name: res.data.name, model: res.data.model, api_key: res.data.api_key, api_base: res.data.api_base, recall_sessions: res.data.recall_sessions || '[]' };
      setSessions(prev => [...prev, newSession]);
      setActiveSessionId(res.data.id);
      setMessages([]);
      setRecallSessions(JSON.parse(newSession.recall_sessions || '[]'));
      setActiveProvider({ ...newSession, _preset: false });
      if (res.data.model) setActiveModel(res.data.model);
    } catch {}
  };

  const deleteSession = async (sid) => {
    try {
      await apiClient.delete(`/copilot/session/${sid}`);
      const remaining = sessions.filter(s => s.id !== sid);
      setSessions(remaining);
      if (activeSessionId === sid) {
        setActiveSessionId(remaining[0]?.id || null);
        setMessages([]);
        setRecallSessions([]);
      }
    } catch {}
  };

  const loadProviders = async (afterSave) => {
    try {
      const res = await apiClient.get('/copilot/providers');
      const db = Array.isArray(res.data) ? res.data : [];
      const merged = PRESET_PROVIDERS.map(p => {
        const found = db.find(d => d.name === p.name);
        return found ? { ...found, _preset: true } : { id: 0, name: p.name, icon: p.icon, api_base: p.api_base, api_key: '', _preset: true };
      });
      db.filter(d => !PRESET_PROVIDERS.find(p => p.name === d.name)).forEach(d => {
        merged.push({ ...d, _preset: false });
      });
      setProviders(merged);
      if (afterSave) {
        setActiveProvider(merged[merged.length - 1]);
      } else if (merged.length > 0 && !activeProvider) {
        setActiveProvider(merged[0]);
      }
    } catch {}
  };

  const loadModels = async (prov) => {
    if (!prov?.api_base) return [];
    if (allModels[prov.id] !== undefined) return allModels[prov.id];
    try {
      const res = await apiClient.post('/copilot/fetch-models', { api_base: prov.api_base, api_key: prov.api_key || '' });
      if (Array.isArray(res.data)) {
        setAllModels(prev => ({ ...prev, [prov.id]: res.data }));
        return res.data;
      }
    } catch {}
    return [];
  };

  const addProvider = async () => {
    if (!newName.trim() || !newBase.trim()) return;
    setSavingNew(true);
    try {
      await apiClient.post('/copilot/providers', { name: newName.trim(), icon: newIcon.trim(), api_base: newBase.trim() });
      await loadProviders(true);
    } catch (e) { console.error(e); } finally { setSavingNew(false); setShowAddForm(false); setNewName(''); setNewIcon(''); setNewBase(''); }
  };

  const saveApiKey = async () => {
    if (!activeProvider) return;
    setSavingKey(activeProvider.id);
    try {
      // 保存到 provider（仅自定义 provider）
      if (!activeProvider._preset) {
        await apiClient.put(`/copilot/provider/${activeProvider.id}`, { name: activeProvider.name, icon: activeProvider.icon, api_base: activeProvider.api_base, models: [], api_key: editKey });
      }
      // 保存到当前会话
      const updated = { ...activeProvider, api_key: editKey };
      setActiveProvider(updated);
      setProviders(prev => prev.map(p => p.id === activeProvider.id ? updated : p));
      if (activeSessionId) {
        await apiClient.put(`/copilot/session/${activeSessionId}`, { name: '', model: activeModel, api_base: activeProvider.api_base });
        setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, api_base: activeProvider.api_base } : s));
      }
    } catch {} finally { setSavingKey(null); }
  };

  const selectProvider = async (prov) => {
    setActiveProvider(prov);
    // 自动选择缓存中的第一个模型
    if (allModels[prov.id]?.length > 0 && !activeModel) {
      setActiveModel(allModels[prov.id][0]);
    }
  };

  const toggleRecallSession = (sid) => {
    setRecallSessions(prev => prev.includes(sid) ? prev.filter(x => x !== sid) : [...prev, sid]);
  };

  const saveRecallConfig = async () => {
    if (!activeSessionId) return;
    await apiClient.put(`/copilot/session/${activeSessionId}`, { recall_sessions: JSON.stringify(recallSessions) });
    setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, recall_sessions: JSON.stringify(recallSessions) } : s));
  };

  const getContextTokens = () => {
    // 估算 token 数：中文约 1 字 1 token，英文约 4 字符 1 token
    let tokens = 0;
    messages.forEach(m => {
      tokens += m.content.length; // 粗略估算
    });
    // 加上 recall 会话的消息
    recallSessions.forEach(sid => {
      const session = sessions.find(s => s.id === sid);
      if (session) tokens += 200; // 每个 recall 会话约 200 token
    });
    return tokens;
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;
    if (!activeProvider) { setError('请先在设置中选择 Provider'); return; }
    if (!activeProvider.api_key) { setError('请先在设置中填写 API Key'); setSettingsOpen(true); return; }
    if (!activeProvider.api_base) { setError('请先在设置中填写 Base URL'); setSettingsOpen(true); return; }

    setError('');
    const session = sessions.find(s => s.id === activeSessionId);
    const model = activeModel || session?.model || allModels[activeProvider.id]?.[0] || 'gpt-4o';

    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setInput('');
    setLoading(true);

    const history = [...messages.slice(-20), { role: 'user', content: text }];

    try {
      const res = await apiClient.post('/copilot/chat', {
        session_id: activeSessionId,
        model: activeModel,
        messages: history.map(m => ({ role: m.role, content: m.content })),
        recall_sessions: recallSessions,
      });
      const rawReply = res.data.reply || '（无回复）';
      const reply = typeof rawReply === 'string' ? rawReply.replace(/[<|][a-z_|]+[>|]|\n/g, ' ').trim() : rawReply;
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
      if (res.data.model) {
        setActiveModel(res.data.model);
        setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, model: res.data.model } : s));
      }
      const histRes = await apiClient.get(`/copilot/history?session_id=${activeSessionId}`);
      if (Array.isArray(histRes.data)) setMessages(histRes.data);
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || '请求失败';
      setError(msg);
      setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ ${msg}` }]);
    } finally { setLoading(false); }
  };

  const handleKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } };

  const contextTokens = getContextTokens();
  const contextPercent = Math.min(100, Math.round((contextTokens / MAX_CONTEXT_TOKENS) * 100));

  return (
    <div className="flex h-[calc(100vh-80px)] gap-3">
      {/* 侧栏 */}
      <div className="w-56 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col overflow-hidden shrink-0">
        <div className="px-3 py-3 border-b border-gray-100 flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-500 uppercase">会话</span>
          <button onClick={createSession} className="p-1.5 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors" title="新建会话"><Plus size={14} /></button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {sessions.map(s => (
            <div key={s.id} onClick={() => { setActiveSessionId(s.id); setRecallSessions([]); }}
              className={`group flex items-center gap-1.5 px-3 py-2 cursor-pointer hover:bg-gray-50 transition-colors ${activeSessionId === s.id ? 'bg-violet-50 border-r-2 border-violet-500' : ''}`}>
              <MessageSquare size={13} className="text-gray-400 shrink-0" />
              <span className="flex-1 text-xs text-gray-700 truncate">{s.name}</span>
              {activeSessionId === s.id && (
                <button onClick={e => { e.stopPropagation(); deleteSession(s.id); }}
                  className="p-0.5 text-gray-400 hover:text-red-500 rounded transition-colors shrink-0"><Trash2 size={11} /></button>
              )}
            </div>
          ))}
          {sessions.length === 0 && <div className="px-3 py-6 text-center text-xs text-gray-400">暂无会话</div>}
        </div>

        {/* 跨会话回忆入口 */}
        {sessions.length > 1 && (
          <div className="px-3 py-2 border-t border-gray-100">
            <button onClick={() => setSettingsOpen(true)} className="flex items-center gap-1.5 w-full text-xs text-gray-500 hover:text-violet-600 transition-colors">
              <ArrowLeftRight size={12} />
              <span>回忆 {(() => { const s = sessions.find(x => x.id === activeSessionId); return JSON.parse(s?.recall_sessions || '[]').length; })()}</span>
            </button>
          </div>
        )}
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
          {!activeSessionId && (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-3">
              <div className="w-12 h-12 bg-violet-100 rounded-xl flex items-center justify-center"><Sparkles className="text-violet-500" size={24} /></div>
              <p className="text-sm">请选择或创建一个会话</p>
              <p className="text-xs text-gray-300">点击左侧 + 按钮创建新会话</p>
            </div>
          )}
          {activeSessionId && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-3">
              <div className="w-12 h-12 bg-violet-100 rounded-xl flex items-center justify-center"><Sparkles className="text-violet-500" size={24} /></div>
              <p className="text-sm">开始与 Copilot 对话</p>
              <p className="text-xs text-gray-300">点击右上角 ⚙️ 选择 Provider</p>
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

        {/* 上下文窗口指示器 */}
        <div className="px-4 py-1.5 border-t border-gray-100 flex items-center gap-2">
          <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${contextPercent > 80 ? 'bg-red-500' : contextPercent > 50 ? 'bg-yellow-500' : 'bg-violet-500'}`}
              style={{ width: `${contextPercent}%` }} />
          </div>
          <span className="text-xs text-gray-400 shrink-0">{contextTokens.toLocaleString()} / {MAX_CONTEXT_TOKENS.toLocaleString()}</span>
          {recallSessions.length > 0 && (
            <span className="text-xs text-violet-500 shrink-0">+{recallSessions.length} 回忆会话</span>
          )}
        </div>

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
                <p className="text-xs text-gray-400 mt-0.5">选择 Provider 并配置 API Key</p>
              </div>
              <button onClick={() => setSettingsOpen(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Provider 选择 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">选择 Provider</label>
                <select
                  value={activeProvider?.id || ''}
                  onChange={e => {
                    const id = parseInt(e.target.value);
                    const prov = providers.find(p => p.id === id);
                    if (prov) selectProvider(prov);
                  }}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-violet-500 bg-white"
                >
                  {providers.map(p => (
                    <option key={p.id} value={p.id}>{p.icon} {p.name}{p._preset ? ' (预设)' : ''}</option>
                  ))}
                </select>
              </div>

              {/* 新建按钮 */}
              <button onClick={() => setShowAddForm(!showAddForm)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-violet-600 hover:bg-violet-50 rounded-lg transition-colors">
                <Plus size={14} /> 新建 Provider
              </button>

              {/* 新建表单 */}
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
                      onChange={e => {
                        const updated = { ...activeProvider, api_base: e.target.value };
                        setActiveProvider(updated);
                        setProviders(prev => prev.map(p => p.id === activeProvider.id ? updated : p));
                      }}
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
                      <button onClick={saveApiKey}
                        disabled={savingKey === activeProvider.id}
                        className="px-3 bg-violet-600 text-white rounded-lg text-sm hover:bg-violet-700 disabled:opacity-50 transition-colors">
                        {savingKey === activeProvider.id ? <Loader2 size={14} className="animate-spin" /> : '保存'}
                      </button>
                    </div>
                  </div>

                  {/* Model 输入 */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Model</label>
                    <input type="text" value={activeModel}
                      onChange={e => {
                        setActiveModel(e.target.value);
                        if (activeSessionId) {
                          apiClient.put(`/copilot/session/${activeSessionId}`, { model: e.target.value })
                            .then(r => {
                              setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, model: e.target.value } : s));
                            })
                            .catch(() => {});
                        }
                      }}
                      placeholder="如：gpt-4o, claude-3-5-sonnet..."
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono outline-none focus:ring-2 focus:ring-violet-500" />
                  </div>

                  {/* 从 API 获取的模型 */}
                  {allModels[activeProvider.id] !== undefined && allModels[activeProvider.id].length > 0 && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">可用模型（点击选中）</label>
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {allModels[activeProvider.id].map(m => (
                          <button key={m} onClick={() => setActiveModel(m)}
                            className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${activeModel === m ? 'bg-violet-100 text-violet-700' : 'hover:bg-gray-50 text-gray-600'}`}>
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 加载/重试 */}
                  {allModels[activeProvider.id] === undefined && !fetching && activeProvider.api_base && (
                    <button onClick={() => { setFetching(true); loadModels(activeProvider).finally(() => setFetching(false)); }}
                      className="text-xs text-violet-600 hover:underline">加载模型列表</button>
                  )}
                  {fetching && <p className="text-xs text-gray-400">加载中...</p>}

                  {/* 跨会话回忆设置 */}
                  {sessions.length > 1 && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-2 flex items-center gap-1.5">
                        <ArrowLeftRight size={12} />跨会话回忆（初始化 prompt 注入）
                      </label>
                      <div className="max-h-32 overflow-y-auto space-y-1 border border-gray-200 rounded-lg p-2">
                        {sessions.filter(s => s.id !== activeSessionId).map(s => (
                          <label key={s.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer">
                            <input type="checkbox" checked={recallSessions.includes(s.id)} onChange={() => toggleRecallSession(s.id)}
                              className="rounded border-gray-300 text-violet-600 focus:ring-violet-500" />
                            <span className="text-xs text-gray-700">{s.name}</span>
                          </label>
                        ))}
                      </div>
                      <button onClick={saveRecallConfig}
                        className="mt-2 w-full py-1.5 text-xs bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors">
                        保存回忆配置
                      </button>
                      <p className="text-xs text-gray-400 mt-1">选中的会话最近 10 条消息将作为初始 prompt 上下文</p>
                    </div>
                  )}
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
