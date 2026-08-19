import React, {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  useSelector,
  useDispatch,
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
   * =========================================================
   * Redux
   * =========================================================
   */

  const wnapp = useSelector(
    (state) => state.apps.terminal
  );

  const dispatch = useDispatch();


  /*
   * =========================================================
   * Refs
   * =========================================================
   */

  const terminalRef = useRef(null);

  const terminalInstance =
    useRef(null);

  const socketRef =
    useRef(null);

  const fitAddonRef =
    useRef(null);

  const resizeFrameRef =
    useRef(null);

  const resizeTimerRef =
    useRef(null);

  /*
   * 防止关闭窗口时：
   *
   * WebSocket onclose
   * 又被当成异常断开
   */

  const intentionalCloseRef =
    useRef(false);


  /*
   * =========================================================
   * Window title
   * =========================================================
   */

  const [
    wntitle,
    setWntitle,
  ] = useState("Terminal");


  /*
   * =========================================================
   * WebSocket URL
   *
   * HTTPS -> WSS
   * HTTP  -> WS
   * =========================================================
   */

  const getWebSocketURL = () => {

    const protocol =
      window.location.protocol === "https:"
        ? "wss:"
        : "ws:";

    return (
      `${protocol}//${window.location.host}/ws/terminal`
    );

  };


  /*
   * =========================================================
   * Fit xterm
   * =========================================================
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


    const width =
      container.clientWidth;

    const height =
      container.clientHeight;


    /*
     * 窗口隐藏 / 尚未完成 layout 时，
     * 不进行 fit。
     */

    if (
      width <= 0 ||
      height <= 0
    ) {

      return;

    }


    try {

      fitAddon.fit();

    } catch (error) {

      console.warn(
        "[Terminal] fit failed:",
        error
      );

    }

  };


  /*
   * =========================================================
   * Send PTY resize
   *
   * resize 是控制消息，
   * 不直接进入 bash。
   * =========================================================
   */

  const sendResize = () => {

    const ws =
      socketRef.current;

    const term =
      terminalInstance.current;


    if (
      !ws ||
      ws.readyState !== WebSocket.OPEN ||
      !term
    ) {

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

    } catch (error) {

      console.warn(
        "[Terminal] resize send failed:",
        error
      );

    }

  };


  /*
   * =========================================================
   * Resize terminal
   *
   * Win11React 拖动窗口时会产生大量 resize。
   *
   * requestAnimationFrame
   * +
   * debounce
   *
   * 防止疯狂调用 fit / resize。
   * =========================================================
   */

  const resizeTerminal = () => {

    /*
     * 取消之前的 animation frame
     */

    if (
      resizeFrameRef.current
    ) {

      cancelAnimationFrame(
        resizeFrameRef.current
      );

    }


    resizeFrameRef.current =
      requestAnimationFrame(() => {

        /*
         * 首先让 xterm 根据实际 DOM 尺寸重新计算
         */

        fitTerminal();


        /*
         * 再稍微延迟发送 PTY resize。
         */

        if (
          resizeTimerRef.current
        ) {

          clearTimeout(
            resizeTimerRef.current
          );

        }


        resizeTimerRef.current =
          setTimeout(() => {

            sendResize();

          }, 30);

      });

  };


  /*
   * =========================================================
   * Connect WebSocket
   * =========================================================
   */

  const connectWebSocket = (
    term
  ) => {

    /*
     * 如果存在旧连接，
     * 先关闭。
     */

    if (
      socketRef.current
    ) {

      try {

        socketRef.current.close();

      } catch (e) {}

      socketRef.current =
        null;

    }


    const url =
      getWebSocketURL();


    console.log(
      "[Terminal] Connecting:",
      url
    );


    const ws =
      new WebSocket(url);


    /*
     * 后端 PTY 输出可以使用 binary。
     */

    ws.binaryType =
      "arraybuffer";


    socketRef.current =
      ws;


    /*
     * =======================================================
     * WebSocket OPEN
     * =======================================================
     */

    ws.onopen = () => {

      console.log(
        "[Terminal] WebSocket connected"
      );


      /*
       * WebSocket 建立后，
       * 告诉服务器当前 xterm 尺寸。
       */

      setTimeout(() => {

        fitTerminal();

        sendResize();

      }, 0);


      /*
       * 自动 focus
       */

      setTimeout(() => {

        try {

          term.focus();

        } catch (e) {}

      }, 50);

    };


    /*
     * =======================================================
     * Server -> xterm
     * =======================================================
     */

    ws.onmessage = async (
      event
    ) => {

      /*
       * -----------------------------------------------
       * Text
       * -----------------------------------------------
       */

      if (
        typeof event.data === "string"
      ) {

        try {

          term.write(
            event.data
          );

        } catch (error) {

          console.error(
            "[Terminal] xterm write error:",
            error
          );

        }

        return;

      }


      /*
       * -----------------------------------------------
       * ArrayBuffer
       * -----------------------------------------------
       */

      if (
        event.data instanceof ArrayBuffer
      ) {

        try {

          const decoder =
            new TextDecoder();

          term.write(
            decoder.decode(
              event.data
            )
          );

        } catch (error) {

          console.error(
            "[Terminal] ArrayBuffer decode error:",
            error
          );

        }

        return;

      }


      /*
       * -----------------------------------------------
       * Blob
       * -----------------------------------------------
       */

      if (
        event.data instanceof Blob
      ) {

        try {

          const buffer =
            await event.data.arrayBuffer();

          const decoder =
            new TextDecoder();

          term.write(
            decoder.decode(
              buffer
            )
          );

        } catch (error) {

          console.error(
            "[Terminal] Blob decode error:",
            error
          );

        }

      }

    };


    /*
     * =======================================================
     * WebSocket ERROR
     * =======================================================
     */

    ws.onerror = (
      error
    ) => {

      console.error(
        "[Terminal] WebSocket error:",
        error
      );

    };


    /*
     * =======================================================
     * WebSocket CLOSE
     * =======================================================
     */

    ws.onclose = (
      event
    ) => {

      console.log(
        "[Terminal] WebSocket closed:",
        event.code,
        event.reason
      );


      /*
       * 只有当前 socket 才能清空引用。
       */

      if (
        socketRef.current === ws
      ) {

        socketRef.current =
          null;

      }


      /*
       * 用户主动关闭窗口，
       * 不做任何处理。
       */

      if (
        intentionalCloseRef.current
      ) {

        return;

      }


      /*
       * bash 执行 exit：
       *
       * PTY 结束
       * ->
       * WebSocket 关闭
       *
       * 这是正常行为。
       *
       * 不自动显示 Connection closed。
       */

    };

  };


  /*
   * =========================================================
   * Initialize xterm
   * =========================================================
   */

  useEffect(() => {

    const container =
      terminalRef.current;


    if (
      !container
    ) {

      return;

    }


    /*
     * =======================================================
     * FitAddon
     * =======================================================
     */

    const fitAddon =
      new FitAddon();


    fitAddonRef.current =
      fitAddon;


    /*
     * =======================================================
     * Create xterm
     * =======================================================
     */

    const term =
      new Terminal({

        /*
         * Cursor
         */

        cursorBlink:
          true,

        cursorStyle:
          "block",


        /*
         * Font
         */

        fontFamily:
          '"Cascadia Mono", "Cascadia Code", Consolas, monospace',

        fontSize:
          14,

        lineHeight:
          1.1,


        /*
         * Scrollback
         */

        scrollback:
          5000,


        /*
         * Linux PTY
         *
         * 不强制转换换行。
         */

        convertEol:
          false,


        /*
         * Mouse
         */

        rightClickSelectsWord:
          true,


        /*
         * Transparency
         */

        allowTransparency:
          false,


        /*
         * Theme
         */

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
     * 加载 FitAddon
     */

    term.loadAddon(
      fitAddon
    );


    /*
     * =======================================================
     * Open
     * =======================================================
     */

    term.open(
      container
    );


    /*
     * =======================================================
     * Keyboard input
     *
     * 所有按键由 xterm 处理：
     *
     * Enter
     * Backspace
     * Ctrl+C
     * Ctrl+D
     * Ctrl+Z
     * ESC
     * F1-F12
     * Tab
     * Arrow
     * 等等
     *
     * 然后发送给服务器。
     * =======================================================
     */

    const dataDisposable =
      term.onData(
        (data) => {

          const ws =
            socketRef.current;


          if (
            !ws ||
            ws.readyState !== WebSocket.OPEN
          ) {

            return;

          }


          try {

            ws.send(
              JSON.stringify({
                type: "input",
                data: data,
              })
            );

          } catch (error) {

            console.error(
              "[Terminal] input send failed:",
              error
            );

          }

        }
      );


    /*
     * =======================================================
     * Terminal title
     * =======================================================
     */

    const titleDisposable =
      term.onTitleChange(
        (title) => {

          if (
            title
          ) {

            setWntitle(
              title
            );

          }

        }
      );


    /*
     * =======================================================
     * ResizeObserver
     * =======================================================
     */

    const resizeObserver =
      new ResizeObserver(
        () => {

          resizeTerminal();

        }
      );


    resizeObserver.observe(
      container
    );


    /*
     * =======================================================
     * Connect WebSocket
     * =======================================================
     */

    connectWebSocket(
      term
    );


    /*
     * =======================================================
     * Initial fit
     *
     * Win11React DOM 通常需要两帧才能稳定。
     * =======================================================
     */

    requestAnimationFrame(() => {

      requestAnimationFrame(() => {

        resizeTerminal();

      });

    });


    /*
     * =======================================================
     * Focus
     * =======================================================
     */

    const focusTimer =
      setTimeout(() => {

        try {

          term.focus();

        } catch (e) {}

      }, 150);


    /*
     * =======================================================
     * Cleanup
     * =======================================================
     */

    return () => {

      console.log(
        "[Terminal] Destroy"
      );


      /*
       * 清理 timer
       */

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


      /*
       * ResizeObserver
       */

      resizeObserver.disconnect();


      /*
       * xterm events
       */

      dataDisposable.dispose();

      titleDisposable.dispose();


      /*
       * 标记为主动销毁。
       */

      intentionalCloseRef.current =
        true;


      /*
       * WebSocket
       */

      if (
        socketRef.current
      ) {

        try {

          socketRef.current.close();

        } catch (e) {}

        socketRef.current =
          null;

      }


      /*
       * xterm
       */

      try {

        term.dispose();

      } catch (e) {}


      terminalInstance.current =
        null;

      fitAddonRef.current =
        null;

    };

  }, []);


  /*
   * =========================================================
   * Win11React window state changed
   *
   * 最大化
   * 恢复
   * 自定义尺寸
   * 隐藏
   * 等
   * =========================================================
   */

  useEffect(() => {

    const timer =
      setTimeout(() => {

        resizeTerminal();


        const term =
          terminalInstance.current;


        if (
          term
        ) {

          try {

            term.focus();

          } catch (e) {}

        }

      }, 100);


    return () => {

      clearTimeout(
        timer
      );

    };

  }, [
    wnapp.size,
    wnapp.max,
    wnapp.hide,
    wnapp.dim,
  ]);


  /*
   * =========================================================
   * Close
   * =========================================================
   */

  const closeTerminal = () => {

    intentionalCloseRef.current =
      true;


    dispatch({
      type:
        wnapp.action,

      payload:
        "close",
    });

  };


  /*
   * =========================================================
   * Render
   * =========================================================
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
          : null),

        zIndex:
          wnapp.z,

        minWidth:
          0,

        minHeight:
          0,

        display:
          "flex",

        flexDirection:
          "column",

        overflow:
          "hidden",
      }}
    >

      {/*
       * =====================================================
       * Win11React title bar
       * =====================================================
       */}

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


      {/*
       * =====================================================
       * Terminal body
       * =====================================================
       */}

      <div
        className="terminal-body"

        data-dock="true"
      >

        <div
          className="terminal-content"
        >

          <div
            ref={
              terminalRef
            }

            className="terminal-container"
          />

        </div>

      </div>

    </div>

  );

};
