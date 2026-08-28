import React, {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  useSelector,
} from "react-redux";

import {
  Terminal,
} from "@xterm/xterm";

import {
  FitAddon,
} from "@xterm/addon-fit";

import "@xterm/xterm/css/xterm.css";

import {
  ToolBar,
} from "../../../utils/general";


export const WnTerminal = () => {

  /*
   * ============================================================
   * Redux
   * ============================================================
   */

  const wnapp = useSelector(
    (state) => state.apps.terminal
  );


  /*
   * ============================================================
   * Refs
   * ============================================================
   */

  const terminalRef =
    useRef(null);

  const terminalInstance =
    useRef(null);

  const fitAddonRef =
    useRef(null);

  const socketRef =
    useRef(null);

  const socketModeRef =
    useRef(null);

  const socketGenerationRef =
    useRef(0);

  const resizeObserverRef =
    useRef(null);

  const resizeFrameRef =
    useRef(null);

  const resizeTimerRef =
    useRef(null);

  const destroyedRef =
    useRef(false);


  /*
   * ============================================================
   * 当前 Terminal 模式
   *
   * null       = 未连接
   * "normal"   = 普通 Terminal
   * "docker"   = Docker Terminal
   * ============================================================
   */

  const currentMode =
    wnapp &&
    wnapp.dockerContainer
      ? "docker"
      : "normal";


  /*
   * Docker Container ID
   */

  const dockerContainer =
    wnapp &&
    wnapp.dockerContainer
      ? wnapp.dockerContainer
      : null;


  /*
   * ============================================================
   * Window title
   * ============================================================
   */

  const [
    wntitle,
    setWntitle,
  ] = useState("Terminal");


  /*
   * ============================================================
   * WebSocket URL
   * ============================================================
   */

  const getWebSocketURL = (
    containerId
  ) => {

    const protocol =
      window.location.protocol === "https:"
        ? "wss:"
        : "ws:";


    if (containerId) {

      return (
        `${protocol}//${window.location.host}` +
        `/ws/docker/exec/${encodeURIComponent(containerId)}`
      );

    }


    return (
      `${protocol}//${window.location.host}` +
      `/ws/terminal`
    );

  };


  /*
   * ============================================================
   * 清空 Terminal
   * ============================================================
   */

  const clearTerminal = () => {

    const term =
      terminalInstance.current;


    if (!term) {
      return;
    }


    try {

      term.clear();

      term.write(
        "\x1b[2J\x1b[H"
      );

      term.reset();

    } catch (e) {

      console.warn(
        "[Terminal] clear failed:",
        e
      );

    }

  };


  /*
   * ============================================================
   * Fit xterm
   * ============================================================
   */

  const fitTerminal = () => {

    const container =
      terminalRef.current;

    const fitAddon =
      fitAddonRef.current;

    const term =
      terminalInstance.current;


    if (
      !container ||
      !fitAddon ||
      !term
    ) {

      return;

    }


    if (
      container.clientWidth <= 0 ||
      container.clientHeight <= 0
    ) {

      return;

    }


    try {

      fitAddon.fit();

    } catch (e) {

      console.warn(
        "[Terminal] fit failed:",
        e
      );

    }

  };


  /*
   * ============================================================
   * 普通 Terminal resize
   *
   * 只有 normal 模式允许发送 JSON。
   *
   * Docker 模式绝对不会进入这里。
   * ============================================================
   */

  const sendNormalResize = () => {

    const ws =
      socketRef.current;

    const term =
      terminalInstance.current;


    /*
     * 这里直接判断 socketMode。
     *
     * 不再使用 connectedDockerRef。
     */

    if (
      socketModeRef.current !==
      "normal"
    ) {

      return;

    }


    if (
      !ws ||
      ws.readyState !==
      WebSocket.OPEN
    ) {

      return;

    }


    if (!term) {
      return;
    }


    if (
      !term.cols ||
      !term.rows
    ) {

      return;

    }


    try {

      ws.send(
        JSON.stringify({
          type: "resize",
          cols: term.cols,
          rows: term.rows,
        })
      );

    } catch (e) {

      console.warn(
        "[Terminal] normal resize failed:",
        e
      );

    }

  };


  /*
   * ============================================================
   * Resize
   * ============================================================
   */

  const resizeTerminal = () => {

    if (
      resizeFrameRef.current
    ) {

      cancelAnimationFrame(
        resizeFrameRef.current
      );

    }


    resizeFrameRef.current =
      requestAnimationFrame(() => {

        resizeFrameRef.current =
          null;


        fitTerminal();


        if (
          resizeTimerRef.current
        ) {

          clearTimeout(
            resizeTimerRef.current
          );

        }


        resizeTimerRef.current =
          setTimeout(() => {

            resizeTimerRef.current =
              null;

            /*
             * Docker 模式这里什么都不会发送。
             */

            sendNormalResize();

          }, 50);

      });

  };


  /*
   * ============================================================
   * 关闭 WebSocket
   * ============================================================
   */

  const closeWebSocket = () => {

    const ws =
      socketRef.current;


    socketRef.current =
      null;

    socketModeRef.current =
      null;


    if (!ws) {
      return;
    }


    /*
     * 先解除事件。
     *
     * 防止旧连接影响新连接。
     */

    ws.onopen = null;
    ws.onmessage = null;
    ws.onerror = null;
    ws.onclose = null;


    try {

      if (
        ws.readyState ===
          WebSocket.OPEN ||
        ws.readyState ===
          WebSocket.CONNECTING
      ) {

        ws.close();

      }

    } catch (e) {}

  };


  /*
   * ============================================================
   * Connect WebSocket
   * ============================================================
   */

  const connectWebSocket = (
    term,
    containerId
  ) => {

    /*
     * 新 generation
     */

    socketGenerationRef.current += 1;

    const generation =
      socketGenerationRef.current;


    /*
     * 关闭旧连接
     */

    closeWebSocket();


    /*
     * 当前模式。
     *
     * 这个 Ref 在创建 WebSocket 之前
     * 就已经设置。
     *
     * 因此 resize / keyboard 不会串模式。
     */

    const mode =
      containerId
        ? "docker"
        : "normal";


    socketModeRef.current =
      mode;


    const url =
      getWebSocketURL(
        containerId
      );


    console.log(
      "[Terminal] connect:",
      mode,
      containerId || ""
    );


    let ws;


    try {

      ws =
        new WebSocket(
          url
        );

    } catch (e) {

      console.error(
        "[Terminal] WebSocket create failed:",
        e
      );

      return;

    }


    /*
     * Docker TTY 和普通 Terminal
     * 都使用 binary。
     */

    ws.binaryType =
      "arraybuffer";


    socketRef.current =
      ws;


    /*
     * ==========================================================
     * OPEN
     * ==========================================================
     */

    ws.onopen = () => {

      if (
        destroyedRef.current ||
        generation !==
          socketGenerationRef.current ||
        socketRef.current !== ws
      ) {

        return;

      }


      console.log(
        "[Terminal] connected:",
        mode
      );


      /*
       * 等 DOM 稳定后 fit。
       */

      setTimeout(() => {

        if (
          destroyedRef.current ||
          generation !==
            socketGenerationRef.current ||
          socketRef.current !== ws
        ) {

          return;

        }


        fitTerminal();


        /*
         * 只有普通 Terminal
         * 发送 resize。
         */

        if (
          mode === "normal"
        ) {

          sendNormalResize();

        }


        try {

          term.focus();

        } catch (e) {}

      }, 30);

    };


    /*
     * ==========================================================
     * SERVER -> XTERM
     * ==========================================================
     */

    ws.onmessage = async (
      event
    ) => {

      if (
        destroyedRef.current ||
        generation !==
          socketGenerationRef.current ||
        socketRef.current !== ws
      ) {

        return;

      }


      try {

        /*
         * Text
         */

        if (
          typeof event.data ===
          "string"
        ) {

          term.write(
            event.data
          );

          return;

        }


        /*
         * ArrayBuffer
         */

        if (
          event.data instanceof
          ArrayBuffer
        ) {

          const decoder =
            new TextDecoder();

          term.write(
            decoder.decode(
              event.data
            )
          );

          return;

        }


        /*
         * Blob
         */

        if (
          event.data instanceof
          Blob
        ) {

          const buffer =
            await event.data.arrayBuffer();

          const decoder =
            new TextDecoder();

          term.write(
            decoder.decode(
              buffer
            )
          );

        }

      } catch (e) {

        console.error(
          "[Terminal] write failed:",
          e
        );

      }

    };


    /*
     * ==========================================================
     * ERROR
     * ==========================================================
     */

    ws.onerror = (
      error
    ) => {

      if (
        generation !==
        socketGenerationRef.current
      ) {

        return;

      }


      console.error(
        "[Terminal] WebSocket error:",
        error
      );

    };


    /*
     * ==========================================================
     * CLOSE
     * ==========================================================
     */

    ws.onclose = (
      event
    ) => {

      if (
        generation !==
        socketGenerationRef.current
      ) {

        return;

      }


      console.log(
        "[Terminal] closed:",
        mode,
        event.code,
        event.reason || ""
      );


      if (
        socketRef.current === ws
      ) {

        socketRef.current =
          null;

        socketModeRef.current =
          null;

      }


      /*
       * Docker Terminal 结束：
       *
       * 清空 xterm。
       *
       * 下一次打开 Docker Terminal
       * 时不会留下旧容器内容。
       */

      if (
        mode === "docker"
      ) {

        clearTerminal();

      }

    };

  };


  /*
   * ============================================================
   * 初始化 xterm
   * ============================================================
   */

  useEffect(() => {

    destroyedRef.current =
      false;


    const container =
      terminalRef.current;


    if (!container) {
      return;
    }


    /*
     * ==========================================================
     * xterm
     * ==========================================================
     */

    const term =
      new Terminal({

        cursorBlink:
          true,

        cursorStyle:
          "block",

        fontFamily:
          '"Cascadia Mono", "Cascadia Code", Consolas, monospace',

        fontSize:
          14,

        lineHeight:
          1.1,

        scrollback:
          5000,

        convertEol:
          false,

        rightClickSelectsWord:
          true,

        allowTransparency:
          false,

        theme: {

          background:
            "#0c0c0c",

          foreground:
            "#f2f2f2",

          cursor:
            "#ffffff",

          cursorAccent:
            "#0c0c0c",

          selectionBackground:
            "rgba(255,255,255,0.25)",

          black:
            "#0c0c0c",

          red:
            "#c50f1f",

          green:
            "#13a10e",

          yellow:
            "#c19c00",

          blue:
            "#0037da",

          magenta:
            "#881798",

          cyan:
            "#3a96dd",

          white:
            "#cccccc",

          brightBlack:
            "#767676",

          brightRed:
            "#e74856",

          brightGreen:
            "#16c60c",

          brightYellow:
            "#f9f1a5",

          brightBlue:
            "#3b78ff",

          brightMagenta:
            "#b4009e",

          brightCyan:
            "#61d6d6",

          brightWhite:
            "#f2f2f2",

        },

      });


    terminalInstance.current =
      term;


    /*
     * ==========================================================
     * FitAddon
     * ==========================================================
     */

    const fitAddon =
      new FitAddon();


    fitAddonRef.current =
      fitAddon;


    term.loadAddon(
      fitAddon
    );


    /*
     * ==========================================================
     * Open
     * ==========================================================
     */

    term.open(
      container
    );


    /*
     * ==========================================================
     * Keyboard
     *
     * Docker：
     *
     *     原始 data
     *
     * 普通：
     *
     *     {"type":"input","data":"..."}
     *
     * ==========================================================
     */

    const dataDisposable =
      term.onData(
        (data) => {

          const ws =
            socketRef.current;

          const mode =
            socketModeRef.current;


          if (
            !ws ||
            ws.readyState !==
              WebSocket.OPEN
          ) {

            return;

          }


          try {

            /*
             * =================================================
             * Docker
             * =================================================
             *
             * 绝对不要 JSON.stringify。
             */

            if (
              mode === "docker"
            ) {

              ws.send(
                data
              );

              return;

            }


            /*
             * =================================================
             * 普通 Terminal
             * =================================================
             */

            if (
              mode === "normal"
            ) {

              ws.send(
                JSON.stringify({
                  type: "input",
                  data: data,
                })
              );

            }

          } catch (e) {

            console.error(
              "[Terminal] input send failed:",
              e
            );

          }

        }
      );


    /*
     * ==========================================================
     * Title
     * ==========================================================
     */

    const titleDisposable =
      term.onTitleChange(
        (title) => {

          if (title) {

            setWntitle(
              title
            );

          }

        }
      );


    /*
     * ==========================================================
     * ResizeObserver
     * ==========================================================
     */

    const resizeObserver =
      new ResizeObserver(
        () => {

          /*
           * 不修改窗口尺寸。
           *
           * 这里只让 xterm 适应
           * Win11React 已经决定好的区域。
           */

          resizeTerminal();

        }
      );


    resizeObserver.observe(
      container
    );


    resizeObserverRef.current =
      resizeObserver;


    /*
     * ==========================================================
     * 初始连接
     * ==========================================================
     */

    connectWebSocket(
      term,
      dockerContainer
    );


    /*
     * ==========================================================
     * 初始 Fit
     * ==========================================================
     */

    requestAnimationFrame(() => {

      requestAnimationFrame(() => {

        resizeTerminal();

      });

    });


    /*
     * ==========================================================
     * Focus
     * ==========================================================
     */

    const focusTimer =
      setTimeout(() => {

        try {

          term.focus();

        } catch (e) {}

      }, 150);


    /*
     * ==========================================================
     * Cleanup
     * ==========================================================
     */

    return () => {

      destroyedRef.current =
        true;


      clearTimeout(
        focusTimer
      );


      if (
        resizeFrameRef.current
      ) {

        cancelAnimationFrame(
          resizeFrameRef.current
        );

        resizeFrameRef.current =
          null;

      }


      if (
        resizeTimerRef.current
      ) {

        clearTimeout(
          resizeTimerRef.current
        );

        resizeTimerRef.current =
          null;

      }


      try {

        resizeObserver.disconnect();

      } catch (e) {}


      resizeObserverRef.current =
        null;


      try {

        dataDisposable.dispose();

      } catch (e) {}


      try {

        titleDisposable.dispose();

      } catch (e) {}


      /*
       * 让旧 WebSocket 永远失效。
       */

      socketGenerationRef.current += 1;


      closeWebSocket();


      /*
       * 清空并销毁 xterm。
       */

      try {

        term.clear();

        term.reset();

        term.dispose();

      } catch (e) {}


      terminalInstance.current =
        null;

      fitAddonRef.current =
        null;

    };

  }, []);


  /*
   * ============================================================
   * Terminal 模式 / 窗口状态变化
   * ============================================================
   *
   * 这是这版最重要的部分。
   *
   * 因为 Redux 的 hide=true 并不会卸载组件，
   * 所以必须主动管理 WebSocket 生命周期。
   * ============================================================
   */

  const previousModeRef =
    useRef(null);

  const previousContainerRef =
    useRef(null);

  const previousHideRef =
    useRef(null);


  useEffect(() => {

    if (
      destroyedRef.current
    ) {

      return;

    }


    const modeChanged =
      previousModeRef.current !==
      currentMode;


    const containerChanged =
      previousContainerRef.current !==
      dockerContainer;


    const hideChanged =
      previousHideRef.current !==
      wnapp.hide;


    /*
     * 第一次 render：
     *
     * 不重复连接。
     */

    if (
      previousModeRef.current ===
        null
    ) {

      previousModeRef.current =
        currentMode;

      previousContainerRef.current =
        dockerContainer;

      previousHideRef.current =
        wnapp.hide;

      return;

    }


    /*
     * ==========================================================
     * 窗口关闭 / 隐藏
     * ==========================================================
     */

    if (
      wnapp.hide &&
      hideChanged
    ) {

      console.log(
        "[Terminal] window hidden -> close websocket"
      );


      socketGenerationRef.current += 1;

      closeWebSocket();


      /*
       * 无论普通还是 Docker，
       * 关闭窗口都清空屏幕。
       */

      clearTerminal();


      previousModeRef.current =
        currentMode;

      previousContainerRef.current =
        dockerContainer;

      previousHideRef.current =
        wnapp.hide;

      return;

    }


    /*
     * ==========================================================
     * 窗口重新打开
     * ==========================================================
     */

    if (
      !wnapp.hide &&
      hideChanged
    ) {

      const term =
        terminalInstance.current;


      if (term) {

        /*
         * 清空旧内容。
         */

        clearTerminal();


        /*
         * 建立新 WebSocket。
         */

        connectWebSocket(
          term,
          dockerContainer
        );


        setTimeout(() => {

          resizeTerminal();

          try {

            term.focus();

          } catch (e) {}

        }, 80);

      }

    }


    /*
     * ==========================================================
     * Docker <-> 普通 Terminal
     * ==========================================================
     *
     * 例如：
     *
     * Docker A
     *     ↓
     * close
     *     ↓
     * 普通 Terminal
     *
     * 或：
     *
     * 普通 Terminal
     *     ↓
     * Docker A
     *
     * 都必须重新建立 WS。
     * ==========================================================
     */

    if (
      !wnapp.hide &&
      (modeChanged ||
        containerChanged)
    ) {

      const term =
        terminalInstance.current;


      if (term) {

        console.log(
          "[Terminal] mode changed:",
          currentMode,
          dockerContainer || ""
        );


        socketGenerationRef.current += 1;

        closeWebSocket();

        clearTerminal();


        connectWebSocket(
          term,
          dockerContainer
        );


        setTimeout(() => {

          resizeTerminal();

          try {

            term.focus();

          } catch (e) {}

        }, 80);

      }

    }


    /*
     * 保存状态。
     */

    previousModeRef.current =
      currentMode;

    previousContainerRef.current =
      dockerContainer;

    previousHideRef.current =
      wnapp.hide;

  }, [
    wnapp.hide,
    dockerContainer,
    currentMode,
  ]);


  /*
   * ============================================================
   * Win11React Window Resize / Maximize / Restore
   * ============================================================
   *
   * 注意：
   *
   * 这里只 fit xterm。
   *
   * 不修改：
   *
   *     wnapp.dim
   *     wnapp.size
   *     width
   *     height
   *     top
   *     left
   *
   * 窗口尺寸完全交给 Win11React。
   * ============================================================
   */

  useEffect(() => {

    if (
      wnapp.hide
    ) {

      return;

    }


    const timers = [];


    timers.push(
      setTimeout(() => {

        resizeTerminal();

      }, 30)
    );


    timers.push(
      setTimeout(() => {

        resizeTerminal();

        const term =
          terminalInstance.current;


        if (term) {

          try {

            term.focus();

          } catch (e) {}

        }

      }, 150)
    );


    timers.push(
      setTimeout(() => {

        resizeTerminal();

      }, 350)
    );


    return () => {

      timers.forEach(
        (timer) => {

          clearTimeout(
            timer
          );

        }
      );

    };

  }, [
    wnapp.size,
    wnapp.max,
    wnapp.hide,
    wnapp.dim,
  ]);


  /*
   * ============================================================
   * Render
   * ============================================================
   */

  return (

    <div
      className="wnterm floatTab dpShad"

      data-size={
        wnapp.size
      }

      data-max={
        wnapp.max
      }

      data-hide={
        wnapp.hide
      }

      id={
        wnapp.icon + "App"
      }

      style={{
        ...(wnapp.size === "cstm"
          ? wnapp.dim
          : {}),

        zIndex:
          wnapp.z,
      }}
    >

      <ToolBar
        app={
          wnapp.action
        }

        icon={
          wnapp.icon
        }

        size={
          wnapp.size
        }

        name={
          wntitle
        }

        invert

        bg="#060606"
      />


      <div
        className="terminal-body"
        style={{
          flex:
            "1 1 0",

          minHeight:
            0,

          minWidth:
            0,

          width:
            "100%",

          overflow:
            "hidden",

          display:
            "flex",
        }}
      >

        <div
          className="terminal-content"
          style={{
            flex:
              "1 1 0",

            minHeight:
            0,

            minWidth:
              0,

            width:
              "100%",

            height:
              "100%",

            overflow:
              "hidden",

            display:
              "flex",
          }}
        >

          <div
            ref={
              terminalRef
            }

            className="terminal-container"

            style={{
              flex:
                "1 1 0",

              minHeight:
                0,

              minWidth:
                0,

              width:
                "100%",

              height:
                "100%",

              overflow:
                "hidden",
            }}
          />

        </div>

      </div>

    </div>

  );

};


export default WnTerminal;
