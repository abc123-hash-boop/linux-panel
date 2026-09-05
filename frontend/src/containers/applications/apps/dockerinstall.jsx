import React, {
    useEffect,
    useState,
} from "react";


const DockerInstall = ({
    children
})=>{


const [
dockerReady,
setDockerReady
]=useState(null);



useEffect(()=>{


fetch(
    "/api/docker/check",
    {
        credentials:"include",
    }
)
.then(
    res=>res.json()
)
.then(
    data=>{


        setDockerReady(
            data.installed === true
        );


    }
)
.catch(
    err=>{


        console.error(
            "Docker check error:",
            err
        );


        setDockerReady(false);


    }
);


},[]);





if(
dockerReady===null
){

return (

<div className="docker-overlay">

检测 Docker 中...

</div>

);

}





if(
!dockerReady
){

return (

<div
className="docker-overlay docker-error"
>


<h2>
未安装 Docker
</h2>


<p>
未检测到 Docker 服务，请安装 Docker 后再试。
</p>


</div>

);

}





return children;


};


export default DockerInstall;
