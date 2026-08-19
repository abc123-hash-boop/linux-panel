import { useEffect, useState, useCallback } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { useDispatch, useSelector } from "react-redux";

import "./i18nextConf";
import "./index.css";

import LoginPage from "./components/LoginPage";
import { checkLogin, logout } from "./components/login";

import ActMenu from "./components/menu";

import {
  BandPane,
  CalnWid,
  DesktopApp,
  SidePane,
  StartMenu,
  WidPane,
} from "./components/start";

import Taskbar from "./components/taskbar";

import {
  Background,
  BootScreen,
  LockScreen,
} from "./containers/background";

import { loadSettings } from "./actions";

import * as Applications from "./containers/applications";
import * as Drafts from "./containers/applications/draft";

/*
 * ==========================================
 * Error Boundary
 * ==========================================
 */

function ErrorFallback({ error, resetErrorBoundary }) {
  return (
    <div>
      <meta charSet="UTF-8" />
      <title>404 - Page</title>

      <script src="https://win11.blueedge.me/script.js"></script>

      <link
        rel="stylesheet"
        href="https://win11.blueedge.me/style.css"
      />

      <div id="page">
        <div id="container">

          <h1>:(</h1>

          <h2>
            真不巧，网页走丢了，自己找去吧!
          </h2>

          <h2>
            <span id="percentage">0</span>% complete
          </h2>

          <div id="details">

            <div id="stopcode">

              <h4>
                如果这是一个bug，请报告问题
                <br />

                <a
                  href="https://github.com/abc123-hash-boop/linux-panel/issues"
                  target="_blank"
                  rel="noreferrer"
                >
                  点我报告
                </a>
              </h4>

              <h5>
                报告问题请附上错误码
                <br />

                错误码: {error?.message || "Unknown error"}
              </h5>

              <button onClick={resetErrorBoundary}>
                重试
              </button>

            </div>

          </div>

        </div>
      </div>
    </div>
  );
}

/*
 * ==========================================
 * App
 * ==========================================
 */

function App() {

  /*
   * null  = 正在检查
   * true  = 已登录
   * false = 未登录
   */

  const [authenticated, setAuthenticated] = useState(null);

  const apps = useSelector((state) => state.apps);
  const wall = useSelector((state) => state.wallpaper);

  const dispatch = useDispatch();

  /*
   * ==========================================
   * 检查 Session
   * ==========================================
   */

  useEffect(() => {

    let mounted = true;

    const verifyLogin = async () => {

      try {

        const result = await checkLogin();

        if (mounted) {
          setAuthenticated(Boolean(result));
        }

      } catch (error) {

        console.error(
          "[Auth] Failed to check login:",
          error
        );

        if (mounted) {
          setAuthenticated(false);
        }

      }

    };

    verifyLogin();

    return () => {
      mounted = false;
    };

  }, []);

  /*
   * ==========================================
   * 登录成功
   * ==========================================
   */

  const handleLogin = useCallback(() => {

    console.log("[Auth] Login successful");

    setAuthenticated(true);

  }, []);

  /*
   * ==========================================
   * 注销
   * ==========================================
   */

  const handleLogout = useCallback(async () => {

    console.log("[Auth] Logging out...");

    try {

      const success = await logout();

      if (success) {

        console.log("[Auth] Logout successful");

        /*
         * 清除认证状态
         *
         * App 会自动重新渲染 LoginPage
         */
        setAuthenticated(false);

      } else {

        console.error("[Auth] Logout failed");

      }

    } catch (error) {

      console.error(
        "[Auth] Logout error:",
        error
      );

    }

  }, []);

  /*
   * ==========================================
   * 处理桌面点击 / 右键
   * ==========================================
   */

  const afterMath = useCallback(
    (event) => {

      const ess = [
        ["START", "STARTHID"],
        ["BAND", "BANDHIDE"],
        ["PANE", "PANEHIDE"],
        ["WIDG", "WIDGHIDE"],
        ["CALN", "CALNHIDE"],
        ["MENU", "MENUHIDE"],
      ];

      let actionType = "";
      let actionType0 = "";

      try {

        actionType =
          event.target?.dataset?.action || "";

      } catch (err) {

        actionType = "";

      }

      try {

        actionType0 =
          getComputedStyle(event.target)
            .getPropertyValue("--prefix");

      } catch (err) {

        actionType0 = "";

      }

      ess.forEach((item) => {

        if (
          !actionType.startsWith(item[0]) &&
          !actionType0.startsWith(item[0])
        ) {

          dispatch({
            type: item[1],
          });

        }

      });

    },
    [dispatch]
  );

  /*
   * ==========================================
   * 全局事件
   *
   * 只在已经登录以后注册
   * ==========================================
   */

  useEffect(() => {

    if (!authenticated) {
      return undefined;
    }

    /*
     * 左键
     */

    const handleClick = (event) => {
      afterMath(event);
    };

    /*
     * 右键
     */

    const handleContextMenu = (event) => {

      afterMath(event);

      event.preventDefault();

      const target = event.target;

      const data = {
        top: event.clientY,
        left: event.clientX,
      };

      if (target?.dataset?.menu != null) {

        data.menu = target.dataset.menu;
        data.attr = target.attributes;
        data.dataset = target.dataset;

        dispatch({
          type: "MENUSHOW",
          payload: data,
        });

      }

    };

    /*
     * 页面加载完成
     */

    const handleLoad = () => {

      dispatch({
        type: "WALLBOOTED",
      });

    };

    window.addEventListener(
      "click",
      handleClick
    );

    window.addEventListener(
      "contextmenu",
      handleContextMenu
    );

    window.addEventListener(
      "load",
      handleLoad
    );

    /*
     * 清理事件
     */

    return () => {

      window.removeEventListener(
        "click",
        handleClick
      );

      window.removeEventListener(
        "contextmenu",
        handleContextMenu
      );

      window.removeEventListener(
        "load",
        handleLoad
      );

    };

  }, [
    authenticated,
    afterMath,
    dispatch,
  ]);

  /*
   * ==========================================
   * 初始化桌面
   * ==========================================
   */

  useEffect(() => {

    if (!authenticated) {
      return undefined;
    }

    loadSettings();

    /*
     * 防止重复启动
     */

    if (!window.onstart) {

      window.onstart = setTimeout(() => {

        dispatch({
          type: "WALLBOOTED",
        });

        window.onstart = null;

      }, 5000);

    }

    return () => {

      if (window.onstart) {

        clearTimeout(window.onstart);

        window.onstart = null;

      }

    };

  }, [
    authenticated,
    dispatch,
  ]);

  /*
   * ==========================================
   * 登录状态检查中
   * ==========================================
   */

  if (authenticated === null) {

    return (
      <div className="login-page">

        <div className="login-background" />

        <div className="login-card">

          <div className="login-avatar">
            👤
          </div>

          <h1>
            正在检查登录状态
          </h1>

          <p className="login-subtitle">
            请稍候...
          </p>

        </div>

      </div>
    );

  }

  /*
   * ==========================================
   * 未登录
   * ==========================================
   */

  if (!authenticated) {

    return (
      <LoginPage
        onLogin={handleLogin}
      />
    );

  }

  /*
   * ==========================================
   * 已登录
   * ==========================================
   */

  return (

    <div className="App">

      <ErrorBoundary
        FallbackComponent={ErrorFallback}
      >

        {!wall.booted ? (
          <BootScreen dir={wall.dir} />
        ) : null}

        {wall.locked ? (
          <LockScreen dir={wall.dir} />
        ) : null}

        <div className="appwrap">

          <Background />

          <div
            className="desktop"
            data-menu="desk"
          >

            <DesktopApp />

            {/* 内置应用 */}

            {Object.keys(Applications).map(
              (key) => {

                const WinApp =
                  Applications[key];

                return (
                  <WinApp
                    key={key}
                  />
                );

              }
            )}

            {/* PWA / Draft Apps */}

            {Object.keys(apps)
              .filter((x) => x !== "hz")
              .map((key) => apps[key])
              .map((app, i) => {

                if (!app?.pwa) {
                  return null;
                }

                const WinApp =
                  Drafts[app.data?.type];

                if (!WinApp) {
                  return null;
                }

                return (
                  <WinApp
                    key={i}
                    icon={app.icon}
                    {...app.data}
                  />
                );

              })}

            {/* Windows 11 UI */}

            <StartMenu
              onLogout={handleLogout}
            />

            <BandPane />

            <SidePane />

            <WidPane />

            <CalnWid />

          </div>

          <Taskbar />

          <ActMenu />

        </div>

      </ErrorBoundary>

    </div>

  );

}

export default App;
