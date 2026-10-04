import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Globe, RefreshCw, Power, Loader2 } from 'lucide-react';

const BrowserView = () => {
  const canvasRef = useRef(null);
  const pcRef = useRef(null);
  const inputWsRef = useRef(null);
  const sessionRef = useRef(null);
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
  // true = 焦点在地址栏（键盘给地址栏）；false = 焦点在画面（键盘转发到 Chrome）
  const [urlFocused, setUrlFocused] = useState(true);

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
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });
    pcRef.current = pc;

    const dc = pc.createDataChannel('screencast');
    dc.binaryType = 'arraybuffer';

    let frameCount = 0;
    const fpsTimer = setInterval(() => {
      setFps(frameCount);
      frameCount = 0;
    }, 1000);

    dc.onmessage = (ev) => {
      const st = frameRef.current;
      if (typeof ev.data === 'string') {
        try {
          const meta = JSON.parse(ev.data);
          if (meta.type === 'frame-start') {
            st.expected = meta.size;
            st.chunks = [];
            st.received = 0;
          }
        } catch { /* 忽略非 JSON 文本 */ }
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
        st.expected = 0;
        st.chunks = [];
        st.received = 0;
        frameCount++;
        drawFrame(frame);
      }
    };

    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      if (s === 'connected') setStatus('streaming');
      else if (s === 'failed' || s === 'closed') setStatus('disconnected');
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // 非 trickle ICE：等收集完成后一次性发 offer
    await new Promise((resolve) => {
      if (pc.iceGatheringState === 'complete') return resolve();
      const check = () => {
        if (pc.iceGatheringState === 'complete') {
          pc.removeEventListener('icegatheringstatechange', check);
          resolve();
        }
      };
      pc.addEventListener('icegatheringstatechange', check);
      setTimeout(resolve, 8000);
    });

    const resp = await fetch(`/browser/sessions/${sid}/whip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/sdp' },
      body: pc.localDescription.sdp,
    });
    if (!resp.ok) throw new Error(`WHIP 失败: HTTP ${resp.status}`);
    const answer = await resp.text();
    await pc.setRemoteDescription({ type: 'answer', sdp: answer });

    return () => clearInterval(fpsTimer);
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

  // 画面坐标 → Chrome 视口坐标
  const toViewport = useCallback((clientX, clientY) => {
    const canvas = canvasRef.current;
    const g = geomRef.current;
    if (!canvas || !g.frameW || !g.frameH) return null;
    const rect = canvas.getBoundingClientRect();
    // 1) 浏览器显示尺寸 → 画面像素；2) 画面像素 → Chrome 视口
    const px = ((clientX - rect.left) / rect.width) * g.frameW;
    const py = ((clientY - rect.top) / rect.height) * g.frameH;
    return {
      x: Math.round((px / g.frameW) * g.viewW),
      y: Math.round((py / g.frameH) * g.viewH),
    };
  }, []);

  /* ---------------- Session 生命周期 ---------------- */

  useEffect(() => {
    let disposed = false;
    let stopFps = null;

    (async () => {
      try {
        const resp = await fetch('/browser/sessions', { method: 'POST' });
        if (!resp.ok) {
          const e = await resp.json().catch(() => ({}));
          throw new Error(e.error || `创建会话失败: HTTP ${resp.status}`);
        }
        const sess = await resp.json();
        if (disposed) {
          fetch(`/browser/sessions/${sess.id}`, { method: 'DELETE' });
          return;
        }
        sessionRef.current = sess.id;
        setSessionId(sess.id);
        geomRef.current.viewW = sess.view_w || 1920;
        geomRef.current.viewH = sess.view_h || 1080;
        setCurrentUrl(sess.url || 'about:blank');
        setStatus('connecting');

        startInput(sess.id);
        stopFps = await startStream(sess.id);
      } catch (e) {
        if (!disposed) {
          setError(e.message);
          setStatus('error');
        }
      }
    })();

    return () => {
      disposed = true;
      if (stopFps) stopFps();
      inputWsRef.current?.close();
      pcRef.current?.close();
      const sid = sessionRef.current;
      if (sid) {
        // 组件卸载时关闭 Chrome，避免残留进程
        fetch(`/browser/sessions/${sid}`, { method: 'DELETE', keepalive: true });
      }
    };
  }, [startStream, startInput]);

  /* ---------------- 键盘转发 ---------------- */

  useEffect(() => {
    if (urlFocused) return;
    const onKeyDown = (e) => {
      e.preventDefault();
      sendInput({ type: 'keydown', key: e.key, code: e.code });
    };
    const onKeyUp = (e) => {
      e.preventDefault();
      sendInput({ type: 'keyup', key: e.key, code: e.code });
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
    };
  }, [urlFocused, sendInput]);

  /* ---------------- 交互处理 ---------------- */

  const handleMouseDown = (e) => {
    e.preventDefault();
    setUrlFocused(false);
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

  const navigate = async () => {
    if (!sessionId || !url) return;
    let target = url.trim();
    if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(target)) target = 'https://' + target;
    try {
      const resp = await fetch(`/browser/sessions/${sessionId}/navigate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: target }),
      });
      if (!resp.ok) {
        const e = await resp.json().catch(() => ({}));
        throw new Error(e.error || `导航失败: HTTP ${resp.status}`);
      }
      const info = await resp.json();
      setCurrentUrl(info.url);
      setError('');
      setUrlFocused(false);
    } catch (e) {
      setError(e.message);
    }
  };

  const reload = () => {
    if (currentUrl && currentUrl !== 'about:blank') {
      setUrl(currentUrl);
      fetch(`/browser/sessions/${sessionId}/navigate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: currentUrl }),
      });
    }
  };

  const statusLabel = {
    creating: '正在启动 Chrome...',
    connecting: '正在建立 WebRTC 连接...',
    streaming: '串流中',
    disconnected: '已断开',
    error: '出错',
  }[status] || status;

  const isLive = status === 'streaming';

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] gap-4">
      {/* 地址栏 */}
      <div className="flex gap-2 items-center bg-white p-3 rounded-xl shadow-sm border border-gray-100">
        <button onClick={reload} title="重新加载"
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
          <RefreshCw size={16} />
        </button>
        <input type="text" value={url} onChange={(e) => setUrl(e.target.value)}
          onFocus={() => setUrlFocused(true)}
          onKeyDown={(e) => { if (e.key === 'Enter') navigate(); }}
          className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="输入网址后回车（点击画面可直接操作浏览器）" />
        <button onClick={navigate} disabled={!isLive}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors text-sm font-medium">
          访问
        </button>
      </div>

      {/* 画面 */}
      <div className="flex-1 bg-black rounded-xl overflow-hidden shadow-sm border border-gray-200 relative flex items-center justify-center">
        {!isLive && status !== 'error' && (
          <div className="absolute inset-0 flex items-center justify-center text-white z-10 bg-black/80">
            <div className="text-center">
              <Loader2 size={40} className="animate-spin mx-auto mb-4 text-blue-400" />
              <p className="text-gray-300">{statusLabel}</p>
            </div>
          </div>
        )}
        {error && (
          <div className="absolute top-4 left-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg text-sm z-20">
            {error}
          </div>
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
      <div className="flex items-center justify-between px-4 py-2 bg-white rounded-xl shadow-sm border border-gray-100 text-sm">
        <div className="flex items-center gap-2 min-w-0">
          <Globe size={14} className="text-gray-400 shrink-0" />
          <span className="text-gray-600 truncate">{currentUrl || '—'}</span>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          {isLive && <span className="text-gray-400 text-xs">{fps} fps · WebRTC</span>}
          {!urlFocused && isLive && (
            <span className="text-blue-600 text-xs">键盘已接管（点地址栏退出）</span>
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
