import React, {
  useEffect,
  useState,
  useCallback,
} from "react";

import { useSelector } from "react-redux";

import {
  Icon,
  ToolBar,
} from "../../../utils/general";

import "./assets/fileexpo.scss";


/*
 * ============================================================
 * Linux File Explorer
 *
 * API:
 *
 * GET  /api/files?path=/
 *
 * GET  /api/file/read?path=...
 *
 * POST /api/file/write
 *
 * POST /api/file/create
 *
 * POST /api/file/mkdir
 *
 * POST /api/file/rename
 *
 * POST /api/file/delete
 *
 * 图片：
 *
 * /api/file/raw?path=...
 * ============================================================
 */


/*
 * ============================================================
 * 路径工具
 * ============================================================
 */

const normalizePath = (path) => {

  if (!path) {
    return "/";
  }

  path = String(path)
    .replace(/\\/g, "/");

  if (!path.startsWith("/")) {
    path = "/" + path;
  }

  path = path.replace(/\/+/g, "/");

  if (
    path.length > 1 &&
    path.endsWith("/")
  ) {
    path = path.slice(0, -1);
  }

  return path || "/";
};


const joinPath = (
  parent,
  name
) => {

  parent = normalizePath(parent);

  name = String(name || "");

  if (parent === "/") {
    return "/" + name;
  }

  return parent + "/" + name;
};


const getParentPath = (
  path
) => {

  path = normalizePath(path);

  if (path === "/") {
    return "/";
  }

  const index =
    path.lastIndexOf("/");

  if (index <= 0) {
    return "/";
  }

  return path.substring(
    0,
    index
  );
};


/*
 * ============================================================
 * 文件类型
 * ============================================================
 */

const isDirectory = (file) => {

  if (!file) {
    return false;
  }

  return (
    file.dir === true ||
    file.dir === 1 ||
    file.isDir === true ||
    file.is_dir === true ||
    file.type === "directory" ||
    file.type === "dir"
  );
};


const getFileName = (file) => {

  if (!file) {
    return "";
  }

  return String(
    file.name ||
    file.filename ||
    ""
  )
    .trim()
    .toLowerCase();
};


const isTextFile = (file) => {

  const name =
    getFileName(file);

  return (
    name.endsWith(".js") ||
    name.endsWith(".jsx") ||
    name.endsWith(".json") ||
    name.endsWith(".txt") ||
    name.endsWith(".log")
  );
};


const isImageFile = (file) => {

  const name =
    getFileName(file);

  return (
    name.endsWith(".png") ||
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg") ||
    name.endsWith(".jepg") ||
    name.endsWith(".ico")
  );
};


/*
 * ============================================================
 * 文件图标
 * ============================================================
 */

const getFileIcon = (file) => {

  if (!file) {
    return "3.png";
  }

  if (
    isDirectory(file)
  ) {
    return "folder.png";
  }

  if (
    isTextFile(file)
  ) {
    return "893.png";
  }

  const name =
    getFileName(file);

  if (
    name.endsWith(".img") ||
    name.endsWith(".iso")
  ) {
    return "1693.png";
  }

  if (
    isImageFile(file)
  ) {
    return "106.png";
  }

  return "3.png";
};


/*
 * ============================================================
 * FileIcon
 * ============================================================
 */

const FileIcon = ({
  file,
  size = 48,
  className = "",
}) => {

  const icon =
    getFileIcon(file);

  const src =
    `/img/icon/win/${icon}`;

  return (
    <img
      className={
        `explorer-file-image ${className}`
      }

      src={src}

      width={size}

      height={size}

      alt=""

      draggable={false}

      style={{
        width: `${size}px`,
        height: `${size}px`,
        objectFit: "contain",
        display: "block",
      }}

      onError={(event) => {

        if (
          event.currentTarget.dataset.fallback !==
          "true"
        ) {

          event.currentTarget.dataset.fallback =
            "true";

          event.currentTarget.src =
            "/img/icon/win/3.png";
        }

      }}
    />
  );
};


/*
 * ============================================================
 * PathBar
 * ============================================================
 */

