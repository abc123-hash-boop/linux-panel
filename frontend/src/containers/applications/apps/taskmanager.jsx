import React, {
  useEffect,
  useRef,
  useState,
} from "react";

import { useSelector } from "react-redux";

import {
  ToolBar,
  Icon,
} from "../../../utils/general";

import "./assets/taskmanager.scss";

import apps from "../../../utils/apps";


let appList = [];

apps.map((e) => {
  appList.push(e.name);
});


/*
 * ============================================================
 * Task Manager
 *
 * 数据来源：
 *
 *     /ws/status
 *
 * 当前后端提供：
 *
 * cpu
 * cpu_cores
 * cpu_threads
 * cpu_model
 * memory
 * disk
 * load1
 * load5
 * load15
 * network.rx
 * network.tx
 * hostname
 * kernel
 * os
 * uptime
 * uptime_text
 *
 * WebSocket 自动重连。
 * ============================================================
 */


const emptyStatus = {
  cpu: 0,
  cpu_cores: 0,
  cpu_threads: 0,
  cpu_model: "",
  memory: 0,
  disk: 0,
  load1: 0,
  load5: 0,
  load15: 0,
  network: {
    rx: 0,
    tx: 0,
  },
  hostname: "",
  kernel: "",
  os: "",
  uptime: 0,
  uptime_text: "",
};


