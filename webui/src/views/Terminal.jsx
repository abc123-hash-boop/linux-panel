import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { Plus, X } from 'lucide-react';
import { useI18n } from '../i18n';

const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';

// --- 每个 Tab 独立维护一个 TermSession：WS + xterm 实例 ---
const TermSession = ({ id, wsUrl, isContainer, onTitle, onCloseTab, totalTabs }) => {
  const { t } = useI18n();
  const containerRef = useRef(null);
  const termRef = useRef(null);
  const fitRef = useRef(null);
  const aliveRef = useRef(true);
  const wsRef = useRef(null);
  const totalTabsRef = useRef(totalTabs);
  totalTabsRef.current = totalTabs;
  const canClose = totalTabs > 1;
  const [status, setStatus] = useState('connecting');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.style.width = '100%';
    el.style.height = '100%';
    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize: 14,
      fontFamily: '"Cascadia Code", "JetBrains Mono", Consolas, Monaco, monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#ffffff',
        black: '#000000', red: '#cd3131', green: '#0dbc79', yellow: '#e5e510',
        blue: '#2472c8', magenta: '#bc3fbc', cyan: '#11a8cd', white: '#e5e5e5',
        brightBlack: '#666666', brightRed: '#f14c4c', brightGreen: '#23d18b',
        brightYellow: '#f5f543', brightBlue: '#3b8eea', brightMagenta: '#d670d6',
        brightCyan: '#29b8db', brightWhite: '#ffffff',
      },
      scrollback: 1000,
    });
    termRef.current = term;

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    fitRef.current = fitAddon;
    term.open(el);

    term.onTitleChange(t => onTitle(id, t));

    // 输入 -> WS（直接发原始二进制）
    const dataSub = term.onData((data) => {
      try {
        if (termRef.current && aliveRef.current && wsRef.current?.readyState === 1) {
          wsRef.current.send(data);
        }
      } catch (e) {
        console.error('[Terminal] send error:', e);
      }
    });

    const sendResize = () => {
      try {
        fitAddon.fit();
        if (!isContainer && wsRef.current?.readyState === 1) {
          wsRef.current.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
        }
      } catch {}
    };
    setTimeout(sendResize, 100);

    // 连接
    const ws = new WebSocket(wsUrl);
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('connected');
      setErrorMsg('');
      setTimeout(sendResize, 300);
    };

    ws.onmessage = e => {
      if (!aliveRef.current || !termRef.current) return;
      const bytes = e.data instanceof ArrayBuffer ? new Uint8Array(e.data) : new Uint8Array(e.data);
      term.write(bytes);
    };

    ws.onerror = () => {
      console.error('[Terminal] ws error');
    };

    ws.onclose = (ev) => {
      console.log('[Terminal] ws close', ev.code, ev.reason);
      wsRef.current = null;
      if (!aliveRef.current) return;
      setStatus('disconnected');

      // 显示断开提示
      term.write('\r\n');
      if (canClose) {
        term.write('━'.repeat(52) + '\r\n');
        term.write(t('terminal.disconnected', '连接已断开。按 Enter 重启 shell，') + '\r\n');
        term.write(t('terminal.disconnectedWithClose', '或按 Ctrl+D 关闭此标签页') + '\r\n');
        term.write('━'.repeat(52) + '\r\n');
      } else {
        term.write('━'.repeat(52) + '\r\n');
        term.write(t('terminal.disconnectedNoClose', '连接已断开。按 Enter 重启 shell，Ctrl+D 无效（这是最后一个标签页）') + '\r\n');
        term.write('━'.repeat(52) + '\r\n');
      }

      // 监听键盘事件处理重连/关闭
      const keySub = term.onData(data => {
        if (data === '\r' || data === '\n') {
          keySub.dispose();
          const w = new WebSocket(wsUrl);
          w.binaryType = 'arraybuffer';
          w.onopen = () => {
            setStatus('connected');
          };
          w.onmessage = e2 => {
            if (!aliveRef.current || !termRef.current) return;
            const bytes = e2.data instanceof ArrayBuffer ? new Uint8Array(e2.data) : new Uint8Array(e2.data);
            term.write(bytes);
          };
          w.onerror = () => {};
          w.onclose = (ev2) => {
            console.log('[Terminal] ws close', ev2.code, ev2.reason);
            wsRef.current = null;
          };
          wsRef.current = w;
        } else if (data === '\x04' && canClose) {
          keySub.dispose();
          onCloseTab(id);
        } else {
          try {
            if (termRef.current && wsRef.current && wsRef.current.readyState === 1) wsRef.current.send(data);
          } catch {}
        }
      });
    };

    return () => {
      aliveRef.current = false;
      dataSub.dispose();
      if (wsRef.current) {
        try {
          if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
            wsRef.current.close();
          }
        } catch {}
        wsRef.current = null;
      }
      try { term.dispose(); } catch {}
    };
  }, [wsUrl, id, isContainer, onTitle, onCloseTab]);

  return (
    <div ref={containerRef} className="bg-[#1e1e1e] h-full w-full">
      {errorMsg && <div className="text-red-400 text-sm p-2">{errorMsg}</div>}
    </div>
  );
};