const PathBar = ({
  path,
  onNavigate,
}) => {

  const [
    value,
    setValue,
  ] = useState(path);

  useEffect(() => {

    setValue(path);

  }, [path]);


  const handleKeyDown = (
    event
  ) => {

    if (
      event.key === "Enter"
    ) {

      const target =
        normalizePath(value);

      setValue(target);

      onNavigate(target);
    }

    if (
      event.key === "Escape"
    ) {

      setValue(path);

    }

  };


  const parts =
    path === "/"
      ? []
      : path
          .split("/")
          .filter(Boolean);


  return (
    <div
      className="path-bar noscroll"
      tabIndex="-1"
    >

      <input
        className="path-field"
        type="text"
        value={value}
        onChange={(event) => {

          setValue(
            event.target.value
          );

        }}
        onKeyDown={
          handleKeyDown
        }
      />


      <div
        className="dirfbox h-full flex"
      >

        <div
          className="dirCont flex items-center"
          onClick={() =>
            onNavigate("/")
          }
        >

          <FileIcon
            file={{
              dir: true,
            }}
            size={16}
          />

          <span
            className="dncont"
          >
            /
          </span>

        </div>


        {parts.map(
          (
            part,
            index
          ) => {

            const currentPath =
              "/" +
              parts
                .slice(
                  0,
                  index + 1
                )
                .join("/");

            return (
              <React.Fragment
                key={
                  currentPath
                }
              >

                <Icon
                  className="dirchev"
                  fafa="faChevronRight"
                  width={8}
                />


                <div
                  className="dirCont flex items-center"
                  onClick={() =>
                    onNavigate(
                      currentPath
                    )
                  }
                >

                  <span
                    className="dncont"
                  >
                    {part}
                  </span>

                </div>

              </React.Fragment>
            );

          }
        )}

      </div>

    </div>
  );
};


/*
 * ============================================================
 * 左侧导航
 * ============================================================
 */

const NavPane = ({
  onNavigate,
}) => {

  const makeFolder =
    () => ({
      dir: true,
    });


  return (
    <div
      className="navpane win11Scroll"
    >

      <div className="extcont">

        <div className="dropdownmenu">

          <div
            className="droptitle"
            onClick={() =>
              onNavigate("/")
            }
          >

            <Icon
              className="mr-1"
              src="win/thispc-sm"
              width={16}
            />

            <span>
              Linux
            </span>

          </div>


          <div
            className="dropcontent"
          >

            <div
              className="navtitle flex prtclk"
              onClick={() =>
                onNavigate("/")
              }
            >

              <FileIcon
                file={makeFolder()}
                size={16}
              />

              <span>
                /
              </span>

            </div>


            <div
              className="navtitle flex prtclk"
              onClick={() =>
                onNavigate("/home")
              }
            >

              <FileIcon
                file={makeFolder()}
                size={16}
              />

              <span>
                Home
              </span>

            </div>


            <div
              className="navtitle flex prtclk"
              onClick={() =>
                onNavigate("/tmp")
              }
            >

              <FileIcon
                file={makeFolder()}
                size={16}
              />

              <span>
                tmp
              </span>

            </div>


            <div
              className="navtitle flex prtclk"
              onClick={() =>
                onNavigate("/usr")
              }
            >

              <FileIcon
                file={makeFolder()}
                size={16}
              />

              <span>
                usr
              </span>

            </div>


            <div
              className="navtitle flex prtclk"
              onClick={() =>
                onNavigate("/var")
              }
            >

              <FileIcon
                file={makeFolder()}
                size={16}
              />

              <span>
                var
              </span>

            </div>

          </div>

        </div>

      </div>

    </div>
  );
};


/*
 * ============================================================
 * 图片查看器
 * ============================================================
 */

const ImageViewer = ({
  file,
  path,
  onClose,
}) => {

  const [
    imageError,
    setImageError,
  ] = useState(false);


  const imageURL =
    "/api/file/raw?path=" +
    encodeURIComponent(path);


  return (
    <div
      className="file-editor-overlay"
      onMouseDown={(event) => {

        if (
          event.target ===
          event.currentTarget
        ) {

          onClose();

        }

      }}
    >

      <div
        className="file-editor-window"
        style={{
          width: "min(1000px, 90vw)",
          height: "min(800px, 90vh)",
          display: "flex",
          flexDirection: "column",
        }}
      >

        <div
          className="file-editor-header"
        >

          <div
            className="file-editor-title"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >

            <FileIcon
              file={file}
              size={24}
            />

            <span>
              {file.name}
            </span>

          </div>


          <button
            className="file-editor-close"
            onClick={onClose}
          >
            ×
          </button>

        </div>


        <div
          className="file-editor-path"
        >
          {path}
        </div>


        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "auto",
            padding: "20px",
          }}
        >

          {imageError ? (

            <div
              className="text-xs"
              style={{
                textAlign: "center",
              }}
            >

              <div>
                无法显示图片
              </div>

              <div
                style={{
                  marginTop: "8px",
                  opacity: 0.6,
                }}
              >
                {imageURL}
              </div>

            </div>

          ) : (

            <img
              src={imageURL}
              alt={file.name}
              onError={() =>
                setImageError(true)
              }
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
                objectFit: "contain",
                display: "block",
              }}
            />

          )}

        </div>


        <div
          className="file-editor-footer"
        >

          <button
            onClick={onClose}
          >
            关闭
          </button>

        </div>

      </div>

    </div>
  );
};


/*
 * ============================================================
 * 文件编辑器
 * ============================================================
 */

