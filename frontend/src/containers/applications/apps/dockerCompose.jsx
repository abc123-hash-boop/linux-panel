import React, {
    useEffect,
    useState,
} from "react";

import {
    Icon,
} from "../../../utils/general";

import "./assets/dockerCompose.scss";


const DockerCompose = () => {

    /*
    ==========================================================
    State
    ==========================================================
    */

    const [
        projects,
        setProjects
    ] = useState([]);


    const [
        loading,
        setLoading
    ] = useState(true);


    const [
        selected,
        setSelected
    ] = useState(null);


    const [
        content,
        setContent
    ] = useState("");


    const [
        projectName,
        setProjectName
    ] = useState("");


    const [
        editorMode,
        setEditorMode
    ] = useState(false);


    const [
        saving,
        setSaving
    ] = useState(false);


    const [
        actionLoading,
        setActionLoading
    ] = useState(false);


    const [
        logs,
        setLogs
    ] = useState("");


    const [
        showLogs,
        setShowLogs
    ] = useState(false);


    /*
    ==========================================================
    Load Compose
    ==========================================================
    */

    const loadProjects =
        async () => {

            try {

                setLoading(true);


                const res =
                    await fetch(
                        "/api/docker/compose/list",
                        {
                            credentials:
                                "include"
                        }
                    );


                const data =
                    await res.json();


                if (!res.ok) {

                    throw new Error(
                        data.error ||
                        "加载 Compose 失败"
                    );

                }


                setProjects(
                    Array.isArray(data)
                        ? data
                        : []
                );


            } catch (e) {

                console.error(
                    "[Compose] load failed:",
                    e
                );


                alert(
                    e.message ||
                    "加载 Compose 失败"
                );


                setProjects([]);


            } finally {

                setLoading(false);

            }

        };


    /*
    ==========================================================
    Load Compose File
    ==========================================================
    */

    const loadProject =
        async (
            project
        ) => {

            if (!project) {
                return;
            }


            setSelected(project);

            setProjectName(
                project.name || ""
            );


            /*
             * 这里通过已有文件 API
             * 读取 docker-compose.yml
             */

            try {

                const res =
                    await fetch(
                        `/api/file/read?path=${encodeURIComponent(
                            project.path
                        )}`,
                        {
                            credentials:
                                "include"
                        }
                    );


                const data =
                    await res.json();


                if (!res.ok) {

                    throw new Error(
                        data.error ||
                        "读取 Compose 文件失败"
                    );

                }


                /*
                 * 兼容不同的 FileRead 返回格式
                 */

                let text = "";


                if (
                    typeof data ===
                    "string"
                ) {

                    text = data;

                } else if (
                    typeof data.content ===
                    "string"
                ) {

                    text = data.content;

                } else if (
                    typeof data.data ===
                    "string"
                ) {

                    text = data.data;

                } else {

                    text = "";

                }


                setContent(text);


            } catch (e) {

                console.error(
                    "[Compose] read failed:",
                    e
                );


                alert(
                    e.message ||
                    "读取 Compose 文件失败"
                );


                setContent("");

            }

        };


    /*
    ==========================================================
    Initial
    ==========================================================
    */

    useEffect(() => {

        loadProjects();

    }, []);


    /*
    ==========================================================
    New Compose
    ==========================================================
    */

    const newProject =
        () => {

            setSelected(null);

            setProjectName("");

            setContent(
`services:
  app:
    image: nginx:latest
    ports:
      - "8080:80"
    restart: unless-stopped
`
            );

            setEditorMode(true);

            setShowLogs(false);

        };


    /*
    ==========================================================
    Save / Upload Compose
    ==========================================================
    */

    const saveProject =
        async () => {

            const name =
                projectName.trim();


            if (!name) {

                alert(
                    "请输入 Compose 项目名称"
                );

                return;

            }


            if (!content.trim()) {

                alert(
                    "Compose 内容不能为空"
                );

                return;

            }


            /*
             * 防止路径穿越
             */

            if (
                name !==
                name.replace(
                    /[^a-zA-Z0-9_.-]/g,
                    ""
                )
            ) {

                alert(
                    "项目名称只能包含字母、数字、下划线、短横线和点"
                );

                return;

            }


            try {

                setSaving(true);


                const res =
                    await fetch(
                        "/api/docker/compose/upload",
                        {
                            method:
                                "POST",

                            credentials:
                                "include",

                            headers: {
                                "Content-Type":
                                    "application/json"
                            },

                            /*
                             * 非常重要：
                             *
                             * YAML 放在 content 字符串里，
                             * 不能直接把 YAML 当 JSON 发送。
                             *
                             * JSON.stringify 会自动处理：
                             *
                             * 换行
                             * 引号
                             * -
                             * :
                             */

                            body:
                                JSON.stringify({

                                    name:
                                        name,

                                    content:
                                        content

                                })

                        }
                    );


                const data =
                    await res.json();


                if (!res.ok) {

                    throw new Error(
                        data.error ||
                        "保存 Compose 失败"
                    );

                }


                alert(
                    "Compose 保存成功"
                );


                await loadProjects();


                const project = {

                    name:
                        data.project ||
                        name,

                    path:
                        data.path ||
                        `/opt/panel/compose/${name}/docker-compose.yml`

                };


                setSelected(
                    project
                );


                setProjectName(
                    project.name
                );


                setEditorMode(
                    false
                );


            } catch (e) {

                console.error(
                    "[Compose] save failed:",
                    e
                );


                alert(
                    e.message ||
                    "保存 Compose 失败"
                );


            } finally {

                setSaving(false);

            }

        };


    /*
    ==========================================================
    Compose Action
    ==========================================================
    */

    const composeAction =
        async (
            action
        ) => {

            if (!selected) {
                return;
            }


            if (
                action ===
                "down"
            ) {

                if (
                    !window.confirm(
                        `确定要停止 Compose「${selected.name}」吗？`
                    )
                ) {

                    return;

                }

            }


            try {

                setActionLoading(true);


                const res =
                    await fetch(
                        `/api/docker/compose/${encodeURIComponent(
                            selected.name
                        )}/${action}`,
                        {
                            method:
                                "POST",

                            credentials:
                                "include"
                        }
                    );


                const data =
                    await res.json();


                if (!res.ok) {

                    throw new Error(
                        data.error ||
                        data.output ||
                        "Compose 操作失败"
                    );

                }


                if (
                    data.output
                ) {

                    console.log(
                        "[Compose]",
                        data.output
                    );

                }


                await loadProjects();


                /*
                 * 操作完成后自动刷新日志
                 */

                if (
                    showLogs
                ) {

                    await loadLogs();

                }


            } catch (e) {

                console.error(
                    "[Compose] action failed:",
                    e
                );


                alert(
                    e.message ||
                    "Compose 操作失败"
                );


            } finally {

                setActionLoading(false);

            }

        };


    /*
    ==========================================================
    Logs
    ==========================================================
    */

    const loadLogs =
        async () => {

            if (!selected) {
                return;
            }


            try {

                const res =
                    await fetch(
                        `/api/docker/compose/${encodeURIComponent(
                            selected.name
                        )}/logs`,
                        {
                            credentials:
                                "include"
                        }
                    );


                const data =
                    await res.json();


                if (!res.ok) {

                    throw new Error(
                        data.error ||
                        data.output ||
                        "获取日志失败"
                    );

                }


                setLogs(
                    data.logs ||
                    ""
                );


                setShowLogs(true);


            } catch (e) {

                console.error(
                    "[Compose] logs failed:",
                    e
                );


                alert(
                    e.message ||
                    "获取日志失败"
                );

            }

        };


    /*
    ==========================================================
    Select
    ==========================================================
    */

    const selectProject =
        async (
            project
        ) => {

            setShowLogs(false);

            setEditorMode(false);

            await loadProject(
                project
            );

        };


    /*
    ==========================================================
    Render
    ==========================================================
    */

    return (

        <div
            className="dockerCompose"
        >


            {
                /*
                ==================================================
                Left
                ==================================================
                */
            }


            <aside
                className="composeSidebar"
            >


                <div
                    className="composeSidebarHeader"
                >

                    <strong>
                        Compose
                    </strong>


                    <button
                        className="composeNewButton"
                        onClick={
                            newProject
                        }
                    >

                        +

                    </button>

                </div>


                <div
                    className="composeProjectList"
                >


                    {
                        loading

                            ?

                            <div
                                className="composeEmpty"
                            >

                                正在加载……

                            </div>


                            :

                            projects.length ===
                            0

                                ?

                                <div
                                    className="composeEmpty"
                                >

                                    暂无 Compose

                                </div>


                                :

                                projects.map(
                                    project => (

                                        <div

                                            key={
                                                project.name
                                            }

                                            className={

                                                selected &&
                                                selected.name ===
                                                project.name

                                                    ?

                                                    "composeProject selected"

                                                    :

                                                    "composeProject"

                                            }

                                            onClick={() =>
                                                selectProject(
                                                    project
                                                )
                                            }

                                        >


                                            <Icon
                                                fafa=
                                                    "faDocker"
                                            />


                                            <div
                                                className="composeProjectInfo"
                                            >

                                                <strong>

                                                    {
                                                        project.name
                                                    }

                                                </strong>


                                                <span>

                                                    docker-compose.yml

                                                </span>

                                            </div>


                                        </div>

                                    )
                                )

                    }


                </div>


            </aside>


            {
                /*
                ==================================================
                Right
                ==================================================
                */
            }


            <main
                className="composeMain"
            >


                {
                    !selected &&
                    !editorMode

                        ?

                        <div
                            className="composeWelcome"
                        >

                            <Icon
                                fafa="faDocker"
                            />


                            <h2>
                                Docker Compose
                            </h2>


                            <p>
                                选择一个 Compose 项目，或者创建一个新的项目。
                            </p>


                            <button
                                onClick={
                                    newProject
                                }
                            >

                                + 新建 Compose

                            </button>

                        </div>


                        :


                        <>

                            <div
                                className="composeHeader"
                            >


                                <div>

                                    <h2>

                                        {
                                            editorMode
                                                ?
                                                (
                                                    projectName ||
                                                    "新建 Compose"
                                                )
                                                :
                                                selected?.name
                                        }

                                    </h2>


                                    {
                                        selected &&
                                        !editorMode

                                        &&

                                        <span>

                                            {
                                                selected.path
                                            }

                                        </span>

                                    }

                                </div>


                                <div
                                    className="composeHeaderActions"
                                >


                                    {
                                        selected &&
                                        !editorMode

                                        &&

                                        <>

                                            <button
                                                onClick={() =>
                                                    composeAction(
                                                        "up"
                                                    )
                                                }

                                                disabled={
                                                    actionLoading
                                                }
                                            >

                                                启动

                                            </button>


                                            <button
                                                onClick={() =>
                                                    composeAction(
                                                        "down"
                                                    )
                                                }

                                                disabled={
                                                    actionLoading
                                                }
                                            >

                                                停止

                                            </button>


                                            <button
                                                onClick={() =>
                                                    composeAction(
                                                        "restart"
                                                    )
                                                }

                                                disabled={
                                                    actionLoading
                                                }
                                            >

                                                重启

                                            </button>


                                            <button
                                                onClick={
                                                    loadLogs
                                                }
                                            >

                                                日志

                                            </button>


                                            <button
                                                onClick={() => {

                                                    setEditorMode(
                                                        true
                                                    );

                                                    setShowLogs(
                                                        false
                                                    );

                                                }}
                                            >

                                                编辑

                                            </button>

                                        </>

                                    }


                                    {
                                        editorMode

                                        &&

                                        <>

                                            <button
                                                onClick={
                                                    saveProject
                                                }

                                                disabled={
                                                    saving
                                                }
                                            >

                                                {
                                                    saving
                                                        ?
                                                        "保存中……"
                                                        :
                                                        "保存"
                                                }

                                            </button>


                                            <button
                                                onClick={() => {

                                                    if (
                                                        selected
                                                    ) {

                                                        setEditorMode(
                                                            false
                                                        );

                                                    } else {

                                                        setSelected(
                                                            null
                                                        );

                                                        setEditorMode(
                                                            false
                                                        );

                                                    }

                                                }}
                                            >

                                                取消

                                            </button>

                                        </>

                                    }


                                </div>


                            </div>


                            {
                                editorMode

                                &&

                                <div
                                    className="composeEditor"
                                >


                                    <div
                                        className="composeNameRow"
                                    >

                                        <label>
                                            项目名称
                                        </label>


                                        <input

                                            value={
                                                projectName
                                            }

                                            onChange={e =>
                                                setProjectName(
                                                    e.target.value
                                                )
                                            }

                                            placeholder=
                                                "例如 nginx-test"

                                        />

                                    </div>


                                    <textarea

                                        value={
                                            content
                                        }

                                        onChange={e =>
                                            setContent(
                                                e.target.value
                                            )
                                        }

                                        spellCheck={
                                            false
                                        }

                                        className="composeTextarea"

                                        placeholder=
                                            "在这里输入 docker-compose.yml"

                                    />


                                </div>

                            }


                            {
                                !editorMode &&
                                showLogs

                                &&

                                <div
                                    className="composeLogs"
                                >


                                    <div
                                        className="composeLogsHeader"
                                    >

                                        <strong>
                                            Compose 日志
                                        </strong>


                                        <button
                                            onClick={() =>
                                                setShowLogs(
                                                    false
                                                )
                                            }
                                        >

                                            ×

                                        </button>

                                    </div>


                                    <pre>

                                        {
                                            logs ||
                                            "暂无日志"
                                        }

                                    </pre>


                                </div>

                            }


                            {
                                !editorMode &&
                                !showLogs &&
                                selected

                                &&

                                <div
                                    className="composeInfo"
                                >

                                    <div>
                                        <strong>
                                            项目名称
                                        </strong>

                                        <span>
                                            {
                                                selected.name
                                            }
                                        </span>
                                    </div>


                                    <div>
                                        <strong>
                                            配置文件
                                        </strong>

                                        <span>
                                            {
                                                selected.path
                                            }
                                        </span>
                                    </div>


                                    <div
                                        className="composeHint"
                                    >

                                        使用上方按钮管理这个
                                        Docker Compose 项目。

                                    </div>

                                </div>

                            }

                        </>

                }


            </main>


        </div>

    );

};


export default DockerCompose;
