const defState = {
  hide: true,
  top: 80,
  left: 360,
  opts: "desk",
  attr: null,
  dataset: null,
  data: {
    desk: {
      width: "310px",
      secwid: "200px",
    },
    task: {
      width: "220px",
      secwid: "120px",
      ispace: false, // show the space for icons in menu
    },
    app: {
      width: "310px",
      secwid: "200px",
    },
  },
  menus: {
    desk: [
      {
        name: "View",
        icon: "view",
        type: "svg",
        opts: [
          {
            name: "Large icons",
            action: "changeIconSize",
            payload: "large",
          },
          {
            name: "Medium icons",
            action: "changeIconSize",
            payload: "medium",
          },
          {
            name: "Small icons",
            action: "changeIconSize",
            payload: "small",
            dot: true,
          },
          {
            type: "hr",
          },
          {
            name: "Show desktop icons",
            action: "deskHide",
            check: true,
          },
        ],
      },
      {
        name: "Sort by",
        icon: "sort",
        type: "svg",
        opts: [
          {
            name: "名称",
            action: "changeSort",
            payload: "name",
          },
          {
            name: "大小",
            action: "changeSort",
            payload: "size",
          },
          {
            name: "日期",
            action: "changeSort",
            payload: "date",
          },
        ],
      },
      {
        name: "刷新",
        action: "refresh",
        type: "svg",
        icon: "refresh",
      },
      {
        type: "hr",
      },
      {
        name: "New",
        icon: "New",
        type: "svg",
        opts: [
          {
            name: "文件夹",
          },
          {
            name: "链接",
          },
          {
            name: "文档",
          },
          {
            name: "压缩包",
          },
        ],
      },
      {
        type: "hr",
      },
      {
        type: "hr",
      },
      {
        name: "换背景",
        action: "WALLNEXT",
      },
      {
        name: "打开终端",
        icon: "terminal",
        action: "OPENTERM",
        payload: "C:\\Users\\Blue\\Desktop",
      },
    ],
    task: [
      {
        name: "Align icons",
        opts: [
          {
            name: "Left",
            action: "changeTaskAlign",
            payload: "left",
          },
          {
            name: "Center",
            action: "changeTaskAlign",
            payload: "center",
            dot: true,
          },
        ],
      },
      {
        type: "hr",
      },
      {
        name: "搜索",
        opts: [
          {
            name: "展示",
            action: "TASKSRCH",
            payload: true,
          },
          {
            name: "隐藏",
            action: "TASKSRCH",
            payload: false,
          },
        ],
      },
      {
        name: "老组件",
        opts: [
          {
            name: "Show",
            action: "TASKWIDG",
            payload: false,
          },
          {
            name: "Hide",
            action: "TASKWIDG",
            payload: false,
          },
        ],
      },
      {
        type: "hr",
      },
      {
        name: "显示桌面",
        action: "SHOWDSK",
      },
    ],
    app: [
      {
        name: "打开",
        action: "performApp",
        payload: "open",
      },
      {
        type: "hr",
      },
      {
        name: "删除",
        action: "performApp",
        payload: "delshort",
      },
      {
        name: "卸载",
        action: "delApp",
        payload: "delete",
      },
    ],
  },
};

const menusReducer = (state = defState, action) => {
  var tmpState = {
    ...state,
  };
  if (action.type == "MENUHIDE") {
    tmpState.hide = true;
  } else if (action.type == "MENUSHOW") {
    tmpState.hide = false;
    tmpState.top = (action.payload && action.payload.top) || 272;
    tmpState.left = (action.payload && action.payload.left) || 430;
    tmpState.opts = (action.payload && action.payload.menu) || "desk";
    tmpState.attr = action.payload && action.payload.attr;
    tmpState.dataset = action.payload && action.payload.dataset;
  } else if (action.type == "MENUCHNG") {
    tmpState = {
      ...action.payload,
    };
  }

  return tmpState;
};

export default menusReducer;
