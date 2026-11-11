import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Globe, RefreshCw, Power, Loader2, Plus, X, LayoutList, Monitor } from 'lucide-react';
import { useI18n } from '../i18n';

const BrowserView = () => {
  const { t } = useI18n();
  const canvasRef = useRef(null);
  const pcRef = useRef(null);
  const inputWsRef = useRef(null);
  const sessionRef = useRef(null);
  const tabsRef = useRef([]); // 该 session 的所有 tab
  const activeTabIdRef = useRef(null); // 当前激活的 tab
  const stopStreamRef = useRef(null);

  // 帧重组状态：screencast 帧以 "frame-start" 元数据 + 分块二进制 发送
  const frameRef = useRef({ expected: 0, chunks: [], received: 0 });
  // 视口尺寸（Chrome 真实分辨率）与画面尺寸（WebRTC 视频分辨率），用于坐标换算
  const geomRef = useRef({ frameW: 0, frameH: 0, viewW: 1920, viewH: 1080 });

  const [sessionId, setSessionId] = useState('');
  const [status, setStatus] = useState('creating');
  const [error, setError] = useState('');
  const [url, setUrl] = useState('');
  const [currentUrl, setCurrentUrl] = useState('');
  const [fps, setFps] = useState(0);
  const [showTabs, setShowTabs] = useState(false);
  // true = 焦点在地址栏（键盘给地址栏）；false = 焦点在画面（键盘转发到 Chrome）
  const [urlFocused, setUrlFocused] = useState(true);
  const [hasHistory, setHasHistory] = useState(false);

  // tab 列表状态（与 refs 同步）
  const [tabList, setTabList] = useState([]);
  const [activeTabId, setActiveTabId] = useState(null);

  // 同步 refs
  useEffect(() => { tabsRef.current = tabList; activeTabIdRef.current = activeTabId; }, [tabList, activeTabId]);

  useEffect(() => {
    const stored = localStorage.getItem('browser_history');
    if (stored) {
      try {
        const history = JSON.parse(stored);
        const current = history.find(u => u.id === sessionId);
        if (current) {
          setUrl(current.url);
          setHasHistory(true);
        }
      } catch {}
    }
  }, []);

  const savePersistedUrl = useCallback((newUrl) => {
    let history = [];
    try {
      const stored = localStorage.getItem('browser_history');
      history = stored ? JSON.parse(stored) : [];
    } catch {}
    history = history.filter(u => u.id !== sessionId);
    history.push({ id: sessionId, url: newUrl, visitedAt: Date.now() });
    if (history.length > 20) history = history.slice(-20);
    localStorage.setItem('browser_history', JSON.stringify(history));
    setHasHistory(true);
  }, [sessionId]);

  const clearHistory = useCallback(() => {
    const stored = localStorage.getItem('browser_history');
    if (stored) {
      try {
        const history = JSON.parse(stored).filter(u => u.id !== sessionId);
        localStorage.setItem('browser_history', JSON.stringify(history));
        setHasHistory(false);
      } catch {}
    }
  }, [sessionId]);

  const restoreHistory = useCallback(() => {
    const stored = localStorage.getItem('browser_history');
    if (stored) {
      try {
        const history = JSON.parse(stored);
        const current = history.find(u => u.id === sessionId);
        if (current) {
          setUrl(current.url);
          return true;
        }
      } catch {}
    }
    return false;
  }, [sessionId]);

  /* ---------------- 画面渲染 ---------------- */
  const drawFrame = useCallback((bytes) => {
    const blob = new Blob([bytes], { type: 'image/jpeg' });
    const objUrl = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        if (canvas.width !== img.width || canvas.height !== img.height) {
          canvas.width = img.width;
          canvas.height = img.height;
        }
        geomRef.current.frameW = img.width;
        geomRef.current.frameH = img.height;
        canvas.getContext('2d').drawImage(img, 0, 0);
      }
      URL.revokeObjectURL(objUrl);
    };
    img.onerror = () => URL.revokeObjectURL(objUrl);
    img.src = objUrl;
  }, []);

  /* ---------------- WHIP 串流 ---------------- */
  const startStream = useCallback(async (sid) => {
    stopStreamRef.current?.();
    pcRef.current?.close();
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    pcRef.current = pc;
    const dc = pc.createDataChannel('screencast');
    dc.binaryType = 'arraybuffer';
    let frameCount = 0;
    const fpsTimer = setInterval(() => { setFps(frameCount); frameCount = 0; }, 1000);
    dc.onmessage = (ev) => {
      const st = frameRef.current;
      if (typeof ev.data === 'string') {
        try {
          const meta = JSON.parse(ev.data);
          if (meta.type === 'frame-start') { st.expected = meta.size; st.chunks = []; st.received = 0; }
        } catch {}
        return;
      }
      if (st.expected <= 0) return;
      st.chunks.push(new Uint8Array(ev.data));
      st.received += ev.data.byteLength;
      if (st.received >= st.expected) {
        const frame = new Uint8Array(st.expected);
        let off = 0;
        for (const c of st.chunks) {
          const take = Math.min(c.length, st.expected - off);
          frame.set(c.subarray(0, take), off);
          off += take;
          if (off >= st.expected) break;
        }
        st.expected = 0; st.chunks = []; st.received = 0;
        frameCount++; drawFrame(frame);
      }
    };
    stopStreamRef.current = () => clearInterval(fpsTimer);
    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      if (s === 'connected') setStatus('streaming');
      else if (s === 'failed' || s === 'closed') setStatus('disconnected');
    };
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await new Promise((resolve) => {
      if (pc.iceGatheringState === 'complete') return resolve();
      const check = () => {
        if (pc.iceGatheringState === 'complete') {
          pc.removeEventListener('icegatheringstatechange', check); resolve();
        }
      };
      pc.addEventListener('icegatheringstatechange', check);
      setTimeout(resolve, 8000);
    });
    const resp = await fetch(`/browser/sessions/${sid}/whip`, { method: 'POST', headers: { 'Content-Type': 'application/sdp' }, body: pc.localDescription.sdp, credentials: 'include' });
    if (!resp.ok) throw new Error(`WHIP 失败: HTTP ${resp.status}`);
    const answer = await resp.text();
    await pc.setRemoteDescription({ type: 'answer', sdp: answer });
    return () => { clearInterval(fpsTimer); if (pcRef.current === pc) pcRef.current = null; };
  }, [drawFrame]);

  /* ---------------- 输入通道 ---------------- */
  const startInput = useCallback((sid) => {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${window.location.host}/browser/sessions/${sid}/ws`);
    inputWsRef.current = ws;
  }, []);

  const sendInput = useCallback((msg) => {
    const ws = inputWsRef.current;
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }, []);

  const toViewport = useCallback((clientX, clientY) => {
    const canvas = canvasRef.current;
    const g = geomRef.current;
    if (!canvas || !g.frameW || !g.frameH) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0 || g.viewW <= 0 || g.viewH <= 0) return null;

    // 先将浏览器窗口的 CSS 坐标映射到实际显示帧，再映射到 Chrome CSS viewport。
    // 使用 rect 而不是 canvas.width/height 作为显示区域，避免页面布局缩放造成偏移。
    const displayX = clientX - rect.left;
    const displayY = clientY - rect.top;
    if (displayX < 0 || displayY < 0 || displayX > rect.width || displayY > rect.height) return null;
    const frameX = (displayX / rect.width) * g.frameW;
    const frameY = (displayY / rect.height) * g.frameH;
    return {
      x: Math.max(0, Math.min(g.viewW - 1, Math.round((frameX / g.frameW) * g.viewW))),
      y: Math.max(0, Math.min(g.viewH - 1, Math.round((frameY / g.frameH) * g.viewH))),
    };
  }, []);

  /* ---------------- Session 生命周期 ---------------- */
  useEffect(() => {
    let disposed = false;
    let stopFps = null;

    (async () => {
      try {
        const resp = await fetch('/browser/sessions', { method: 'POST', credentials: 'include' });
        if (!resp.ok) {
          const e = await resp.json().catch(() => ({}));
          throw new Error(e.error || `创建会话失败: HTTP ${resp.status}`);
        }
        const sess = await resp.json();
        if (disposed) { fetch(`/browser/sessions/${sess.id}`, { method: 'DELETE', credentials: 'include' }); return; }
        sessionRef.current = sess.id;
        setSessionId(sess.id);
        geomRef.current.viewW = sess.view_w || 1920;
        geomRef.current.viewH = sess.view_h || 1080;
        setCurrentUrl(sess.url || 'about:blank');
        setUrl(sess.url || 'about:blank');
        setStatus('connecting');

        // 刷新 tab 列表
        refreshTabs(sess.id);

        startInput(sess.id);
        stopFps = await startStream(sess.id);
      } catch (e) {
        if (!disposed) { setError(e.message); setStatus('error'); }
      }
    })();

    return () => { disposed = true; if (stopFps) stopFps(); stopStreamRef.current?.(); inputWsRef.current?.close(); pcRef.current?.close(); };
  }, [startStream, startInput]);

  const refreshTabs = useCallback(async (sid) => {
    try {
      const resp = await fetch(`/browser/sessions/${sid}/tabs`, { credentials: 'include' });
      if (!resp.ok) return;
      const tabs = await resp.json();
      if (!tabs || tabs.length === 0) return;
      setTabList(tabs);
      if (!activeTabId) {
        // 默认激活第一个（主）tab
        const main = tabs.find(t => t.is_active) || tabs[0];
        setActiveTabId(main.id);
      }
    } catch (e) { console.error('refresh tabs err:', e); }
  }, [activeTabId]);

  useEffect(() => {
    if (!sessionId || status !== 'streaming') return;
    refreshTabs(sessionId);
    const timer = setInterval(() => refreshTabs(sessionId), 1000);
    return () => clearInterval(timer);
  }, [sessionId, status, refreshTabs]);

  /* ---------------- URL 轮询 ---------------- */
  useEffect(() => {
    if (!sessionId || status !== 'streaming') return;
    const poll = async () => {
      try {
        const resp = await fetch(`/browser/sessions/${sessionId}/info`, { credentials: 'include' });
        if (!resp.ok) return;
        const info = await resp.json();
        const tab = tabList.find(t => t.id === activeTabId);
        if (info.url && info.url !== (tab?.url || currentUrl)) {
          if (tab) {
            setTabList(prev => prev.map(t => t.id === tab.id ? { ...t, url: info.url, title: info.url } : t));
          }
          if (activeTabIdRef.current === activeTabId) {
            setCurrentUrl(info.url);
            if (!urlFocused) setUrl(info.url);
          }
        }
        if (info.view_w || info.view_h) {
          geomRef.current.viewW = info.view_w || geomRef.current.viewW;
          geomRef.current.viewH = info.view_h || geomRef.current.viewH;
        }
      } catch {}
    };
    const timer = setInterval(poll, 700);
    poll();
    return () => clearInterval(timer);
  }, [sessionId, status, activeTabId, tabList, urlFocused, currentUrl]);

  /* ---------------- 键盘转发 ---------------- */
  useEffect(() => {
    if (urlFocused) return;
    const modifiers = (e) => (e.altKey ? 1 : 0) | (e.ctrlKey ? 2 : 0) | (e.metaKey ? 4 : 0) | (e.shiftKey ? 8 : 0);
    const onKeyDown = (e) => { e.preventDefault(); sendInput({ type: 'keydown', key: e.key, code: e.code, modifiers: modifiers(e) }); };
    const onKeyUp = (e) => { e.preventDefault(); sendInput({ type: 'keyup', key: e.key, code: e.code, modifiers: modifiers(e) }); };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    return () => { document.removeEventListener('keydown', onKeyDown); document.removeEventListener('keyup', onKeyUp); };
  }, [urlFocused, sendInput]);

  /* ---------------- 交互处理 ---------------- */
  const handleMouseDown = (e) => {
    e.preventDefault(); setUrlFocused(false);
    const p = toViewport(e.clientX, e.clientY);
    if (p) sendInput({ type: 'mousedown', x: p.x, y: p.y });
  };
  const handleMouseUp = (e) => {
    const p = toViewport(e.clientX, e.clientY);
    if (p) sendInput({ type: 'mouseup', x: p.x, y: p.y });
  };
  const handleMouseMove = (e) => {
    const p = toViewport(e.clientX, e.clientY);
    if (p) sendInput({ type: 'mousemove', x: p.x, y: p.y });
  };
  const handleWheel = (e) => {
    e.preventDefault();
    const p = toViewport(e.clientX, e.clientY);
    if (p) sendInput({ type: 'wheel', x: p.x, y: p.y, delta: Math.round(e.deltaY) });
  };

  const createTab = async () => {
    if (!sessionId) return;
    try {
      const resp = await fetch(`/browser/sessions/${sessionId}/tabs`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'about:blank' }), credentials: 'include' });
      if (!resp.ok) {
        const detail = await resp.json().catch(() => ({}));
        throw new Error(detail.error || `创建 tab 失败: HTTP ${resp.status}`);
      }
      const tab = await resp.json();
      setActiveTabId(tab.id);
      await refreshTabs(sessionId);
      await startStream(sessionId);
    } catch (e) { setError(e.message); }
  };

  const closeTab = async (tabId) => {
    if (tabId === activeTabId) {
      // 关闭当前 tab 时切换到另一个
      const remaining = tabList.filter(t => t.id !== tabId);
      if (remaining.length > 0) {
        await switchTab(remaining[0].id);
      }
    }
    try {
      await fetch(`/browser/sessions/${sessionId}/tabs/${tabId}`, { method: 'DELETE', credentials: 'include' });
      refreshTabs(sessionId);
    } catch (e) { console.error('close tab err:', e); }
  };

  const switchTab = async (tabId) => {
    if (!sessionId || tabId === activeTabId) return;
    try {
      const resp = await fetch(`/browser/sessions/${sessionId}/tabs/${tabId}/activate`, {
        method: 'POST', credentials: 'include' });
      if (!resp.ok) throw new Error('切换 tab 失败');
      setActiveTabId(tabId);
      setUrlFocused(false);
      // 重新建立串流，确保新的 WHIP worker 绑定到刚激活的 Chrome target。
      // 之前仅更新 UI 状态并尝试复用旧 DataChannel，实际画面可能仍停留在旧页面。
      await startStream(sessionId);
      // 刷新该 tab 的 URL 显示
      const tab = tabList.find(t => t.id === tabId);
      if (tab) setUrl(tab.url || 'about:blank');
    } catch (e) { setError(e.message); }
  };

  const navigate = async () => {
    if (!sessionId || !url) return;
    let target = url.trim();
    if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(target)) target = 'https://' + target;
    try {
      const resp = await fetch(`/browser/sessions/${sessionId}/navigate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: target, tabId: activeTabId }), credentials: 'include' });
      if (!resp.ok) {
        const e = await resp.json().catch(() => ({}));
        throw new Error(e.error || `导航失败: HTTP ${resp.status}`);
      }
      const info = await resp.json();
      setCurrentUrl(info.url);
      setUrl(info.url);
      savePersistedUrl(info.url);
      setError('');
      setUrlFocused(false);
      // 更新 tab 列表
      refreshTabs(sessionId);
    } catch (e) { setError(e.message); }
  };

  const reload = () => {
    if (currentUrl && currentUrl !== 'about:blank') {
      setUrl(currentUrl);
      savePersistedUrl(currentUrl);
      fetch(`/browser/sessions/${sessionId}/navigate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: currentUrl, tabId: activeTabId }), credentials: 'include' });
    }
  };

  const statusLabel = {
    creating: t('browser.startingChrome', '正在启动 Chrome...'),
    connecting: t('browser.connectingWebRTC', '正在建立 WebRTC 连接...'),
    streaming: t('browser.streaming', '串流中'),
    disconnected: t('browser.disconnected', '已断开'),
    error: t('browser.error', '出错'),
  }[status] || status;

  const isLive = status === 'streaming';

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] gap-4">
      {/* Tab 栏 */}
      <div className="flex items-center gap-2 overflow-x-auto">
        <button
          onClick={createTab}
          className="flex items-center gap-1 px-3 py-1.5 bg-gradient-to-br from-violet-500/25 to-indigo-500/15 border border-violet-500/40 rounded-lg text-sm text-white hover:bg-violet-500/35 transition-colors whitespace-nowrap"
        >
          <Plus size={14} />
          <span>{t('browser.addTab', '新建标签页')}</span>
        </button>
        {tabList.map(tab => (
          <div
            key={tab.id}
            onClick={() => switchTab(tab.id)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm cursor-pointer transition-all whitespace-nowrap select-none
              ${activeTabId === tab.id
                ? 'bg-gradient-to-br from-violet-500/25 to-indigo-500/15 border border-violet-500/40 text-white shadow'
                : 'bg-white/5 border border-white/10 text-white/60 hover:bg-white/10'}`}
          >
            <Globe size={12} className="shrink-0" />
            <span className="truncate max-w-[180px]">{tab.title || tab.url || '空白页'}</span>
            {tabList.length > 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                className="p-0.5 hover:bg-white/20 rounded"
              >
                <X size={12} />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* 地址栏 */}
      <div className="flex flex-col gap-2 glass-strong rounded-2xl border border-white/10">
        <div className="flex gap-2 items-center">
          {hasHistory && (
            <button onClick={restoreHistory} title={t('browser.restoringHint', '恢复上次访问的页面')}
              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
              <RefreshCw size={16} className="animate-pulse" />
            </button>
          )}
          <button onClick={reload} title={t('browser.reloadingHint', '重新加载')}
            className="p-2 text-white/50 hover:text-gray-700 hover:bg-white/10 rounded-lg transition-colors">
            <RefreshCw size={16} />
          </button>
          <input type="text" value={url} onChange={(e) => setUrl(e.target.value)}
            onFocus={() => setUrlFocused(true)}
            onKeyDown={(e) => { if (e.key === 'Enter') navigate(); }}
            className="flex-1 px-4 py-2 border border-white/10 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={t('browser.inputPlaceholder', '输入网址后回车（点击画面可直接操作浏览器）')} />
          <button onClick={navigate} disabled={!isLive}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors text-sm font-medium">
            {t('browser.visit', '访问')}
          </button>
        </div>
        {hasHistory && (
          <div className="text-xs text-white/50 flex items-center gap-2">
            <span>{t('browser.historyHint', '📌 已保存上次访问地址，点击刷新图标可恢复')}</span>
            <button onClick={clearHistory} className="hover:text-red-500 underline">{t('browser.clearHistory', '清除记录')}</button>
          </div>
        )}
      </div>

      {/* 画面 */}
      <div className="flex-1 bg-black rounded-xl overflow-hidden shadow-sm border border-white/10 relative flex items-center justify-center">
        {!isLive && status !== 'error' && (
          <div className="absolute inset-0 flex items-center justify-center text-white z-10 bg-black/80">
            <div className="text-center">
              <Loader2 size={40} className="animate-spin mx-auto mb-4 text-blue-400" />
              <p className="text-gray-300">{statusLabel}</p>
            </div>
          </div>
        )}
        {error && (
          <div className="absolute top-4 left-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg text-sm z-20">{error}</div>
        )}
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
          onWheel={handleWheel}
          tabIndex={0}
          className="max-w-full max-h-full object-contain"
          style={{ cursor: urlFocused ? 'default' : 'crosshair', outline: 'none' }}
        />
      </div>

      {/* 状态栏 */}
      <div className="flex items-center justify-between px-4 py-2 glass rounded-xl border border-white/10 text-sm">
        <div className="flex items-center gap-2 min-w-0">
          <Globe size={14} className="text-white/40 shrink-0" />
          <span className="text-white/70 truncate">{currentUrl || '—'}</span>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          {isLive && <span className="text-white/40 text-xs">{fps} fps · WebRTC</span>}
          {!urlFocused && isLive && (
            <span className="text-blue-600 text-xs">{t('browser.keyboardTakeover', '键盘已接管（点地址栏退出）')}</span>
          )}
          <div className={`flex items-center gap-2 ${isLive ? 'text-green-500' : 'text-red-500'}`}>
            <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-green-500' : 'bg-red-500'}`} />
            <span>{statusLabel}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BrowserView;
