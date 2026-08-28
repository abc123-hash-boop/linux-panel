import { allApps } from "../utils";

var dev = "";

if (import.meta.env.MODE == "development") {
  dev = "";
}

const defState = {};

for (var i = 0; i < allApps.length; i++) {
  defState[allApps[i].icon] = allApps[i];

  defState[allApps[i].icon].size = "full";
  defState[allApps[i].icon].hide = true;
  defState[allApps[i].icon].max = null;
  defState[allApps[i].icon].z = 0;

  if (allApps[i].icon == dev) {
    defState[allApps[i].icon].size = "mini";
    defState[allApps[i].icon].hide = false;
    defState[allApps[i].icon].max = true;
    defState[allApps[i].icon].z = 1;
  }
}

defState.hz = 2;

console.log("APP STATE", defState);

const appReducer = (state = defState, action) => {
  var tmpState = { ...state };

  /*
   * ============================================================
   * Edge
   * ============================================================
   */

  if (action.type == "EDGELINK") {
    var obj = { ...tmpState["edge"] };

    if (
      action.payload &&
      action.payload.startsWith("http")
    ) {
      obj.url = action.payload;
    } else if (
      action.payload &&
      action.payload.length != 0
    ) {
      obj.url =
        "https://www.bing.com/search?q=" +
        action.payload;
    } else {
      obj.url = null;
    }

    obj.size = "full";
    obj.hide = false;
    obj.max = true;

    tmpState.hz += 1;
    obj.z = tmpState.hz;

    tmpState["edge"] = obj;

    return tmpState;
  }

  /*
   * ============================================================
   * Show Desktop
   * ============================================================
   */

  else if (action.type == "SHOWDSK") {
    var keys = Object.keys(tmpState);

    for (var i = 0; i < keys.length; i++) {
      var obj = tmpState[keys[i]];

      if (
        obj &&
        obj.hide == false
      ) {
        obj.max = false;

        if (obj.z == tmpState.hz) {
          tmpState.hz -= 1;
        }

        obj.z = -1;

        tmpState[keys[i]] = obj;
      }
    }

    return tmpState;
  }

  /*
   * ============================================================
   * External
   * ============================================================
   */

  else if (action.type == "EXTERNAL") {
    window.open(
      action.payload,
      "_blank"
    );

    return state;
  }

  /*
   * ============================================================
   * 普通 Terminal
   *
   * 一定清除 Docker 状态
   * ============================================================
   */

  else if (action.type == "OPENTERM") {
    var obj = {
      ...tmpState["terminal"]
    };

    /*
     * 普通 Terminal
     */

    obj.dockerContainer = null;

    /*
     * 当前目录
     */

    obj.dir =
      action.payload || null;

    obj.size = "full";
    obj.hide = false;
    obj.max = true;

    tmpState.hz += 1;

    obj.z = tmpState.hz;

    tmpState["terminal"] = obj;

    return tmpState;
  }

  /*
   * ============================================================
   * Docker Terminal
   * ============================================================
   */

  else if (action.type == "DOCKERTERMINAL") {
    var obj = {
      ...tmpState["terminal"]
    };

    /*
     * 保存 Docker Container ID
     */

    obj.dockerContainer =
      action.payload;

    /*
     * Docker Terminal 不使用普通目录
     */

    obj.dir = null;

    obj.size = "full";
    obj.hide = false;
    obj.max = true;

    tmpState.hz += 1;

    obj.z = tmpState.hz;

    tmpState["terminal"] = obj;

    return tmpState;
  }

  /*
   * ============================================================
   * Add App
   * ============================================================
   */

  else if (action.type == "ADDAPP") {
    tmpState[action.payload.icon] =
      {
        ...action.payload,

        size: "full",
        hide: true,
        max: null,
        z: 0,
      };

    return tmpState;
  }

  /*
   * ============================================================
   * Delete App
   * ============================================================
   */

  else if (action.type == "DELAPP") {
    delete tmpState[action.payload];

    return tmpState;
  }

  /*
   * ============================================================
   * 普通 App Window 操作
   * ============================================================
   */

  else {
    var keys = Object.keys(state);

    for (
      var i = 0;
      i < keys.length;
      i++
    ) {
      var obj = state[keys[i]];

      if (
        obj &&
        obj.action == action.type
      ) {
        tmpState = {
          ...state,

          [keys[i]]: {
            ...state[keys[i]]
          }
        };

        obj =
          tmpState[keys[i]];

        /*
         * ======================================================
         * Open Full
         * ======================================================
         */

        if (
          action.payload == "full"
        ) {
          obj.size = "full";
          obj.hide = false;
          obj.max = true;

          tmpState.hz += 1;
          obj.z = tmpState.hz;
        }

        /*
         * ======================================================
         * CLOSE
         *
         * 这里是本次最重要的修改
         * ======================================================
         */

        else if (
          action.payload == "close"
        ) {
          obj.hide = true;
          obj.max = null;
          obj.z = -1;

          /*
           * Terminal 关闭时：
           *
           * 必须清除 Docker Container 状态。
           *
           * 否则：
           *
           * Docker Terminal
           *     ↓
           * close
           *     ↓
           * desktop Terminal
           *     ↓
           * 仍然认为自己是 Docker Terminal
           */

          if (
            keys[i] == "terminal"
          ) {
            obj.dockerContainer = null;
            obj.dir = null;
          }

          /*
           * 防止 hz 无限减
           */

          if (
            tmpState.hz > 0
          ) {
            tmpState.hz -= 1;
          }
        }

        /*
         * ======================================================
         * Maximize / Restore
         * ======================================================
         */

        else if (
          action.payload == "mxmz"
        ) {
          obj.size =
            [
              "mini",
              "full"
            ][
              obj.size != "full"
                ? 1
                : 0
            ];

          obj.hide = false;
          obj.max = true;

          tmpState.hz += 1;
          obj.z = tmpState.hz;
        }

        /*
         * ======================================================
         * Toggle
         * ======================================================
         */

        else if (
          action.payload == "togg"
        ) {
          if (
            obj.z != tmpState.hz
          ) {
            obj.hide = false;

            if (!obj.max) {
              tmpState.hz += 1;

              obj.z =
                tmpState.hz;

              obj.max = true;
            } else {
              obj.z = -1;
              obj.max = false;
            }
          } else {
            obj.max = !obj.max;
            obj.hide = false;

            if (obj.max) {
              tmpState.hz += 1;

              obj.z =
                tmpState.hz;
            } else {
              obj.z = -1;

              if (
                tmpState.hz > 0
              ) {
                tmpState.hz -= 1;
              }
            }
          }
        }

        /*
         * ======================================================
         * Minimize
         * ======================================================
         */

        else if (
          action.payload == "mnmz"
        ) {
          obj.max = false;
          obj.hide = false;

          if (
            obj.z == tmpState.hz
          ) {
            if (
              tmpState.hz > 0
            ) {
              tmpState.hz -= 1;
            }
          }

          obj.z = -1;
        }

        /*
         * ======================================================
         * Resize
         * ======================================================
         */

        else if (
          action.payload == "resize"
        ) {
          obj.size = "cstm";
          obj.hide = false;
          obj.max = true;

          if (
            obj.z != tmpState.hz
          ) {
            tmpState.hz += 1;
          }

          obj.z = tmpState.hz;
          obj.dim = action.dim;
        }

        /*
         * ======================================================
         * Front
         * ======================================================
         */

        else if (
          action.payload == "front"
        ) {
          obj.hide = false;
          obj.max = true;

          if (
            obj.z != tmpState.hz
          ) {
            tmpState.hz += 1;

            obj.z = tmpState.hz;
          }
        }

        tmpState[keys[i]] =
          obj;

        return tmpState;
      }
    }
  }

  return state;
};

console.log(
  "DEF APP STATE",
  defState
);

export default appReducer;
