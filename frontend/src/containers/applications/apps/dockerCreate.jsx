import React, {
    useState
} from "react";


import "./assets/docker.scss";



const DockerCreate = ({
    close
})=>{


    const [image,setImage] =
    useState("");

    const [name,setName] =
    useState("");


    const [ports,setPorts] =
    useState("");

    const [command,setCommand] =
    useState("");


    const [env,setEnv] =
    useState("");


    const [tty,setTty] =
    useState(false);


    const [privileged,setPrivileged] =
    useState(false);


    const [devices,setDevices] =
    useState("");





    const create =
    async()=>{


        if(!image)
            return;



        await fetch(
            "/api/docker/container/create",
            {

                method:"POST",

                headers:{
                    "Content-Type":
                    "application/json"
                },


                credentials:"include",


                body:
                JSON.stringify({

                    image:image,

                    name:name,


                    ports:
                    ports
                    .split(",")
                    .filter(
                        x=>x.trim()
                    ),


                    command:command,


                    env:
                    env
                    .split("\n")
                    .filter(
                        x=>x.trim()
                    ),


                    tty:tty,


                    privileged:
                    privileged,


                    devices:
                    devices
                    .split("\n")
                    .filter(
                        x=>x.trim()
                    )

                })

            }
        );


        close();

    };





return (

<div className="docker-dialog">


<div className="dialog-box">


<h2>
Create Container
</h2>



<label>
Image
</label>

<input

placeholder="nginx:latest"

value={image}

onChange={
e=>setImage(
e.target.value
)
}

/>





<label>
Name
</label>

<input

placeholder="my-container"

value={name}

onChange={
e=>setName(
e.target.value
)
}

/>





<label>
Ports
</label>


<input

placeholder="8080:80,25565:25565"

value={ports}

onChange={
e=>setPorts(
e.target.value
)
}

/>






<label>
Command / Execute
</label>


<input

placeholder="/bin/bash"

value={command}

onChange={
e=>setCommand(
e.target.value
)
}

/>






<label>
Environment
</label>


<textarea

placeholder={
"KEY=value\nNODE_ENV=production"
}

value={env}

onChange={
e=>setEnv(
e.target.value
)
}

/>






<label>

<input

type="checkbox"

checked={tty}

onChange={
e=>setTty(
e.target.checked
)
}

/>

TTY

</label>






<label>

<input

type="checkbox"

checked={privileged}

onChange={
e=>setPrivileged(
e.target.checked
)
}

/>

Privileged

</label>







<label>
Devices
</label>


<textarea

placeholder={
"/dev/dri:/dev/dri\n/dev/kvm:/dev/kvm"
}

value={devices}

onChange={
e=>setDevices(
e.target.value
)
}

/>







<div className="dialog-buttons">


<button

onClick={
close
}

>

Cancel

</button>




<button

onClick={
create
}

>

Create

</button>



</div>



</div>


</div>

);


};



export default DockerCreate;