const FileEditor = ({
  file,
  content,
  onClose,
  onSave,
}) => {

  const [
    value,
    setValue,
  ] = useState(content);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");


  useEffect(() => {

    setValue(content);

  }, [content]);


  const save = async () => {

    setSaving(true);

    setError("");

    try {

      const response =
        await fetch(
          "/api/file/write",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            credentials: "include",

            body: JSON.stringify({
              path: file.path,
              content: value,
            }),
          }
        );


      let data = {};

      try {

        data =
          await response.json();

      } catch {
        // ignore
      }


      if (!response.ok) {

        throw new Error(
          data.error ||
          data.message ||
          "保存文件失败"
        );

      }


      onSave(value);

    } catch (err) {

      console.error(
        "[FileExplorer] Save error:",
        err
      );

      setError(
        err.message ||
        "保存文件失败"
      );

    } finally {

      setSaving(false);

    }

  };


  return (
    <div
      className="file-editor-overlay"
    >

      <div
        className="file-editor-window"
      >

        <div
          className="file-editor-header"
        >

          <div
            className="file-editor-title"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >

            <FileIcon
              file={file}
              size={24}
            />

            <span>
              {file.name}
            </span>

          </div>


          <button
            className="file-editor-close"
            onClick={onClose}
          >
            ×
          </button>

        </div>


        <div
          className="file-editor-path"
        >
          {file.path}
        </div>


        <textarea
          className="file-editor-textarea"
          value={value}
          onChange={(event) =>
            setValue(
              event.target.value
            )
          }
          spellCheck={false}
        />


        {error ? (

          <div
            className="file-editor-error"
          >
            {error}
          </div>

        ) : null}


        <div
          className="file-editor-footer"
        >

          <button
            onClick={onClose}
          >
            取消
          </button>


          <button
            onClick={save}
            disabled={saving}
          >
            {saving
              ? "保存中..."
              : "保存"}
          </button>

        </div>

      </div>

    </div>
  );
};


/*
 * ============================================================
 * 自定义输入弹窗
 *
 * 不使用 prompt()
 * ============================================================
 */

const ExplorerInputDialog = ({
  title,
  message,
  defaultValue = "",
  placeholder = "",
  confirmText = "确定",
  cancelText = "取消",
  onConfirm,
  onCancel,
}) => {

  const [
    value,
    setValue,
  ] = useState(defaultValue);


  const [
    error,
    setError,
  ] = useState("");


  const submit = () => {

    const result =
      value.trim();

    if (!result) {

      setError(
        "请输入名称"
      );

      return;
    }

    onConfirm(result);
  };


  const handleKeyDown = (
    event
  ) => {

    if (
      event.key === "Enter"
    ) {

      event.preventDefault();

      submit();

    }

    if (
      event.key === "Escape"
    ) {

      event.preventDefault();

      onCancel();

    }

  };


  return (
    <div
      className="file-editor-overlay"
      style={{
        zIndex: 100002,
      }}
      onMouseDown={(event) => {

        if (
          event.target ===
          event.currentTarget
        ) {

          onCancel();

        }

      }}
    >

      <div
        className="explorer-dialog"
      >

        <div
          className="explorer-dialog-title"
        >
          {title}
        </div>


        {message ? (

          <div
            className="explorer-dialog-message"
          >
            {message}
          </div>

        ) : null}


        <input
          autoFocus
          className="explorer-dialog-input"
          type="text"
          value={value}
          placeholder={placeholder}
          onChange={(event) => {

            setValue(
              event.target.value
            );

            setError("");

          }}
          onKeyDown={
            handleKeyDown
          }
        />


        {error ? (

          <div
            className="explorer-dialog-error"
          >
            {error}
          </div>

        ) : null}


        <div
          className="explorer-dialog-footer"
        >

          <button
            onClick={onCancel}
          >
            {cancelText}
          </button>


          <button
            onClick={submit}
          >
            {confirmText}
          </button>

        </div>

      </div>

    </div>
  );
};


/*
 * ============================================================
 * 自定义确认弹窗
 *
 * 不使用 confirm()
 * ============================================================
 */

const ExplorerConfirmDialog = ({
  title,
  message,
  confirmText = "确定",
  cancelText = "取消",
  danger = false,
  onConfirm,
  onCancel,
}) => {

  return (
    <div
      className="file-editor-overlay"
      style={{
        zIndex: 100002,
      }}
      onMouseDown={(event) => {

        if (
          event.target ===
          event.currentTarget
        ) {

          onCancel();

        }

      }}
    >

      <div
        className="explorer-dialog"
      >

        <div
          className="explorer-dialog-title"
        >
          {title}
        </div>


        <div
          className="explorer-dialog-message"
        >
          {message}
        </div>


        <div
          className="explorer-dialog-footer"
        >

          <button
            onClick={onCancel}
          >
            {cancelText}
          </button>


          <button
            className={
              danger
                ? "explorer-danger-button"
                : ""
            }
            onClick={onConfirm}
          >
            {confirmText}
          </button>

        </div>

      </div>

    </div>
  );
};


/*
 * ============================================================
 * ContentArea
 * ============================================================
 */

