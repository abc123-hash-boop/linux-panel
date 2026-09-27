import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

const TerminalView = () => {
  const containerRef = useRef(null);
  const termRef = useRef(null);
  const wsRef = useRef(null);
  const reconnectRef = useRef(true);
  const [status, setStatus] = useState('connecting');
  const [host] = useState(() => location.hostname || 'localhost');

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
    term.open(el);

    // 输入 → WS
    term.onData(data => {
      if (wsRef.current?.readyState === 1) {
        wsRef.current.send(JSON.stringify({ type: 'input', data }));
      }
    });

    // Auto resize
    const sendResize = () => {
      try {
        fitAddon.fit();
        if (wsRef.current?.readyState === 1) {
          wsRef.current.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
        }
      } catch {}
    };
    const ro = new ResizeObserver(() => sendResize());
    ro.observe(el);
    window.addEventListener('resize', sendResize);

    // 连接
    const connect = () => {
      if (!reconnectRef.current) return;
      setStatus('connecting');
      const ws = new WebSocket(`ws://${location.host}/ws/terminal`);
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus('connected');
        sendResize();
      };
      ws.onmessage = e => {
        const bytes = e.data instanceof ArrayBuffer ? new Uint8Array(e.data) : new Uint8Array(e.data);
        term.write(bytes);
      };
      ws.onerror = () => {};
      ws.onclose = () => {
        wsRef.current = null;
        if (!reconnectRef.current) return;
        setStatus('disconnected');
        setTimeout(connect, 3000);
      };
    };
    connect();

    return () => {
      reconnectRef.current = false;
      ro.disconnect();
      window.removeEventListener('resize', sendResize);
      if (wsRef.current) wsRef.current.close();
      term.destroy();
    };
  }, []);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Terminal</h1>
          <p className="text-sm text-gray-500 mt-0.5">WebSocket PTY terminal</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-xs font-medium border ${
            status === 'connected' ? 'bg-green-50 text-green-700 border-green-200' :
            status === 'connecting' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
            'bg-red-50 text-red-700 border-red-200'
          }`}>
            <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${
              status === 'connected' ? 'bg-green-500' :
              status === 'connecting' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'
            }`} />
            {status === 'connected' ? 'Connected' : status === 'connecting' ? 'Connecting...' : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* macOS Window */}
      <div className="rounded-xl overflow-hidden shadow-2xl border border-gray-300" style={{ boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4)' }}>
        <div className="bg-gray-800 px-4 py-3 flex items-center gap-3 border-b border-gray-700">
          <div className="flex gap-1.5">
            <button className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-600 transition-colors" />
            <button className="w-3 h-3 rounded-full bg-yellow-500 hover:bg-yellow-600 transition-colors" />
            <button className="w-3 h-3 rounded-full bg-green-500 hover:bg-green-600 transition-colors" />
          </div>
          <div className="flex-1 text-center">
            <span className="text-gray-300 text-sm font-mono">bash — root@{host}</span>
          </div>
          <div className="w-16" />
        </div>
        <div ref={containerRef} className="bg-[#1e1e1e]" style={{ height: 'calc(100vh - 220px)', minHeight: '450px' }} />
      </div>
    </div>
  );
};

export default TerminalView;