// --- 主视图：Tab 栏 + 多 session ---
const TerminalView = () => {
  const { t } = useI18n();
  const params = new URLSearchParams(location.search);
  const containerId = params.get('container') || '';
  const isContainerTerm = !!containerId;

  const mkWsUrl = useCallback((cid) => cid
    ? `${proto}//${location.host}/ws/docker/exec/${encodeURIComponent(cid)}`
    : `${proto}//${location.host}/ws/terminal`, []);

  const nextId = useRef(1);
  const [tabs, setTabs] = useState(() => [{
    id: 0,
    title: '',
    wsUrl: mkWsUrl(containerId),
    isContainer: isContainerTerm,
    containerId,
  }]);
  const [activeId, setActiveId] = useState(0);
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;

  const handleTitle = useCallback((tabId, title) => {
    setTabs(prev => prev.map(tb => tb.id === tabId ? { ...tb, title } : tb));
  }, []);

  const addTab = useCallback(() => {
    try {
      const id = nextId.current++;
      setTabs(prev => [...prev, { id, title: '', wsUrl: mkWsUrl(''), isContainer: false, containerId: '' }]);
      setActiveId(id);
    } catch (e) {
      console.error('[Terminal] addTab error:', e);
    }
  }, [mkWsUrl]);

  const closeTab = useCallback((id) => {
    try {
      if (tabsRef.current.length <= 1) return;
      handleCloseTab(id);
      const next = tabsRef.current.filter(tb => tb.id !== id);
      setTabs(next);
      if (id === activeIdRef.current) {
        const newActive = next[next.length - 1].id;
        setActiveId(newActive);
      }
    } catch (e) {
      console.error('[Terminal] closeTab error:', e);
    }
  }, []);

  // 优雅关闭指定 tab 的 WS（不触发 tab 列表变化，供 closeTab 复用）
  const handleCloseTab = useCallback((id) => {
    try {
      if (tabsRef.current.length <= 1) return;
      const sessionEl = document.getElementById(`term-session-${id}`);
      if (!sessionEl) return;
      const ws = sessionEl.querySelector('[data-ws]');
      if (ws) {
        ws.close(1000, 'Tab closed by user');
      }
    } catch (e) {
      console.error('[Terminal] handleCloseTab error:', e);
    }
  }, []);

  const tabLabel = (tb) => {
    if (tb.title) return tb.title;
    return tb.isContainer ? `bash — ${tb.containerId.slice(0, 12)}` : 'bash';
  };

  const activeTab = tabs.find(tb => tb.id === activeId) || tabs[0];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-white">{t('terminal.title', 'Terminal')}</h1>
        <p className="text-sm text-white/50 mt-0.5">
          {isContainerTerm
            ? t('terminal.containerHint', 'Docker 容器终端')
            : t('terminal.hint', '通过 WebSocket 连接的主机 PTY 终端')}
        </p>
      </div>

      {/* macOS Window */}
      <div className="rounded-xl overflow-hidden shadow-2xl border border-gray-300" style={{ boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4)' }}>
        {/* Tab bar */}
        <div className="bg-gray-900 flex items-stretch border-b border-gray-700 overflow-x-auto">
          {tabs.map(tb => (
            <div
              key={tb.id}
              onClick={() => setActiveId(tb.id)}
              className={`group flex items-center gap-2 px-4 py-2 text-sm font-mono cursor-pointer select-none border-r border-gray-700 max-w-[240px] shrink-0 ${
                tb.id === activeId ? 'bg-gray-800 text-gray-100' : 'text-gray-400 hover:bg-gray-800/60'
              }`}
            >
              <span className="truncate">{tabLabel(tb)}</span>
              {tabs.length > 1 && (
                <button
                  onClick={(e) => { e.stopPropagation(); closeTab(tb.id); }}
                  className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity shrink-0"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          ))}
          <button
            onClick={addTab}
            title={t('terminal.newTab', 'New tab')}
            className="px-3 text-gray-400 hover:text-gray-100 hover:bg-gray-800/60 transition-colors shrink-0"
          >
            <Plus size={15} />
          </button>
        </div>

        {/* Title bar — 显示 shell 通过 OSC 序列设置的真实标题 */}
        <div className="bg-gray-800 px-4 py-3 flex items-center gap-3 border-b border-gray-700">
          <div className="flex gap-1.5">
            <button className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-600 transition-colors" />
            <button className="w-3 h-3 rounded-full bg-yellow-500 hover:bg-yellow-600 transition-colors" />
            <button className="w-3 h-3 rounded-full bg-green-500 hover:bg-green-600 transition-colors" />
          </div>
          <div className="flex-1 text-center min-w-0">
            <span className="text-gray-300 text-sm font-mono block truncate">
              {activeTab?.title || (activeTab?.isContainer ? `bash — ${activeTab.containerId.slice(0, 12)}` : 'bash')}
            </span>
          </div>
          <div className="w-16 shrink-0 text-right">
            <span className={`inline-block w-2 h-2 rounded-full ${
              activeTab ? 'bg-green-500' : 'bg-red-500'
            }`} />
          </div>
        </div>

        {/* Sessions */}
        <div style={{ height: 'calc(100vh - 260px)', minHeight: '450px' }}>
          {tabs.map(tb => (
            <div
              key={tb.id}
              id={`term-session-${tb.id}`}
              data-ws
              className="h-full w-full"
              style={{ display: tb.id === activeId ? 'block' : 'none' }}
            >
              <TermSession
                id={tb.id}
                wsUrl={tb.wsUrl}
                isContainer={tb.isContainer}
                onTitle={handleTitle}
                onCloseTab={closeTab}
                totalTabs={tabs.length}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TerminalView;