const ContentArea = ({
  files,
  path,
  searchtxt,
  selected,
  onSelect,
  onOpen,
  onContextMenu,
}) => {

  const filteredFiles =
    files.filter(
      (file) =>
        String(
          file.name || ""
        )
          .toLowerCase()
          .includes(
            searchtxt.toLowerCase()
          )
    );


  return (
    <div
      className="contentarea"
      tabIndex="-1"
      onContextMenu={(event) => {

        event.preventDefault();

        onContextMenu(
          event,
          null,
          null
        );

      }}
    >

      <div
        className="contentwrap win11Scroll"
      >

        {filteredFiles.length === 0 ? (

          <div
            className="text-xs mx-auto"
          >
            此文件夹为空
          </div>

        ) : (

          <div
            className="gridshow"
            data-size="lg"
          >

            {filteredFiles.map(
              (
                file,
                index
              ) => {

                const filePath =
                  joinPath(
                    path,
                    file.name
                  );


                return (
                  <div
                    key={
                      filePath +
                      "-" +
                      index
                    }

                    className={
                      "conticon hvtheme flex flex-col items-center prtclk" +
                      (
                        selected ===
                        filePath
                          ? " selected"
                          : ""
                      )
                    }

                    data-focus={
                      selected ===
                      filePath
                    }

                    onClick={(event) => {

                      event.stopPropagation();

                      onSelect(
                        filePath
                      );

                    }}

                    onDoubleClick={(event) => {

                      event.stopPropagation();

                      onOpen(
                        file,
                        filePath
                      );

                    }}

                    onContextMenu={(event) => {

                      event.preventDefault();

                      event.stopPropagation();

                      onSelect(
                        filePath
                      );

                      onContextMenu(
                        event,
                        file,
                        filePath
                      );

                    }}
                  >

                    <div
                      className="explorer-file-icon"
                    >

                      <FileIcon
                        file={file}
                        size={48}
                      />

                    </div>


                    <span>
                      {file.name}
                    </span>

                  </div>
                );

              }
            )}

          </div>

        )}

      </div>

    </div>
  );
};


/*
 * ============================================================
 * Ribbon
 *
 * 这里保持原来的 New UI。
 * 不使用浏览器 prompt。
 * ============================================================
 */

const Ribbon = ({
  onNew,
}) => {

  return (
    <div
      className="msribbon flex"
    >

      <div
        className="ribsec"
      >

        <div
          className="drdwcont flex"
          onClick={onNew}
          style={{
            cursor: "pointer",
          }}
        >

          <Icon
            src="new"
            ui
            width={18}
            margin="0 6px"
          />

          <span>
            New
          </span>

        </div>

      </div>


      <div
        className="ribsec"
      >

        <Icon
          src="cut"
          ui
          width={18}
          margin="0 6px"
        />

        <Icon
          src="copy"
          ui
          width={18}
          margin="0 6px"
        />

        <Icon
          src="paste"
          ui
          width={18}
          margin="0 6px"
        />

        <Icon
          src="rename"
          ui
          width={18}
          margin="0 6px"
        />

        <Icon
          src="share"
          ui
          width={18}
          margin="0 6px"
        />

      </div>


      <div
        className="ribsec"
      >

        <div
          className="drdwcont flex"
        >

          <Icon
            src="sort"
            ui
            width={18}
            margin="0 6px"
          />

          <span>
            Sort
          </span>

        </div>


        <div
          className="drdwcont flex"
        >

          <Icon
            src="view"
            ui
            width={18}
            margin="0 6px"
          />

          <span>
            View
          </span>

        </div>

      </div>

    </div>
  );
};


/*
 * ============================================================
 * 右键菜单
 * ============================================================
 */

const ContextMenu = ({
  menu,
}) => {

  if (!menu) {
    return null;
  }


  return (
    <div
      className="explorer-context-menu"
      style={{
        left: menu.x,
        top: menu.y,
      }}
      onMouseDown={(event) => {

        event.stopPropagation();

      }}
    >

      {menu.file ? (

        <>
          <div
            className="explorer-context-item"
            onClick={() =>
              menu.onOpen()
            }
          >
            <span>
              打开
            </span>
          </div>


          <div
            className="explorer-context-separator"
          />


          <div
            className="explorer-context-item"
            onClick={() =>
              menu.onRename()
            }
          >
            <span>
              重命名
            </span>
          </div>


          <div
            className="explorer-context-item danger"
            onClick={() =>
              menu.onDelete()
            }
          >
            <span>
              删除
            </span>
          </div>


          <div
            className="explorer-context-separator"
          />

        </>

      ) : null}


      <div
        className="explorer-context-item"
        onClick={() =>
          menu.onNewFile()
        }
      >
        <span>
          新建文件
        </span>
      </div>


      <div
        className="explorer-context-item"
        onClick={() =>
          menu.onNewFolder()
        }
      >
        <span>
          新建文件夹
        </span>
      </div>

    </div>
  );
};


