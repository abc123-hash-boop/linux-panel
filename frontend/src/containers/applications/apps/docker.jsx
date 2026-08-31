import React, {
    useEffect,
    useState,
} from "react";

import DockerCreate from "./dockerCreate";
import DockerCompose from "./dockerCompose";
import {
    useSelector,
    useDispatch,
} from "react-redux";

import {
    ToolBar,
    Icon,
} from "../../../utils/general";

import "./assets/docker.scss";


const Docker = () => {

    /*
    ==========================================================
    Redux
    ==========================================================
    */

    const dispatch =
        useDispatch();


    const wnapp =
        useSelector(
            state =>
                state.apps.docker
        );


    /*
    ==========================================================
    State
    ==========================================================
    */

    const [
        create,
        setCreate
    ] = useState(false);


    /*
    ==========================================================
    Containers
    ==========================================================
    */

    const [
        containers,
        setContainers
    ] = useState([]);


    /*
    ==========================================================
    Volumes
    ==========================================================
    */

    const [
        volumes,
        setVolumes
    ] = useState([]);


    /*
    ==========================================================
    Images
    ==========================================================
    */

    const [
        images,
        setImages
    ] = useState([]);


    /*
    ==========================================================
    Networks
    ==========================================================
    */

    const [
        networks,
        setNetworks
    ] = useState([]);


    /*
    ==========================================================
    Compose
    ==========================================================
    */

    const [
        composes,
        setComposes
    ] = useState([]);


    /*
    ==========================================================
    Compose Logs
    ==========================================================
    */

    const [
        composeLogs,
        setComposeLogs
    ] = useState(null);


    const [
        composeLogsName,
        setComposeLogsName
    ] = useState("");


    const [
        composeLogsLoading,
        setComposeLogsLoading
    ] = useState(false);


    /*
    ==========================================================
    当前 Tab
    ==========================================================
    */

    const [
        tab,
        setTab
    ] = useState(
        "Containers"
    );


    /*
    ==========================================================
    Loading
    ==========================================================
    */

    const [
        volumeLoading,
        setVolumeLoading
    ] = useState(false);


    const [
        imageLoading,
        setImageLoading
    ] = useState(false);


    const [
        networkLoading,
        setNetworkLoading
    ] = useState(false);


    const [
        composeLoading,
        setComposeLoading
    ] = useState(false);


    /*
    ==========================================================
    Image Pull
    ==========================================================
    */

    const [
        pulling,
        setPulling
    ] = useState(false);


    const [
        pullTask,
        setPullTask
    ] = useState(null);


    const [
        pullImageName,
        setPullImageName
    ] = useState("");


    /*
    ==========================================================
    Compose Upload
    ==========================================================
    */

    const [
        composeUploading,
        setComposeUploading
    ] = useState(false);


    /*
    ==========================================================
    加载 Containers
    ==========================================================
    */

    const loadContainers =
        async () => {

            try {

                const res =
                    await fetch(
                        "/api/docker/containers",
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
                        "加载容器失败"
                    );

                }


                setContainers(
                    Array.isArray(data)
                        ? data
                        : []
                );


            } catch (e) {

                console.error(
                    "[Docker] load containers failed:",
                    e
                );

                setContainers([]);

            }

        };


    /*
    ==========================================================
    加载 Volumes
    ==========================================================
    */

    const loadVolumes =
        async () => {

            setVolumeLoading(
                true
            );


            try {

                const res =
                    await fetch(
                        "/api/docker/volumes",
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
                        "加载卷失败"
                    );

                }


                setVolumes(
                    Array.isArray(data)
                        ? data
                        : []
                );


            } catch (e) {

                console.error(
                    "[Docker] load volumes failed:",
                    e
                );


                setVolumes([]);

            } finally {

                setVolumeLoading(
                    false
                );

            }

        };


    /*
    ==========================================================
    加载 Images
    ==========================================================
    */

    const loadImages =
        async () => {

            setImageLoading(
                true
            );


            try {

                const res =
                    await fetch(
                        "/api/docker/images",
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
                        "加载镜像失败"
                    );

                }


                setImages(
                    Array.isArray(data)
                        ? data
                        : []
                );


            } catch (e) {

                console.error(
                    "[Docker] load images failed:",
                    e
                );


                setImages([]);

            } finally {

                setImageLoading(
                    false
                );

            }

        };


    /*
    ==========================================================
    加载 Networks
    ==========================================================
    */

    const loadNetworks =
        async () => {

            setNetworkLoading(
                true
            );


            try {

                const res =
                    await fetch(
                        "/api/docker/networks",
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
                        "加载网络失败"
                    );

                }


                setNetworks(
                    Array.isArray(data)
                        ? data
                        : []
                );


            } catch (e) {

                console.error(
                    "[Docker] load networks failed:",
                    e
                );


                setNetworks([]);

            } finally {

                setNetworkLoading(
                    false
                );

            }

        };


    /*
    ==========================================================
    加载 Compose
    ==========================================================
    */

    const loadComposes =
        async () => {

            setComposeLoading(
                true
            );


            try {

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


                setComposes(
                    Array.isArray(data)
                        ? data
                        : []
                );


            } catch (e) {

                console.error(
                    "[Docker] load compose failed:",
                    e
                );


                setComposes([]);

            } finally {

                setComposeLoading(
                    false
                );

            }

        };


    /*
    ==========================================================
    初始加载
    ==========================================================
    */

    useEffect(() => {

        loadContainers();

        loadVolumes();

        loadImages();

        loadNetworks();

        loadComposes();

    }, []);


    /*
    ==========================================================
    Docker 操作
    ==========================================================
    */

    const action =
        async (
            url,
            reload = loadContainers
        ) => {

            try {

                const res =
                    await fetch(
                        url,
                        {
                            method:
                                "POST",

                            credentials:
                                "include"
                        }
                    );


                let data = {};

                try {

                    data =
                        await res.json();

                } catch (e) {}


                if (!res.ok) {

                    throw new Error(
                        data.error ||
                        "Docker 操作失败"
                    );

                }


                if (reload) {

                    await reload();

                }


            } catch (e) {

                console.error(
                    "[Docker] action failed:",
                    e
                );


                alert(
                    e.message ||
                    "Docker 操作失败"
                );

            }

        };


    /*
    ==========================================================
    删除 Container
    ==========================================================
    */

    const remove =
        async (
            id
        ) => {

            if (
                !window.confirm(
                    "确定要删除这个容器吗？"
                )
            ) {

                return;

            }


            try {

                const res =
                    await fetch(
                        `/api/docker/container/${encodeURIComponent(id)}`,
                        {
                            method:
                                "DELETE",

                            credentials:
                                "include"
                        }
                    );


                const data =
                    await res.json();


                if (!res.ok) {

                    throw new Error(
                        data.error ||
                        "删除容器失败"
                    );

                }


                await loadContainers();


            } catch (e) {

                console.error(
                    "[Docker] remove failed:",
                    e
                );


                alert(
                    e.message ||
                    "删除容器失败"
                );

            }

        };


    /*
    ==========================================================
    Docker Terminal
    ==========================================================
    */

    const terminal =
        (id) => {

            console.log(
                "[Docker] Open terminal:",
                id
            );


            dispatch({

                type:
                    "DOCKERTERMINAL",

                payload:
                    id

            });

        };


    /*
    ==========================================================
    创建 Volume
    ==========================================================
    */

    const createVolume =
        async () => {

            const name =
                window.prompt(
                    "请输入 Volume 名称："
                );


            if (!name) {

                return;

            }


            const volumeName =
                name.trim();


            if (!volumeName) {

                return;

            }


            try {

                const res =
                    await fetch(
                        "/api/docker/volume",
                        {
                            method:
                                "POST",

                            credentials:
                                "include",

                            headers: {

                                "Content-Type":
                                    "application/json"

                            },

                            body:
                                JSON.stringify({

                                    name:
                                        volumeName,

                                    driver:
                                        "local"

                                })

                        }
                    );


                const data =
                    await res.json();


                if (!res.ok) {

                    throw new Error(
                        data.error ||
                        "创建 Volume 失败"
                    );

                }


                await loadVolumes();


            } catch (e) {

                console.error(
                    "[Docker] create volume failed:",
                    e
                );


                alert(
                    e.message ||
                    "创建 Volume 失败"
                );

            }

        };


    /*
    ==========================================================
    删除 Volume
    ==========================================================
    */

    const removeVolume =
        async (
            name
        ) => {

            if (
                !window.confirm(
                    `确定要删除 Volume「${name}」吗？`
                )
            ) {

                return;

            }


            try {

                const res =
                    await fetch(
                        `/api/docker/volume/${encodeURIComponent(name)}`,
                        {
                            method:
                                "DELETE",

                            credentials:
                                "include"
                        }
                    );


                const data =
                    await res.json();


                if (!res.ok) {

                    throw new Error(
                        data.error ||
                        "删除 Volume 失败"
                    );

                }


                await loadVolumes();


            } catch (e) {

                console.error(
                    "[Docker] remove volume failed:",
                    e
                );


                alert(
                    e.message ||
                    "删除 Volume 失败"
                );

            }

        };


    /*
    ==========================================================
    创建 Network
    ==========================================================
    */

    const createNetwork =
        async () => {

            const name =
                window.prompt(
                    "请输入网络名称：",
                    "my-network"
                );


            if (!name) {

                return;

            }


            const networkName =
                name.trim();


            if (!networkName) {

                return;

            }


            const driver =
                window.prompt(
                    "请输入网络 Driver：",
                    "bridge"
                );


            if (
                driver === null
            ) {

                return;

            }


            const networkDriver =
                driver.trim() ||
                "bridge";


            try {

                const res =
                    await fetch(
                        "/api/docker/network",
                        {
                            method:
                                "POST",

                            credentials:
                                "include",

                            headers: {

                                "Content-Type":
                                    "application/json"

                            },

                            body:
                                JSON.stringify({

                                    name:
                                        networkName,

                                    driver:
                                        networkDriver,

                                    attachable:
                                        true

                                })

                        }
                    );


                const data =
                    await res.json();


                if (!res.ok) {

                    throw new Error(
                        data.error ||
                        "创建网络失败"
                    );

                }


                await loadNetworks();


            } catch (e) {

                console.error(
                    "[Docker] create network failed:",
                    e
                );


                alert(
                    e.message ||
                    "创建网络失败"
                );

            }

        };


    /*
    ==========================================================
    删除 Network
    ==========================================================
    */

    const removeNetwork =
        async (
            id,
            name
        ) => {

            if (!id) {

                return;

            }


            if (
                !window.confirm(
                    `确定要删除网络「${name || id}」吗？`
                )
            ) {

                return;

            }


            try {

                const res =
                    await fetch(
                        `/api/docker/network/${encodeURIComponent(id)}`,
                        {
                            method:
                                "DELETE",

                            credentials:
                                "include"
                        }
                    );


                const data =
                    await res.json();


                if (!res.ok) {

                    throw new Error(
                        data.error ||
                        "删除网络失败"
                    );

                }


                await loadNetworks();


            } catch (e) {

                console.error(
                    "[Docker] remove network failed:",
                    e
                );


                alert(
                    e.message ||
                    "删除网络失败"
                );

            }

        };


    /*
    ==========================================================
    Image Size
    ==========================================================
    */

    const formatSize =
        (bytes) => {

            if (
                bytes === undefined ||
                bytes === null
            ) {

                return "-";

            }


            if (
                Number(bytes) === 0
            ) {

                return "0 B";

            }


            const units = [
                "B",
                "KB",
                "MB",
                "GB",
                "TB"
            ];


            let size =
                Number(bytes);


            let index =
                0;


            while (
                size >= 1024 &&
                index <
                    units.length - 1
            ) {

                size /=
                    1024;

                index++;

            }


            return (
                `${size.toFixed(
                    index === 0
                        ? 0
                        : 2
                )} ${units[index]}`
            );

        };


    /*
    ==========================================================
    Image Created
    ==========================================================
    */

    const formatCreated =
        (timestamp) => {

            if (
                timestamp === undefined ||
                timestamp === null ||
                Number(timestamp) === 0
            ) {

                return "-";

            }


            try {

                return new Date(
                    Number(timestamp) * 1000
                ).toLocaleString();

            } catch (e) {

                return "-";

            }

        };


    /*
    ==========================================================
    Image ID
    ==========================================================
    */

    const shortImageId =
        (id) => {

            if (!id) {

                return "-";

            }


            return id
                .replace(
                    /^sha256:/,
                    ""
                )
                .substring(
                    0,
                    12
                );

        };


    /*
    ==========================================================
    Container Uptime
    ==========================================================
    */

    const formatUptime =
        (status) => {

            if (!status) {

                return "-";

            }


            return status.replace(
                /^Up\s+/i,
                ""
            );

        };


    /*
    ==========================================================
    Container Status
    ==========================================================
    */

    const formatContainerStatus =
        (state) => {

            if (
                state === "running"
            ) {

                return "运行中";

            }


            if (
                state === "paused"
            ) {

                return "已暂停";

            }


            if (
                state === "exited"
            ) {

                return "已停止";

            }


            if (
                state === "created"
            ) {

                return "已创建";

            }


            if (
                state === "restarting"
            ) {

                return "重启中";

            }


            if (
                state === "dead"
            ) {

                return "异常";

            }


            return state ||
                "未知";

        };


    /*
    ==========================================================
    Container Ports
    ==========================================================
    */

    const formatPorts =
        (ports) => {

            if (
                !Array.isArray(ports) ||
                ports.length === 0
            ) {

                return (
                    <span>
                        无端口映射
                    </span>
                );

            }


            return ports.map(
                (
                    port,
                    index
                ) => {

                    const publicPort =
                        port.public ??
                        port.hostPort ??
                        port.PublicPort;


                    const privatePort =
                        port.private ??
                        port.containerPort ??
                        port.PrivatePort;


                    const protocol =
                        port.protocol ||
                        port.Protocol ||
                        "tcp";


                    if (
                        publicPort === undefined ||
                        publicPort === null ||
                        publicPort === ""
                    ) {

                        return (

                            <div
                                key={
                                    index
                                }
                            >

                                {privatePort}

                                /

                                {protocol}

                            </div>

                        );

                    }


                    return (

                        <div
                            key={
                                index
                            }
                        >

                            0.0.0.0:

                            {publicPort}

                            {" → "}

                            {privatePort}

                            /

                            {protocol}

                        </div>

                    );

                }
            );

        };


    /*
    ==========================================================
    Network List Formatting
    ==========================================================
    */

    const formatNetworkList =
        (list) => {

            if (
                !Array.isArray(list) ||
                list.length === 0
            ) {

                return "-";

            }


            return list.map(
                (
                    item,
                    index
                ) => (

                    <div
                        key={
                            index
                        }
                    >

                        <code>
                            {item}
                        </code>

                    </div>

                )
            );

        };


    /*
    ==========================================================
    Pull Image
    ==========================================================
    */

    const pullImage =
        async () => {

            const name =
                window.prompt(
                    "请输入镜像名称：",
                    "ubuntu:latest"
                );


            if (!name) {

                return;

            }


            const imageName =
                name.trim();


            if (!imageName) {

                return;

            }


            if (pulling) {

                return;

            }


            setPulling(
                true
            );


            setPullImageName(
                imageName
            );


            setPullTask(
                null
            );


            try {

                const res =
                    await fetch(
                        "/api/docker/image/pull",
                        {
                            method:
                                "POST",

                            credentials:
                                "include",

                            headers: {

                                "Content-Type":
                                    "application/json"

                            },

                            body:
                                JSON.stringify({

                                    image:
                                        imageName

                                })

                        }
                    );


                const data =
                    await res.json();


                if (!res.ok) {

                    throw new Error(
                        data.error ||
                        "拉取镜像失败"
                    );

                }


                setPullTask({

                    id:
                        data.task_id,

                    status:
                        "running",

                    progress:
                        0,

                    current:
                        0,

                    total:
                        0,

                    logs:
                        []

                });


            } catch (e) {

                console.error(
                    "[Docker] pull image failed:",
                    e
                );


                setPulling(
                    false
                );


                setPullImageName(
                    ""
                );


                setPullTask(
                    null
                );


                alert(
                    e.message ||
                    "拉取镜像失败"
                );

            }

        };


    /*
    ==========================================================
    Pull Status Polling
    ==========================================================
    */

    useEffect(() => {

        if (
            !pulling ||
            !pullTask ||
            !pullTask.id
        ) {

            return;

        }


        let stopped =
            false;


        const checkStatus =
            async () => {

                try {

                    const res =
                        await fetch(
                            `/api/docker/image/pull/status/${encodeURIComponent(
                                pullTask.id
                            )}`,
                            {
                                credentials:
                                    "include"
                            }
                        );


                    const data =
                        await res.json();


                    if (
                        stopped
                    ) {

                        return;

                    }


                    if (!res.ok) {

                        throw new Error(
                            data.error ||
                            "获取镜像拉取状态失败"
                        );

                    }


                    setPullTask(
                        data
                    );


                    if (
                        data.status === "done" ||
                        data.status === "failed"
                    ) {

                        setPulling(
                            false
                        );


                        if (
                            data.status === "done"
                        ) {

                            await loadImages();

                        }


                        return;

                    }


                } catch (e) {

                    if (
                        stopped
                    ) {

                        return;

                    }


                    console.error(
                        "[Docker] pull status failed:",
                        e
                    );


                    setPulling(
                        false
                    );


                    alert(
                        e.message ||
                        "获取镜像拉取状态失败"
                    );

                }

            };


        checkStatus();


        const timer =
            setInterval(
                checkStatus,
                1000
            );


        return () => {

            stopped =
                true;

            clearInterval(
                timer
            );

        };

    }, [
        pulling,
        pullTask &&
            pullTask.id
    ]);


    /*
    ==========================================================
    删除 Image
    ==========================================================
    */

    const removeImage =
        async (
            id
        ) => {

            if (!id) {

                return;

            }


            if (
                !window.confirm(
                    "确定要删除这个镜像吗？"
                )
            ) {

                return;

            }


            try {

                const res =
                    await fetch(
                        `/api/docker/image/${encodeURIComponent(id)}`,
                        {
                            method:
                                "DELETE",

                            credentials:
                                "include"
                        }
                    );


                const data =
                    await res.json();


                if (!res.ok) {

                    throw new Error(
                        data.error ||
                        "删除镜像失败"
                    );

                }


                await loadImages();


            } catch (e) {

                console.error(
                    "[Docker] remove image failed:",
                    e
                );


                alert(
                    e.message ||
                    "删除镜像失败"
                );

            }

        };


    /*
    ==========================================================
    Compose Upload
    ==========================================================
    */

    const uploadCompose =
        async () => {

            if (composeUploading) {

                return;

            }


            const input =
                document.createElement(
                    "input"
                );


            input.type =
                "file";


            input.accept =
                ".yml,.yaml";


            input.onchange =
                async (
                    event
                ) => {

                    const file =
                        event.target.files &&
                        event.target.files[0];


                    if (!file) {

                        return;

                    }


                    try {

                        setComposeUploading(
                            true
                        );


                        /*
                        ==========================================
                        读取 YAML 文件
                        ==========================================
                        */

                        const content =
                            await file.text();


                        if (
                            !content.trim()
                        ) {

                            throw new Error(
                                "YAML 文件为空"
                            );

                        }


                        /*
                        ==========================================
                        根据文件名生成默认项目名
                        ==========================================
                        */

                        let defaultName =
                            file.name
                                .replace(
                                    /\.ya?ml$/i,
                                    ""
                                )
                                .trim();


                        if (
                            !defaultName
                        ) {

                            defaultName =
                                "compose-project";

                        }


                        /*
                        ==========================================
                        输入项目名称
                        ==========================================
                        */

                        const name =
                            window.prompt(
                                "请输入 Compose 项目名称：",
                                defaultName
                            );


                        if (
                            name === null
                        ) {

                            return;

                        }


                        const projectName =
                            name.trim();


                        if (
                            !projectName
                        ) {

                            throw new Error(
                                "项目名称不能为空"
                            );

                        }


                        /*
                        ==========================================
                        POST JSON

                        对应 Go：

                        type ComposeUploadRequest struct {
                            Name string `json:"name"`
                            Content string `json:"content"`
                        }

                        ==========================================
                        */

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

                                    body:
                                        JSON.stringify({

                                            name:
                                                projectName,

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
                                "上传 Compose 失败"
                            );

                        }


                        /*
                        ==========================================
                        刷新 Compose
                        ==========================================
                        */

                        await loadComposes();


                        /*
                        ==========================================
                        成功提示
                        ==========================================
                        */

                        alert(
                            data.message ||
                            `Compose 项目「${projectName}」上传成功`
                        );


                    } catch (e) {

                        console.error(
                            "[Docker] compose upload failed:",
                            e
                        );


                        alert(
                            e.message ||
                            "上传 Compose 失败"
                        );


                    } finally {

                        setComposeUploading(
                            false
                        );

                    }

                };


            input.click();

        };


    /*
    ==========================================================
    Compose 操作
    ==========================================================
    */

    const composeAction =
        async (
            name,
            operation
        ) => {

            if (!name) {

                return;

            }


            let actionName =
                "操作";


            if (
                operation === "up"
            ) {

                actionName =
                    "启动";

            }


            if (
                operation === "down"
            ) {

                actionName =
                    "停止";

            }


            if (
                operation === "restart"
            ) {

                actionName =
                    "重启";

            }


            try {

                const res =
                    await fetch(
                        `/api/docker/compose/${encodeURIComponent(
                            name
                        )}/${operation}`,
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
                        `${actionName} Compose 失败`
                    );

                }


                await loadComposes();

                await loadContainers();


            } catch (e) {

                console.error(
                    `[Docker] compose ${operation} failed:`,
                    e
                );


                alert(
                    e.message ||
                    `${actionName} Compose 失败`
                );

            }

        };


    /*
    ==========================================================
    Compose Logs
    ==========================================================
    */

    const showComposeLogs =
        async (
            name
        ) => {

            if (!name) {

                return;

            }


            setComposeLogsName(
                name
            );


            setComposeLogs(
                null
            );


            setComposeLogsLoading(
                true
            );


            try {

                const res =
                    await fetch(
                        `/api/docker/compose/${encodeURIComponent(
                            name
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
                        "获取 Compose 日志失败"
                    );

                }


                if (
                    typeof data ===
                    "string"
                ) {

                    setComposeLogs(
                        data
                    );

                } else {

                    setComposeLogs(
                        data.logs ||
                        data.output ||
                        data.message ||
                        JSON.stringify(
                            data,
                            null,
                            2
                        )
                    );

                }


            } catch (e) {

                console.error(
                    "[Docker] compose logs failed:",
                    e
                );


                setComposeLogs(
                    e.message ||
                    "获取日志失败"
                );

            } finally {

                setComposeLogsLoading(
                    false
                );

            }

        };


    /*
    ==========================================================
    Tabs
    ==========================================================
    */

    const tabs = [

        {
            title:
                "Containers",

            label:
                "容器",

            icon:
                "faBoxes"

        },

        {
            title:
                "Images",

            label:
                "镜像",

            icon:
                "faLayerGroup"

        },

        {
            title:
                "Volumes",

            label:
                "卷",

            icon:
                "faHardDrive"

        },

        {
            title:
                "Networks",

            label:
                "网络",

            icon:
                "faNetworkWired"

        },

        {
            title:
                "Compose",

            label:
                "Compose",

            icon:
                "faFileCode"

        }

    ];


    /*
    ==========================================================
    Render
    ==========================================================
    */

    return (

        <div

            className=
                "dockerApp floatTab dpShad"

            data-size=
                {wnapp.size}

            data-max=
                {wnapp.max}

            style={{

                ...(wnapp.size === "cstm"
                    ?
                    wnapp.dim
                    :
                    null
                ),

                zIndex:
                    wnapp.z

            }}

            data-hide=
                {wnapp.hide}

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

                name=
                    "Docker 管理器"

            />


            <div
                className=
                    "windowScreen flex flex-col"
            >

                <div
                    className=
                        "restWindow flex flex-grow"
                >

                    <nav>

                        {
                            tabs.map(
                                (
                                    item,
                                    index
                                ) => (

                                    <div

                                        key={
                                            index
                                        }

                                        className={

                                            tab ===
                                            item.title

                                                ?

                                                "navLink selected"

                                                :

                                                "navLink"

                                        }

                                        onClick={() => {

                                            setTab(
                                                item.title
                                            );


                                            if (
                                                item.title ===
                                                "Volumes"
                                            ) {

                                                loadVolumes();

                                            }


                                            if (
                                                item.title ===
                                                "Images"
                                            ) {

                                                loadImages();

                                            }


                                            if (
                                                item.title ===
                                                "Containers"
                                            ) {

                                                loadContainers();

                                            }


                                            if (
                                                item.title ===
                                                "Networks"
                                            ) {

                                                loadNetworks();

                                            }


                                            if (
                                                item.title ===
                                                "Compose"
                                            ) {

                                                loadComposes();

                                            }

                                        }}

                                    >

                                        <Icon
                                            fafa={
                                                item.icon
                                            }
                                        />

                                        <span>

                                            {
                                                item.label
                                            }

                                        </span>

                                    </div>

                                )
                            )
                        }

                    </nav>


                    <main
                        className=
                            "win11Scroll"
                    >

                        <div
                            className=
                                "docker-title"
                        >

                            <h3>

                                {
                                    tabs.find(
                                        item =>
                                            item.title ===
                                            tab
                                    )?.label ||
                                    tab
                                }

                            </h3>


                            {
                                tab ===
                                "Containers"

                                &&

                                <button
                                    className=
                                        "add-container"

                                    onClick={() =>
                                        setCreate(
                                            true
                                        )
                                    }
                                >

                                    +

                                </button>
                            }


                            {
                                tab ===
                                "Images"

                                &&

                                <button
                                    className=
                                        "add-container"

                                    onClick={
                                        pullImage
                                    }

                                    disabled={
                                        pulling
                                    }
                                >

                                    +

                                </button>
                            }


                            {
                                tab ===
                                "Volumes"

                                &&

                                <button
                                    className=
                                        "add-container"

                                    onClick={
                                        createVolume
                                    }
                                >

                                    +

                                </button>
                            }


                            {
                                tab ===
                                "Networks"

                                &&

                                <button
                                    className=
                                        "add-container"

                                    onClick={
                                        createNetwork
                                    }
                                >

                                    +

                                </button>
                            }


                            {
                                tab ===
                                "Compose"

                                &&

                                <button
                                    className=
                                        "add-container"

                                    onClick={
                                        uploadCompose
                                    }

                                    disabled={
                                        composeUploading
                                    }

                                    title=
                                        "上传 docker-compose.yml"
                                >

                                    +

                                </button>
                            }

                        </div>


                        {
                            /*
                            ====================================
                            Containers
                            ====================================
                            */

                            tab ===
                            "Containers"

                            &&

                            <div
                                className=
                                    "docker-list"
                            >

                                {
                                    containers.length ===
                                    0

                                        ?

                                        <div
                                            className=
                                                "empty-tab"
                                        >

                                            没有容器

                                        </div>

                                        :

                                        containers.map(

                                            container => (

                                                <div

                                                    className=
                                                        "docker-card"

                                                    key={
                                                        container.id
                                                    }

                                                >

                                                    <div
                                                        className=
                                                            "docker-header"
                                                    >

                                                        <Icon
                                                            fafa=
                                                                "faDocker"
                                                        />

                                                        <strong>

                                                            {
                                                                container.name
                                                            }

                                                        </strong>

                                                    </div>


                                                    <div>

                                                        镜像：

                                                        {" "}

                                                        {
                                                            container.image ||
                                                            "-"
                                                        }

                                                    </div>


                                                    <div>

                                                        状态：

                                                        {" "}

                                                        <span

                                                            className={

                                                                container.state ===
                                                                "running"

                                                                    ?

                                                                    "running"

                                                                    :

                                                                    "stopped"

                                                            }

                                                        >

                                                            {
                                                                formatContainerStatus(
                                                                    container.state
                                                                )
                                                            }

                                                        </span>

                                                    </div>


                                                    <div>

                                                        Uptime：

                                                        {" "}

                                                        {
                                                            container.state ===
                                                            "running"

                                                                ?

                                                                formatUptime(
                                                                    container.status
                                                                )

                                                                :

                                                                "-"
                                                        }

                                                    </div>


                                                    <div>

                                                        IP：

                                                        {" "}

                                                        <code>

                                                            {
                                                                container.ip ||
                                                                "-"
                                                            }

                                                        </code>

                                                    </div>


                                                    <div>

                                                        端口映射：

                                                        {" "}

                                                        {
                                                            formatPorts(
                                                                container.ports
                                                            )
                                                        }

                                                    </div>


                                                    <div
                                                        className=
                                                            "docker-actions"
                                                    >

                                                        <button
                                                            onClick={() =>
                                                                terminal(
                                                                    container.id
                                                                )
                                                            }
                                                        >

                                                            终端

                                                        </button>


                                                        {
                                                            container.state ===
                                                            "running"

                                                            &&

                                                            <button
                                                                onClick={() =>
                                                                    action(
                                                                        `/api/docker/container/stop/${encodeURIComponent(
                                                                            container.id
                                                                        )}`
                                                                    )
                                                                }
                                                            >

                                                                停止

                                                            </button>
                                                        }


                                                        {
                                                            container.state !==
                                                            "running"

                                                            &&

                                                            <button
                                                                onClick={() =>
                                                                    action(
                                                                        `/api/docker/container/start/${encodeURIComponent(
                                                                            container.id
                                                                        )}`
                                                                    )
                                                                }
                                                            >

                                                                启动

                                                            </button>
                                                        }


                                                        <button
                                                            onClick={() =>
                                                                action(
                                                                    `/api/docker/container/restart/${encodeURIComponent(
                                                                        container.id
                                                                    )}`
                                                                )
                                                            }
                                                        >

                                                            重启

                                                        </button>


                                                        <button
                                                            onClick={() =>
                                                                remove(
                                                                    container.id
                                                                )
                                                            }
                                                        >

                                                            删除

                                                        </button>

                                                    </div>

                                                </div>

                                            )

                                        )

                                }

                            </div>
                        }


                        {
                            /*
                            ====================================
                            Images
                            ====================================
                            */

                            tab ===
                            "Images"

                            &&

                            <div
                                className=
                                    "docker-list"
                            >

                                {
                                    pulling

                                    &&

                                    <div
                                        className=
                                            "docker-card"
                                    >

                                        <div
                                            className=
                                                "docker-header"
                                        >

                                            <Icon
                                                fafa=
                                                    "faLayerGroup"
                                            />

                                            <strong>

                                                正在拉取：

                                                {" "}

                                                {
                                                    pullImageName
                                                }

                                            </strong>

                                        </div>


                                        <div>

                                            状态：

                                            {" "}

                                            {
                                                pullTask &&
                                                pullTask.status
                                                    ?

                                                    (
                                                        pullTask.status ===
                                                        "running"

                                                            ?

                                                            "正在下载"

                                                            :

                                                            pullTask.status ===
                                                            "done"

                                                                ?

                                                                "完成"

                                                                :

                                                                pullTask.status ===
                                                                "failed"

                                                                    ?

                                                                    "失败"

                                                                    :

                                                                    pullTask.status
                                                    )

                                                    :

                                                    "正在启动"

                                            }

                                        </div>


                                        <div>

                                            进度：

                                            {" "}

                                            {
                                                pullTask &&
                                                pullTask.progress !==
                                                    undefined

                                                    ?

                                                    `${pullTask.progress}%`

                                                    :

                                                    "0%"
                                            }

                                        </div>


                                        {
                                            pullTask &&
                                            pullTask.total >
                                                0

                                            &&

                                            <div>

                                                已下载：

                                                {" "}

                                                {
                                                    formatSize(
                                                        pullTask.current
                                                    )
                                                }

                                                {" / "}

                                                {
                                                    formatSize(
                                                        pullTask.total
                                                    )
                                                }

                                            </div>
                                        }

                                    </div>
                                }


                                {
                                    imageLoading

                                    ?

                                    <div
                                        className=
                                            "empty-tab"
                                    >

                                        正在加载镜像……

                                    </div>

                                    :

                                    images.length ===
                                    0

                                        ?

                                        <div
                                            className=
                                                "empty-tab"
                                        >

                                            没有镜像

                                        </div>

                                        :

                                        images.map(

                                            image => (

                                                <div

                                                    className=
                                                        "docker-card"

                                                    key={
                                                        image.id
                                                    }

                                                >

                                                    <div
                                                        className=
                                                            "docker-header"
                                                    >

                                                        <Icon
                                                            fafa=
                                                                "faLayerGroup"
                                                        />

                                                        <strong>

                                                            {
                                                                image.tags &&
                                                                image.tags.length >
                                                                    0

                                                                ?

                                                                image.tags.join(
                                                                    ", "
                                                                )

                                                                :

                                                                "<none>:<none>"
                                                            }

                                                        </strong>

                                                    </div>


                                                    <div>

                                                        ID：

                                                        {" "}

                                                        <code>

                                                            {
                                                                shortImageId(
                                                                    image.id
                                                                )
                                                            }

                                                        </code>

                                                    </div>


                                                    <div>

                                                        大小：

                                                        {" "}

                                                        {
                                                            formatSize(
                                                                image.size
                                                            )
                                                        }

                                                    </div>


                                                    <div>

                                                        创建时间：

                                                        {" "}

                                                        {
                                                            formatCreated(
                                                                image.created
                                                            )
                                                        }

                                                    </div>


                                                    <div>

                                                        使用中的容器：

                                                        {" "}

                                                        {
                                                            image.containers !==
                                                            undefined

                                                                ?

                                                                image.containers

                                                                :

                                                                0
                                                        }

                                                    </div>


                                                    <div
                                                        className=
                                                            "docker-actions"
                                                    >

                                                        <button
                                                            onClick={() =>
                                                                removeImage(
                                                                    image.id
                                                                )
                                                            }
                                                        >

                                                            删除

                                                        </button>

                                                    </div>

                                                </div>

                                            )

                                        )

                                }

                            </div>
                        }


                        {
                            /*
                            ====================================
                            Volumes
                            ====================================
                            */

                            tab ===
                            "Volumes"

                            &&

                            <div
                                className=
                                    "docker-list"
                            >

                                {
                                    volumeLoading

                                    ?

                                    <div
                                        className=
                                            "empty-tab"
                                    >

                                        正在加载卷……

                                    </div>

                                    :

                                    volumes.length ===
                                    0

                                        ?

                                        <div
                                            className=
                                                "empty-tab"
                                        >

                                            没有卷

                                        </div>

                                        :

                                        volumes.map(

                                            volume => (

                                                <div

                                                    className=
                                                        "docker-card"

                                                    key={
                                                        volume.name
                                                    }

                                                >

                                                    <div
                                                        className=
                                                            "docker-header"
                                                    >

                                                        <Icon
                                                            fafa=
                                                                "faHardDrive"
                                                        />

                                                        <strong>

                                                            {
                                                                volume.name
                                                            }

                                                        </strong>

                                                    </div>


                                                    <div>

                                                        驱动：

                                                        {" "}

                                                        {
                                                            volume.driver ||
                                                            "local"
                                                        }

                                                    </div>


                                                    <div>

                                                        Scope：

                                                        {" "}

                                                        {
                                                            volume.scope ||
                                                            "local"
                                                        }

                                                    </div>


                                                    <div>

                                                        挂载点：

                                                        {" "}

                                                        {
                                                            volume.mountpoint ||
                                                            "-"
                                                        }

                                                    </div>


                                                    <div>

                                                        创建时间：

                                                        {" "}

                                                        {
                                                            volume.created ||
                                                            "-"
                                                        }

                                                    </div>


                                                    <div
                                                        className=
                                                            "docker-actions"
                                                    >

                                                        <button
                                                            onClick={() =>
                                                                removeVolume(
                                                                    volume.name
                                                                )
                                                            }
                                                        >

                                                            删除

                                                        </button>

                                                    </div>

                                                </div>

                                            )

                                        )

                                }

                            </div>
                        }


                        {
                            /*
                            ====================================
                            Networks
                            ====================================
                            */

                            tab ===
                            "Networks"

                            &&

                            <div
                                className=
                                    "docker-list"
                            >

                                {
                                    networkLoading

                                    ?

                                    <div
                                        className=
                                            "empty-tab"
                                    >

                                        正在加载网络……

                                    </div>

                                    :

                                    networks.length ===
                                    0

                                        ?

                                        <div
                                            className=
                                                "empty-tab"
                                        >

                                            没有网络

                                        </div>

                                        :

                                        networks.map(

                                            network => (

                                                <div

                                                    className=
                                                        "docker-card"

                                                    key={
                                                        network.id
                                                    }

                                                >

                                                    <div
                                                        className=
                                                            "docker-header"
                                                    >

                                                        <Icon
                                                            fafa=
                                                                "faNetworkWired"
                                                        />

                                                        <strong>

                                                            {
                                                                network.name ||
                                                                "-"
                                                            }

                                                        </strong>

                                                    </div>


                                                    <div>

                                                        ID：

                                                        {" "}

                                                        <code>

                                                            {
                                                                network.id
                                                                    ?

                                                                    network.id.substring(
                                                                        0,
                                                                        12
                                                                    )

                                                                    :

                                                                    "-"
                                                            }

                                                        </code>

                                                    </div>


                                                    <div>

                                                        Driver：

                                                        {" "}

                                                        {
                                                            network.driver ||
                                                            "-"
                                                        }

                                                    </div>


                                                    <div>

                                                        Scope：

                                                        {" "}

                                                        {
                                                            network.scope ||
                                                            "-"
                                                        }

                                                    </div>


                                                    <div>

                                                        IPv4：

                                                        {" "}

                                                        {
                                                            formatNetworkList(
                                                                network.ipv4
                                                            )
                                                        }

                                                    </div>


                                                    <div>

                                                        IPv6：

                                                        {" "}

                                                        {
                                                            formatNetworkList(
                                                                network.ipv6
                                                            )
                                                        }

                                                    </div>


                                                    <div>

                                                        Internal：

                                                        {" "}

                                                        <span>

                                                            {
                                                                network.internal
                                                                    ?

                                                                    "是"

                                                                    :

                                                                    "否"
                                                            }

                                                        </span>

                                                    </div>


                                                    <div>

                                                        Attachable：

                                                        {" "}

                                                        <span>

                                                            {
                                                                network.attachable
                                                                    ?

                                                                    "是"

                                                                    :

                                                                    "否"
                                                            }

                                                        </span>

                                                    </div>


                                                    <div
                                                        className=
                                                            "docker-actions"
                                                    >

                                                        <button

                                                            onClick={() =>
                                                                removeNetwork(
                                                                    network.id,
                                                                    network.name
                                                                )
                                                            }

                                                            disabled={

                                                                network.name ===
                                                                "bridge" ||

                                                                network.name ===
                                                                "host" ||

                                                                network.name ===
                                                                "none"

                                                            }

                                                        >

                                                            删除

                                                        </button>

                                                    </div>

                                                </div>

                                            )

                                        )

                                }

                            </div>
                        }


                        {
                            /*
                            ====================================
                            Compose
                            ====================================
                            */

                            tab ===
                            "Compose"

                            &&

                            <div
                                className=
                                    "docker-list"
                            >

                                {
                                    composeLoading

                                    ?

                                    <div
                                        className=
                                            "empty-tab"
                                    >

                                        正在加载 Compose……

                                    </div>

                                    :

                                    composes.length ===
                                    0

                                        ?

                                        <div
                                            className=
                                                "empty-tab"
                                        >

                                            没有 Compose 项目

                                        </div>

                                        :

                                        composes.map(

                                            compose => (

                                                <div

                                                    className=
                                                        "docker-card"

                                                    key={
                                                        compose.name
                                                    }

                                                >

                                                    <div
                                                        className=
                                                            "docker-header"
                                                    >

                                                        <Icon
                                                            fafa=
                                                                "faFileCode"
                                                        />

                                                        <strong>

                                                            {
                                                                compose.name ||
                                                                "-"
                                                            }

                                                        </strong>

                                                    </div>


                                                    <div>

                                                        文件：

                                                        {" "}

                                                        <code>

                                                            {
                                                                compose.path ||
                                                                "-"
                                                            }

                                                        </code>

                                                    </div>


                                                    <div
                                                        className=
                                                            "docker-actions"
                                                    >

                                                        <button
                                                            onClick={() =>
                                                                composeAction(
                                                                    compose.name,
                                                                    "up"
                                                                )
                                                            }
                                                        >

                                                            启动

                                                        </button>


                                                        <button
                                                            onClick={() =>
                                                                composeAction(
                                                                    compose.name,
                                                                    "down"
                                                                )
                                                            }
                                                        >

                                                            停止

                                                        </button>


                                                        <button
                                                            onClick={() =>
                                                                composeAction(
                                                                    compose.name,
                                                                    "restart"
                                                                )
                                                            }
                                                        >

                                                            重启

                                                        </button>


                                                        <button
                                                            onClick={() =>
                                                                showComposeLogs(
                                                                    compose.name
                                                                )
                                                            }
                                                        >

                                                            日志

                                                        </button>

                                                    </div>

                                                </div>

                                            )

                                        )

                                }

                            </div>
                        }

                    </main>

                </div>

            </div>


            {
                create

                &&

                <DockerCreate

                    close={() => {

                        setCreate(
                            false
                        );


                        loadContainers();

                    }}

                />

            }


            {
                composeLogs !== null

                &&

                <div

                    className=
                        "docker-compose-log-overlay"

                    onClick={() => {

                        setComposeLogs(
                            null
                        );

                        setComposeLogsName(
                            ""
                        );

                    }}

                >

                    <div

                        className=
                            "docker-compose-log-window"

                        onClick={
                            event =>
                                event.stopPropagation()
                        }

                    >

                        <div
                            className=
                                "docker-compose-log-header"
                        >

                            <strong>

                                Compose 日志：

                                {" "}

                                {
                                    composeLogsName
                                }

                            </strong>


                            <button

                                onClick={() => {

                                    setComposeLogs(
                                        null
                                    );

                                    setComposeLogsName(
                                        ""
                                    );

                                }}

                            >

                                ×

                            </button>

                        </div>


                        <div
                            className=
                                "docker-compose-log-content"
                        >

                            {
                                composeLogsLoading

                                    ?

                                    "正在加载日志……"

                                    :

                                    composeLogs ||
                                    "暂无日志"
                            }

                        </div>

                    </div>

                </div>

            }

        </div>

    );

};


export default Docker;