export const Taskmanager = () => {

  const wnapp =
    useSelector(
      (state) =>
        state.apps.taskmanager
    );


  const [
    tab,
    setTab,
  ] = useState("Processes");


  const [
    nav,
    setNav,
  ] = useState("open");


  /*
   * ==========================================================
   * WebSocket 状态
   * ==========================================================
   */

  const [
    status,
    setStatus,
  ] = useState(emptyStatus);


  const [
    wsConnected,
    setWsConnected,
  ] = useState(false);


  const wsRef =
    useRef(null);


  const reconnectTimerRef =
    useRef(null);


  const shouldReconnectRef =
    useRef(true);


  /*
   * ==========================================================
   * WebSocket
   *
   * 浏览器会自动携带当前站点 Cookie，
   * 因此不需要手动读取 HttpOnly session。
   * ==========================================================
   */

  useEffect(() => {

    shouldReconnectRef.current = true;


    const connect = () => {

      if (
        !shouldReconnectRef.current
      ) {

        return;

      }


      /*
       * 页面 HTTPS -> WSS
       * 页面 HTTP  -> WS
       */

      const protocol =
        window.location.protocol === "https:"
          ? "wss:"
          : "ws:";


      const wsURL =
        `${protocol}//${window.location.host}/ws/status`;


      console.log(
        "[TaskManager] Connecting:",
        wsURL
      );


      const ws =
        new WebSocket(wsURL);


      wsRef.current = ws;


      ws.onopen = () => {

        console.log(
          "[TaskManager] WebSocket connected"
        );


        setWsConnected(true);

      };


      ws.onmessage = (event) => {

        try {

          const data =
            JSON.parse(
              event.data
            );


          setStatus(
            (old) => ({
              ...old,
              ...data,

              network: {
                ...(old.network || {}),
                ...(data.network || {}),
              },
            })
          );

        } catch (error) {

          console.error(
            "[TaskManager] Invalid WebSocket data:",
            error
          );

        }

      };


      ws.onerror = (error) => {

        console.error(
          "[TaskManager] WebSocket error:",
          error
        );

      };


      ws.onclose = () => {

        console.log(
          "[TaskManager] WebSocket disconnected"
        );


        setWsConnected(false);


        if (
          !shouldReconnectRef.current
        ) {

          return;

        }


        if (
          reconnectTimerRef.current
        ) {

          return;

        }


        reconnectTimerRef.current =
          setTimeout(() => {

            reconnectTimerRef.current =
              null;

            connect();

          }, 3000);

      };

    };


    connect();


    return () => {

      shouldReconnectRef.current =
        false;


      if (
        reconnectTimerRef.current
      ) {

        clearTimeout(
          reconnectTimerRef.current
        );

        reconnectTimerRef.current =
          null;

      }


      if (
        wsRef.current
      ) {

        wsRef.current.close();

        wsRef.current =
          null;

      }

    };

  }, []);


  /*
   * ==========================================================
   * 导航
   * ==========================================================
   */

  const tabNames = [

    {
      title: "Processes",
      icon: "faTableCellsLarge",
    },

    {
      title: "Performance",
      icon: "faWaveSquare",
    },

    {
      title: "App history",
      icon: "faClockRotateLeft",
    },

    {
      title: "Startup apps",
      icon: "faGaugeHigh",
    },

    {
      title: "Users",
      icon: "faUser",
    },

    {
      title: "Details",
      icon: "faList",
    },

    {
      title: "Services",
      icon: "faPuzzlePiece",
    },

    {
      title: "Settings",
      icon: "faGear",
    },

  ];


  const powerUsage = [
    "Very low",
    "Low",
    "Moderate",
    "High",
    "Very High",
  ];


  /*
   * ==========================================================
   * 格式化网络数据
   * ==========================================================
   */

  const formatNetwork =
    (value) => {

      const number =
        Number(value) || 0;


      if (
        number < 1024
      ) {

        return `${number.toFixed(0)} B/s`;

      }


      if (
        number < 1024 * 1024
      ) {

        return `${(
          number / 1024
        ).toFixed(2)} KB/s`;

      }


      if (
        number < 1024 * 1024 * 1024
      ) {

        return `${(
          number /
          1024 /
          1024
        ).toFixed(2)} MB/s`;

      }


      return `${(
        number /
        1024 /
        1024 /
        1024
      ).toFixed(2)} GB/s`;

    };


  /*
   * ==========================================================
   * Performance 页面
   * ==========================================================
   */

  const Performance = () => {

    return (

      <div className="performance">

        <div className="performance-grid">


          {/* ==================================================
              CPU
          ================================================== */}

          <section className="hardware-card">

            <div className="hardware-card-header">

              <div className="hardware-title">

                <Icon
                  fafa="faMicrochip"
                  width={18}
                />

                <span>
                  CPU
                </span>

              </div>


              <div
                className="hardware-value"
              >
                {Number(
                  status.cpu
                ).toFixed(1)}
                %
              </div>

            </div>


            <div className="usage-bar">

              <div
                className="usage-fill"
                style={{
                  width: `${Math.min(
                    Math.max(
                      Number(status.cpu) || 0,
                      0
                    ),
                    100
                  )}%`,
                }}
              />

            </div>


            <div className="hardware-info">

              <div className="hardware-info-row">

                <span>
                  Model
                </span>

                <strong>
                  {status.cpu_model || "-"}
                </strong>

              </div>


              <div className="hardware-info-row">

                <span>
                  Cores
                </span>

                <strong>
                  {status.cpu_cores || 0}
                </strong>

              </div>


              <div className="hardware-info-row">

                <span>
                  Threads
                </span>

                <strong>
                  {status.cpu_threads || 0}
                </strong>

              </div>


              <div className="hardware-info-row">

                <span>
                  Load
                </span>

                <strong>
                  {Number(
                    status.load1 || 0
                  ).toFixed(2)}
                  {" / "}
                  {Number(
                    status.load5 || 0
                  ).toFixed(2)}
                  {" / "}
                  {Number(
                    status.load15 || 0
                  ).toFixed(2)}
                </strong>

              </div>

            </div>

          </section>


          {/* ==================================================
              Memory
          ================================================== */}

          <section className="hardware-card">

            <div className="hardware-card-header">

              <div className="hardware-title">

                <Icon
                  fafa="faMemory"
                  width={18}
                />

                <span>
                  Memory
                </span>

              </div>


              <div
                className="hardware-value"
              >
                {Number(
                  status.memory
                ).toFixed(1)}
                %
              </div>

            </div>


            <div className="usage-bar">

              <div
                className="usage-fill"
                style={{
                  width: `${Math.min(
                    Math.max(
                      Number(status.memory) || 0,
                      0
                    ),
                    100
                  )}%`,
                }}
              />

            </div>


            <div className="hardware-info">

              <div className="hardware-info-row">

                <span>
                  Usage
                </span>

                <strong>
                  {Number(
                    status.memory
                  ).toFixed(1)}
                  %
                </strong>

              </div>

            </div>

          </section>


          {/* ==================================================
              Disk
          ================================================== */}

          <section className="hardware-card">

            <div className="hardware-card-header">

              <div className="hardware-title">

                <Icon
                  fafa="faHardDrive"
                  width={18}
                />

                <span>
                  Disk
                </span>

              </div>


              <div
                className="hardware-value"
              >
                {Number(
                  status.disk
                ).toFixed(1)}
                %
              </div>

            </div>


            <div className="usage-bar">

              <div
                className="usage-fill"
                style={{
                  width: `${Math.min(
                    Math.max(
                      Number(status.disk) || 0,
                      0
                    ),
                    100
                  )}%`,
                }}
              />

            </div>


            <div className="hardware-info">

              <div className="hardware-info-row">

                <span>
                  Usage
                </span>

                <strong>
                  {Number(
                    status.disk
                  ).toFixed(1)}
                  %
                </strong>

              </div>

            </div>

          </section>


          {/* ==================================================
              Network
          ================================================== */}

          <section className="hardware-card">

            <div className="hardware-card-header">

              <div className="hardware-title">

                <Icon
                  fafa="faNetworkWired"
                  width={18}
                />

                <span>
                  Network
                </span>

              </div>

            </div>


            <div className="network-stats">

              <div className="network-item">

                <span className="network-label">
                  ↓ Receive
                </span>

                <strong>
                  {formatNetwork(
                    status.network?.rx
                  )}
                </strong>

              </div>


              <div className="network-item">

                <span className="network-label">
                  ↑ Transmit
                </span>

                <strong>
                  {formatNetwork(
                    status.network?.tx
                  )}
                </strong>

              </div>

            </div>

          </section>


          {/* ==================================================
              System
          ================================================== */}

          <section className="hardware-card system-card">

            <div className="hardware-card-header">

              <div className="hardware-title">

                <Icon
                  fafa="faDesktop"
                  width={18}
                />

                <span>
                  System
                </span>

              </div>

            </div>


            <div className="hardware-info">

              <div className="hardware-info-row">

                <span>
                  Hostname
                </span>

                <strong>
                  {status.hostname || "-"}
                </strong>

              </div>


              <div className="hardware-info-row">

                <span>
                  OS
                </span>

                <strong>
                  {status.os || "-"}
                </strong>

              </div>


              <div className="hardware-info-row">

                <span>
                  Kernel
                </span>

                <strong>
                  {status.kernel || "-"}
                </strong>

              </div>


              <div className="hardware-info-row">

                <span>
                  Uptime
                </span>

                <strong>
                  {status.uptime_text || "-"}
                </strong>

              </div>

            </div>

          </section>


        </div>


        <div className="status-indicator">

          <span
            className={
              wsConnected
                ? "status-dot connected"
                : "status-dot"
            }
          />

          <span>
            {wsConnected
              ? "Connected"
              : "Reconnecting..."}
          </span>

        </div>

      </div>

    );

  };


  /*
   * ==========================================================
   * Render
   * ==========================================================
   */

  return (

    <div
      className="taskmanagerApp floatTab dpShad"

      data-size={
        wnapp.size
      }

      data-max={
        wnapp.max
      }

      style={{
        ...(wnapp.size === "cstm"
          ? wnapp.dim
          : null),

        zIndex:
          wnapp.z,
      }}

      data-hide={
        wnapp.hide
      }

      id={
        wnapp.icon +
        "App"
      }
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

        name="Task Manager"
      />


      <div
        className="windowScreen flex flex-col"
        data-dock="true"
      >

        <div
          className="restWindow flex-grow flex flex-col"
        >


          {/* ==================================================
              左侧导航
          ================================================== */}

          <nav
            className={nav}
          >

            {tabNames.map(
              (
                item,
                index
              ) => {

                return (

                  <div
                    key={index}

                    className={
                      `navLink ${
                        item.title === tab
                          ? "selected"
                          : ""
                      }`
                    }

                    onClick={() =>
                      setTab(
                        item.title
                      )
                    }
                  >

                    <Icon
                      className="mx-2"
                      fafa={item.icon}
                    />

                    <span
                      className="tabName"
                    >
                      {item.title}
                    </span>

                  </div>

                );

              }
            )}


            <div
              className="marker"
            />

          </nav>


          {/* ==================================================
              主内容
          ================================================== */}

          <main
            className="win11Scroll"
          >

            <h3>
              {tab}
            </h3>


            {(() => {

              switch (tab) {


                /*
                 * ==================================================
                 * Processes
                 * ==================================================
                 */

                case "Processes":

                  return (

                    <div
                      className="Processes"
                    >

                      <table>

                        <thead>

                          <tr>

                            <th>
                              Name
                            </th>

                            <th>
                              CPU
                            </th>

                            <th>
                              Memory
                            </th>

                            <th>
                              Disk
                            </th>

                            <th>
                              Network
                            </th>

                            <th>
                              GPU
                            </th>

                            <th>
                              Power Usage
                            </th>

                          </tr>

                        </thead>


                        <tbody>

                          {appList.map(
                            (
                              item,
                              index
                            ) => {

                              return (

                                <tr
                                  key={index}
                                >

                                  <td
                                    className="name"
                                  >
                                    {item}
                                  </td>

                                  <td>
                                    {(Math.random() * 10).toFixed(2)}
                                    %
                                  </td>

                                  <td>
                                    {(Math.random() * 100).toFixed(2)}
                                    {" "}
                                    MB
                                  </td>

                                  <td>
                                    {(Math.random() * 50).toFixed(2)}
                                    {" "}
                                    MB/s
                                  </td>

                                  <td>
                                    {(Math.random() * 50).toFixed(2)}
                                    {" "}
                                    MBps
                                  </td>

                                  <td>
                                    {(Math.random() * 10).toFixed(2)}
                                    %
                                  </td>

                                  <td>

                                    {
                                      powerUsage[
                                        Math.floor(
                                          Math.random() *
                                          powerUsage.length
                                        )
                                      ]
                                    }

                                  </td>

                                </tr>

                              );

                            }
                          )}

                        </tbody>

                      </table>

                    </div>

                  );


                /*
                 * ==================================================
                 * Performance
                 * ==================================================
                 */

                case "Performance":

                  return (
                    <Performance />
                  );


                /*
                 * ==================================================
                 * 其他页面
                 * ==================================================
                 */

                default:

                  return (
                    <div className="empty-tab">
                      {tab}
                    </div>
                  );

              }

            })()}

          </main>


          {/* ==================================================
              菜单按钮
          ================================================== */}

          <div
            className="navMenuBtn"

            onClick={() =>
              setNav(
                nav
                  ? ""
                  : "open"
              )
            }
          >

            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="currentColor"
              viewBox="0 0 48 48"
              width={24}
              height={24}
            >

              <path
                d="M5.5 9a1.5 1.5 0 1 0 0 3h37a1.5 1.5 0 1 0 0-3h-37zm0 13.5a1.5 1.5 0 1 0 0 3h37a1.5 1.5 0 1 0 0-3h-37zm0 13.5a1.5 1.5 0 1 0 0 3h37a1.5 1.5 0 1 0 0-3h-37z"
              />

            </svg>

          </div>

        </div>

      </div>

    </div>

  );

};


export default Taskmanager;