/*
 * ============================================================
 * Explorer
 * ============================================================
 */

export const Explorer = () => {

  const wnapp =
    useSelector(
      (state) =>
        state.apps.explorer
    );


  const [
    path,
    setPath,
  ] = useState("/");


  const [
    files,
    setFiles,
  ] = useState([]);


  const [
    loading,
    setLoading,
  ] = useState(false);


  const [
    error,
    setError,
  ] = useState("");


  const [
    searchtxt,
    setSearchtxt,
  ] = useState("");


  const [
    selected,
    setSelected,
  ] = useState(null);


  const [
    history,
    setHistory,
  ] = useState(["/"]);


  const [
    historyIndex,
    setHistoryIndex,
  ] = useState(0);


  const [
    editor,
    setEditor,
  ] = useState(null);


  const [
    imageViewer,
    setImageViewer,
  ] = useState(null);


  /*
   * ==========================================================
   * 右键菜单
   * ==========================================================
   */

  const [
    contextMenu,
    setContextMenu,
  ] = useState(null);


  /*
   * ==========================================================
   * 自定义对话框
   * ==========================================================
   */

  const [
    dialog,
    setDialog,
  ] = useState(null);


  /*
   * ==========================================================
   * 读取目录
   * ==========================================================
   */

  const loadDirectory =
    useCallback(
      async (
        targetPath,
        addHistory = true
      ) => {

        targetPath =
          normalizePath(
            targetPath
          );


        setLoading(true);

        setError("");

        setSelected(null);


        try {

          const response =
            await fetch(
              "/api/files?path=" +
              encodeURIComponent(
                targetPath
              ),
              {
                method: "GET",
                credentials: "include",
              }
            );


          let data = {};


          try {

            data =
              await response.json();

          } catch {

            throw new Error(
              "服务器返回的数据不是 JSON"
            );

          }


          if (!response.ok) {

            throw new Error(
              data.error ||
              data.message ||
              "读取目录失败"
            );

          }


          const result =
            Array.isArray(
              data.files
            )
              ? data.files
              : [];


          setFiles(result);


          setPath(
            normalizePath(
              data.path ||
              targetPath
            )
          );


          setSearchtxt("");


          if (addHistory) {

            setHistory(
              (oldHistory) => {

                const newHistory =
                  oldHistory.slice(
                    0,
                    historyIndex + 1
                  );


                if (
                  newHistory[
                    newHistory.length - 1
                  ] !== targetPath
                ) {

                  newHistory.push(
                    targetPath
                  );

                }


                return newHistory;

              }
            );


            setHistoryIndex(
              (index) =>
                index + 1
            );

          }

        } catch (err) {

          console.error(
            "[FileExplorer] Load directory error:",
            err
          );


          setFiles([]);


          setError(
            err.message ||
            "无法读取目录"
          );

        } finally {

          setLoading(false);

        }

      },
      [historyIndex]
    );


  /*
   * ==========================================================
   * 初始化
   * ==========================================================
   */

  useEffect(() => {

    loadDirectory(
      "/",
      false
    );

  }, []);


  /*
   * ==========================================================
   * 关闭右键菜单
   * ==========================================================
   */

  useEffect(() => {

    const closeMenu = () => {

      setContextMenu(null);

    };


    document.addEventListener(
      "mousedown",
      closeMenu
    );


    window.addEventListener(
      "blur",
      closeMenu
    );


    return () => {

      document.removeEventListener(
        "mousedown",
        closeMenu
      );


      window.removeEventListener(
        "blur",
        closeMenu
      );

    };

  }, []);


  /*
   * ==========================================================
   * 新建文件
   * ==========================================================
   */

  const createFile = () => {

    setContextMenu(null);


    setDialog({

      type: "input",

      title: "新建文件",

      message:
        `在 ${path} 中创建新文件`,

      placeholder:
        "文件名",

      onConfirm: async (
        name
      ) => {

        const target =
          joinPath(
            path,
            name
          );


        try {

          const response =
            await fetch(
              "/api/file/create",
              {
                method: "POST",

                headers: {
                  "Content-Type":
                    "application/json",
                },

                credentials: "include",

                body:
                  JSON.stringify({
                    path: target,
                  }),
              }
            );


          let data = {};

          try {

            data =
              await response.json();

          } catch {
            // ignore
          }


          if (!response.ok) {

            throw new Error(
              data.error ||
              data.message ||
              "创建文件失败"
            );

          }


          setDialog(null);

          await loadDirectory(
            path,
            false
          );

        } catch (err) {

          console.error(
            "[FileExplorer] Create file error:",
            err
          );


          setDialog({

            type: "input",

            title: "新建文件",

            message:
              err.message ||
              "创建文件失败",

            placeholder:
              "文件名",

            onConfirm:
              arguments[0],

          });

          setError(
            err.message ||
            "创建文件失败"
          );

        }

      },

      onCancel: () =>
        setDialog(null),

    });

  };


  /*
   * ==========================================================
   * 新建文件夹
   * ==========================================================
   */

  const createFolder = () => {

    setContextMenu(null);


    setDialog({

      type: "input",

      title: "新建文件夹",

      message:
        `在 ${path} 中创建新文件夹`,

      placeholder:
        "文件夹名称",

      onConfirm: async (
        name
      ) => {

        const target =
          joinPath(
            path,
            name
          );


        try {

          const response =
            await fetch(
              "/api/file/mkdir",
              {
                method: "POST",

                headers: {
                  "Content-Type":
                    "application/json",
                },

                credentials: "include",

                body:
                  JSON.stringify({
                    path: target,
                  }),
              }
            );


          let data = {};

          try {

            data =
              await response.json();

          } catch {
            // ignore
          }


          if (!response.ok) {

            throw new Error(
              data.error ||
              data.message ||
              "创建文件夹失败"
            );

          }


          setDialog(null);

          await loadDirectory(
            path,
            false
          );

        } catch (err) {

          console.error(
            "[FileExplorer] Create directory error:",
            err
          );


          setError(
            err.message ||
            "创建文件夹失败"
          );

        }

      },

      onCancel: () =>
        setDialog(null),

    });

  };


  /*
   * ==========================================================
   * 重命名
   * ==========================================================
   */

  const renameFile = (
    file,
    filePath
  ) => {

    setContextMenu(null);


    setDialog({

      type: "input",

      title: "重命名",

      message:
        `将“${file.name}”重命名为：`,

      defaultValue:
        file.name,

      placeholder:
        "名称",

      onConfirm: async (
        name
      ) => {

        const newPath =
          joinPath(
            path,
            name
          );


        if (
          normalizePath(
            newPath
          ) ===
          normalizePath(
            filePath
          )
        ) {

          setDialog(null);

          return;

        }


        try {

          const response =
            await fetch(
              "/api/file/rename",
              {
                method: "POST",

                headers: {
                  "Content-Type":
                    "application/json",
                },

                credentials: "include",

                body:
                  JSON.stringify({
                    path:
                      filePath,

                    newPath:
                      newPath,
                  }),
              }
            );


          let data = {};

          try {

            data =
              await response.json();

          } catch {
            // ignore
          }


          if (!response.ok) {

            throw new Error(
              data.error ||
              data.message ||
              "重命名失败"
            );

          }


          setDialog(null);

          setSelected(null);

          await loadDirectory(
            path,
            false
          );

        } catch (err) {

          console.error(
            "[FileExplorer] Rename error:",
            err
          );


          setError(
            err.message ||
            "重命名失败"
          );

        }

      },

      onCancel: () =>
        setDialog(null),

    });

  };


  /*
   * ==========================================================
   * 删除
   * ==========================================================
   */

  const deleteFile = (
    file,
    filePath
  ) => {

    setContextMenu(null);


    setDialog({

      type: "confirm",

      title:
        isDirectory(file)
          ? "删除文件夹"
          : "删除文件",

      message:
        isDirectory(file)
          ? `确定要删除文件夹“${file.name}”吗？\n文件夹中的所有内容也会被删除。`
          : `确定要删除文件“${file.name}”吗？`,

      confirmText:
        "删除",

      cancelText:
        "取消",

      danger: true,

      onConfirm: async () => {

        try {

          const response =
            await fetch(
              "/api/file/delete",
              {
                method: "POST",

                headers: {
                  "Content-Type":
                    "application/json",
                },

                credentials: "include",

                body:
                  JSON.stringify({
                    path:
                      filePath,
                  }),
              }
            );


          let data = {};

          try {

            data =
              await response.json();

          } catch {
            // ignore
          }


          if (!response.ok) {

            throw new Error(
              data.error ||
              data.message ||
              "删除失败"
            );

          }


          setDialog(null);

          setSelected(null);

          await loadDirectory(
            path,
            false
          );

        } catch (err) {

          console.error(
            "[FileExplorer] Delete error:",
            err
          );


          setDialog(null);

          setError(
            err.message ||
            "删除失败"
          );

        }

      },

      onCancel: () =>
        setDialog(null),

    });

  };


  /*
   * ==========================================================
   * 打开文件
   * ==========================================================
   */

  const handleOpen =
    async (
      file,
      filePath
    ) => {

      if (
        isDirectory(file)
      ) {

        await loadDirectory(
          filePath,
          true
        );

        return;

      }


      if (
        isImageFile(file)
      ) {

        setImageViewer({

          file: {
            ...file,
            path: filePath,
          },

          path: filePath,

        });

        return;

      }


      if (
        isTextFile(file)
      ) {

        try {

          setError("");


          const response =
            await fetch(
              "/api/file/read?path=" +
              encodeURIComponent(
                filePath
              ),
              {
                method: "GET",
                credentials: "include",
              }
            );


          let data = {};


          try {

            data =
              await response.json();

          } catch {

            throw new Error(
              "服务器返回的数据不是 JSON"
            );

          }


          if (!response.ok) {

            throw new Error(
              data.error ||
              data.message ||
              "无法读取文件"
            );

          }


          const content =
            typeof data.content ===
            "string"
              ? data.content
              : typeof data.data ===
                "string"
                ? data.data
                : "";


          setEditor({

            file: {
              ...file,
              path: filePath,
            },

            content,

          });

        } catch (err) {

          console.error(
            "[FileExplorer] Read file error:",
            err
          );


          setError(
            err.message ||
            "无法读取文件"
          );

        }

        return;

      }


      setError(
        "此文件类型暂不支持在线编辑"
      );

    };


  /*
   * ==========================================================
   * 右键菜单
   * ==========================================================
   */

  const handleContextMenu = (
    event,
    file,
    filePath
  ) => {

    event.preventDefault();

    event.stopPropagation();


    const menuWidth = 180;

    const menuHeight =
      file
        ? 190
        : 100;


    let x =
      event.clientX;

    let y =
      event.clientY;


    if (
      x + menuWidth >
      window.innerWidth
    ) {

      x =
        window.innerWidth -
        menuWidth -
        8;

    }


    if (
      y + menuHeight >
      window.innerHeight
    ) {

      y =
        window.innerHeight -
        menuHeight -
        8;

    }


    setContextMenu({

      x,
      y,

      file,

      filePath,

      onOpen: () => {

        setContextMenu(null);

        if (
          file &&
          filePath
        ) {

          handleOpen(
            file,
            filePath
          );

        }

      },

      onRename: () => {

        if (
          file &&
          filePath
        ) {

          renameFile(
            file,
            filePath
          );

        }

      },

      onDelete: () => {

        if (
          file &&
          filePath
        ) {

          deleteFile(
            file,
            filePath
          );

        }

      },

      onNewFile:
        createFile,

      onNewFolder:
        createFolder,

    });

  };


  /*
   * ==========================================================
   * 后退
   * ==========================================================
   */

  const goBack = () => {

    if (
      historyIndex <= 0
    ) {

      return;

    }


    const newIndex =
      historyIndex - 1;


    const target =
      history[newIndex];


    setHistoryIndex(
      newIndex
    );


    loadDirectory(
      target,
      false
    );

  };


  /*
   * ==========================================================
   * 前进
   * ==========================================================
   */

  const goForward = () => {

    if (
      historyIndex >=
      history.length - 1
    ) {

      return;

    }


    const newIndex =
      historyIndex + 1;


    const target =
      history[newIndex];


    setHistoryIndex(
      newIndex
    );


    loadDirectory(
      target,
      false
    );

  };


  /*
   * ==========================================================
   * 上一级
   * ==========================================================
   */

  const goUp = () => {

    if (
      path === "/"
    ) {

      return;

    }


    loadDirectory(
      getParentPath(path),
      true
    );

  };


  /*
   * ==========================================================
   * 键盘
   * ==========================================================
   */

  const handleKeyDown =
    (event) => {

      if (
        event.key ===
          "Backspace" &&
        event.target.tagName !==
          "INPUT" &&
        event.target.tagName !==
          "TEXTAREA"
      ) {

        goBack();

      }


      if (
        event.key === "Escape"
      ) {

        setContextMenu(null);


        if (imageViewer) {

          setImageViewer(null);

        }

        if (editor) {

          setEditor(null);

        }

      }

    };


  /*
   * ==========================================================
   * 保存编辑器
   * ==========================================================
   */

  const handleEditorSave =
    (newContent) => {

      setEditor(
        (old) => {

          if (!old) {

            return null;

          }


          return {
            ...old,
            content:
              newContent,
          };

        }
      );


      setEditor(null);

    };


  /*
   * ==========================================================
   * Render
   * ==========================================================
   */

  return (

    <div
      className="msfiles floatTab dpShad"

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

      onKeyDown={
        handleKeyDown
      }

      onContextMenu={(event) => {

        event.preventDefault();

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

        name="File Explorer"
      />


      <div
        className="windowScreen flex flex-col"
      >

        {/* ==================================================
            顶部 Ribbon
        ================================================== */}

        <Ribbon
          onNew={() => {

            setContextMenu({

              x: 100,

              y: 100,

              file: null,

              onNewFile:
                createFile,

              onNewFolder:
                createFolder,

              onOpen:
                () => {},

              onRename:
                () => {},

              onDelete:
                () => {},

            });

          }}
        />


        <div
          className="restWindow flex-grow flex flex-col"
        >

          {/* ==================================================
              导航栏
          ================================================== */}

          <div
            className="sec1"
          >

            <Icon
              className={
                "navIcon hvtheme" +
                (
                  historyIndex <= 0
                    ? " disableIt"
                    : ""
                )
              }

              fafa="faArrowLeft"

              width={14}

              onClick={
                historyIndex > 0
                  ? goBack
                  : undefined
              }

              pr
            />


            <Icon
              className={
                "navIcon hvtheme" +
                (
                  historyIndex >=
                  history.length - 1
                    ? " disableIt"
                    : ""
                )
              }

              fafa="faArrowRight"

              width={14}

              onClick={
                historyIndex <
                history.length - 1
                  ? goForward
                  : undefined
              }

              pr
            />


            <Icon
              className={
                "navIcon hvtheme" +
                (
                  path === "/"
                    ? " disableIt"
                    : ""
                )
              }

              fafa="faArrowUp"

              width={14}

              onClick={
                path === "/"
                  ? undefined
                  : goUp
              }

              pr
            />


            <PathBar
              path={path}
              onNavigate={(target) =>
                loadDirectory(
                  target,
                  true
                )
              }
            />


            <div
              className="srchbar"
            >

              <Icon
                className="searchIcon"
                src="search"
                width={12}
              />


              <input
                type="text"
                value={
                  searchtxt
                }
                onChange={(event) =>
                  setSearchtxt(
                    event.target.value
                  )
                }
                placeholder="Search"
              />

            </div>

          </div>


          {/* ==================================================
              内容
          ================================================== */}

          <div
            className="sec2"
          >

            <NavPane
              onNavigate={(target) =>
                loadDirectory(
                  target,
                  true
                )
              }
            />


            <div
              className="flex-grow relative"
            >

              {loading ? (

                <div
                  className="absolute inset-0 flex items-center justify-center"
                  style={{
                    zIndex: 10,
                  }}
                >

                  <span
                    className="text-xs"
                  >
                    正在读取...
                  </span>

                </div>

              ) : null}


              {error ? (

                <div
                  className="absolute left-0 right-0 top-0"
                  style={{
                    zIndex: 20,
                  }}
                >

                  <div
                    className="text-xs"
                    style={{
                      padding: "8px",
                      margin: "8px",
                      borderRadius:
                        "6px",
                      background:
                        "rgba(255,80,80,.12)",
                    }}
                  >

                    {error}


                    <span
                      className="prtclk"
                      style={{
                        marginLeft:
                          "12px",
                        cursor:
                          "pointer",
                      }}

                      onClick={() => {

                        setError("");

                        loadDirectory(
                          path,
                          false
                        );

                      }}
                    >
                      重试
                    </span>

                  </div>

                </div>

              ) : null}


              <ContentArea
                files={files}
                path={path}
                searchtxt={
                  searchtxt
                }
                selected={
                  selected
                }
                onSelect={
                  setSelected
                }
                onOpen={
                  handleOpen
                }
                onContextMenu={
                  handleContextMenu
                }
              />

            </div>

          </div>


          {/* ==================================================
              状态栏
          ================================================== */}

          <div
            className="sec3"
          >

            <div
              className="item-count text-xs"
            >

              {files.length}

              {" "}

              items

            </div>


            <div
              className="view-opts flex"
            >

              <Icon
                className="viewicon hvtheme p-1"
                src="win/viewinfo"
                width={16}
              />


              <Icon
                className="viewicon hvtheme p-1"
                src="win/viewlarge"
                width={16}
              />

            </div>

          </div>

        </div>

      </div>


      {/* ======================================================
          右键菜单
      ====================================================== */}

      <ContextMenu
        menu={
          contextMenu
        }
      />


      {/* ======================================================
          自定义输入弹窗
      ====================================================== */}

      {dialog &&
      dialog.type === "input" ? (

        <ExplorerInputDialog
          title={
            dialog.title
          }

          message={
            dialog.message
          }

          defaultValue={
            dialog.defaultValue
          }

          placeholder={
            dialog.placeholder
          }

          confirmText="确定"

          cancelText="取消"

          onConfirm={
            dialog.onConfirm
          }

          onCancel={
            dialog.onCancel
          }

        />

      ) : null}


      {/* ======================================================
          自定义确认弹窗
      ====================================================== */}

      {dialog &&
      dialog.type === "confirm" ? (

        <ExplorerConfirmDialog
          title={
            dialog.title
          }

          message={
            dialog.message
          }

          confirmText={
            dialog.confirmText
          }

          cancelText={
            dialog.cancelText
          }

          danger={
            dialog.danger
          }

          onConfirm={
            dialog.onConfirm
          }

          onCancel={
            dialog.onCancel
          }

        />

      ) : null}


      {/* ======================================================
          文本编辑器
      ====================================================== */}

      {editor ? (

        <FileEditor
          file={
            editor.file
          }

          content={
            editor.content
          }

          onClose={() =>
            setEditor(null)
          }

          onSave={
            handleEditorSave
          }

        />

      ) : null}


      {/* ======================================================
          图片查看器
      ====================================================== */}

      {imageViewer ? (

        <ImageViewer
          file={
            imageViewer.file
          }

          path={
            imageViewer.path
          }

          onClose={() =>
            setImageViewer(null)
          }

        />

      ) : null}

    </div>
  );
};


export default Explorer;
