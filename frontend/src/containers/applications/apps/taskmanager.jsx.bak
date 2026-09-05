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

apps.map((e)=>{
  appList.push(e.name);
});



const emptyStatus = {

  cpu:0,

  cpu_cores:0,

  cpu_threads:0,

  cpu_model:"",

  memory:0,

  disk:0,

  load1:0,

  load5:0,

  load15:0,

  network:{
    rx:0,
    tx:0,
  },

  hostname:"",

  kernel:"",

  os:"",

  uptime:0,

  uptime_text:"",

};




export const Taskmanager =()=>{


const wnapp =
useSelector(
(state)=>
state.apps.taskmanager
);



const [
tab,
setTab
]=useState(
"Processes"
);



const [
nav,
setNav
]=useState(
"open"
);



/*
==================================
系统状态
==================================
*/


const [
status,
setStatus
]=useState(
emptyStatus
);



const [
wsConnected,
setWsConnected
]=useState(false);



const wsRef =
useRef(null);



const reconnectTimerRef =
useRef(null);



const shouldReconnectRef =
useRef(true);



/*
==================================
服务管理
==================================
*/


const [
services,
setServices
]=useState([]);



const [
serviceSearch,
setServiceSearch
]=useState("");



/*
==================================
WebSocket
==================================
*/


useEffect(()=>{


shouldReconnectRef.current=true;



const connect=()=>{


if(
!shouldReconnectRef.current
)
return;



const protocol =
window.location.protocol==="https:"
?
"wss:"
:
"ws:";



const wsURL =
`${protocol}//${window.location.host}/ws/status`;



const ws =
new WebSocket(wsURL);



wsRef.current=ws;



ws.onopen=()=>{

setWsConnected(true);

};



ws.onmessage=(event)=>{


try{


const data =
JSON.parse(
event.data
);



setStatus(
old=>({

...old,

...data,


network:{

...(old.network||{}),

...(data.network||{}),

},


})
);



}catch(e){


console.error(
"status parse error",
e
);


}



};



ws.onerror=(e)=>{


console.error(
"websocket error",
e
);


};



ws.onclose=()=>{


setWsConnected(false);



if(
!shouldReconnectRef.current
)
return;



if(
reconnectTimerRef.current
)
return;



reconnectTimerRef.current =
setTimeout(()=>{


reconnectTimerRef.current=null;


connect();


},3000);



};



};



connect();



return ()=>{


shouldReconnectRef.current=false;



if(
reconnectTimerRef.current
)
{


clearTimeout(
reconnectTimerRef.current
);


reconnectTimerRef=null;


}



if(
wsRef.current
)
{


wsRef.current.close();


wsRef.current=null;


}


};


},[]);





/*
==================================
加载服务
==================================
*/


const loadServices=()=>{


fetch(
"/api/services",
{
credentials:"include",
}
)

.then(
res=>res.json()
)

.then(
data=>{


if(
Array.isArray(data)
)
{

setServices(data);

}


}
)

.catch(
err=>
console.error(
"service load error",
err
)
);



};



useEffect(()=>{


if(
tab==="Services"
)
{


loadServices();


}



},[tab]);





/*
==================================
服务操作
==================================
*/


const serviceAction=
(name,action)=>{


fetch(

`/api/service/${action}/${encodeURIComponent(name)}`,

{

method:"POST",

credentials:"include",

}

)

.then(()=>{


setTimeout(

loadServices,

500

);


});


};





/*
==================================
导航
==================================
*/


const tabNames=[


{
title:"进程",
key:"Processes",
icon:"faTableCellsLarge",
},


{
title:"性能",
key:"Performance",
icon:"faWaveSquare",
},


{
title:"应用历史",
key:"App history",
icon:"faClockRotateLeft",
},


{
title:"启动应用",
key:"Startup apps",
icon:"faGaugeHigh",
},


{
title:"用户",
key:"Users",
icon:"faUser",
},


{
title:"详细信息",
key:"Details",
icon:"faList",
},


{
title:"服务",
key:"Services",
icon:"faPuzzlePiece",
},


{
title:"设置",
key:"Settings",
icon:"faGear",
},


];



const powerUsage=[

"非常低",

"低",

"中等",

"高",

"非常高",

];



const formatNetwork=(value)=>{


const number =
Number(value)||0;



if(number<1024)

return `${number.toFixed(0)} B/s`;



if(number<1024*1024)

return `${(number/1024).toFixed(2)} KB/s`;



return `${(
number/
1024/
1024
).toFixed(2)} MB/s`;



};
/*
==================================
性能页面
==================================
*/


const Performance=()=>{


return (

<div className="performance">


<div className="performance-grid">



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



<div className="hardware-value">

{
Number(
status.cpu
).toFixed(1)
}%

</div>


</div>




<div className="usage-bar">


<div

className="usage-fill"

style={{

width:`${Math.min(
Math.max(
Number(status.cpu)||0,
0
),
100
)}%`

}}

/>


</div>




<div className="hardware-info">


<div className="hardware-info-row">

<span>
型号
</span>

<strong>
{
status.cpu_model||"-"
}
</strong>

</div>



<div className="hardware-info-row">

<span>
核心
</span>

<strong>
{
status.cpu_cores||0
}
</strong>

</div>



<div className="hardware-info-row">

<span>
线程
</span>

<strong>
{
status.cpu_threads||0
}
</strong>

</div>



<div className="hardware-info-row">

<span>
负载
</span>

<strong>

{
Number(
status.load1||0
).toFixed(2)
}

 /

{
Number(
status.load5||0
).toFixed(2)
}

 /

{
Number(
status.load15||0
).toFixed(2)
}

</strong>

</div>


</div>


</section>





<section className="hardware-card">


<div className="hardware-card-header">


<div className="hardware-title">

<Icon
fafa="faMemory"
width={18}
/>


<span>
内存
</span>


</div>


<div className="hardware-value">

{
Number(
status.memory
).toFixed(1)
}%

</div>


</div>



<div className="usage-bar">


<div

className="usage-fill"

style={{

width:`${Math.min(
Math.max(
Number(status.memory)||0,
0
),
100
)}%`

}}

/>


</div>


</section>





<section className="hardware-card">


<div className="hardware-card-header">


<div className="hardware-title">


<Icon
fafa="faHardDrive"
width={18}
/>


<span>
磁盘
</span>


</div>



<div className="hardware-value">


{
Number(
status.disk
).toFixed(1)
}%


</div>


</div>



<div className="usage-bar">


<div

className="usage-fill"

style={{

width:`${Math.min(
Math.max(
Number(status.disk)||0,
0
),
100
)}%`

}}

/>


</div>


</section>





<section className="hardware-card">


<div className="hardware-card-header">


<div className="hardware-title">


<Icon
fafa="faNetworkWired"
width={18}
/>


<span>
网络
</span>


</div>


</div>



<div className="network-stats">


<div className="network-item">


<span>
↓ 接收
</span>


<strong>

{
formatNetwork(
status.network?.rx
)
}

</strong>


</div>



<div className="network-item">


<span>
↑ 发送
</span>


<strong>

{
formatNetwork(
status.network?.tx
)
}

</strong>


</div>


</div>


</section>



</div>




<div className="status-indicator">


<span

className={
wsConnected
?
"status-dot connected"
:
"status-dot"
}

/>


<span>

{
wsConnected
?
"已连接"
:
"重新连接中..."
}

</span>


</div>


</div>


);


};







/*
==================================
服务管理页面
==================================
*/


const Services=()=>{


const list =

services.filter(
item=>{


if(
item.name
.includes(
"systemd"
)
)
return false;


if(
item.name
.includes(
"initrd"
)
)
return false;


if(
item.name
.includes(
"modprobe"
)
)
return false;



return item.name
.toLowerCase()
.includes(
serviceSearch.toLowerCase()
);



}
);



return (


<div className="services">


<div className="service-toolbar">


<input

value={
serviceSearch
}

onChange={
e=>
setServiceSearch(
e.target.value
)
}

placeholder="搜索服务"

/>


<button

onClick={
loadServices
}

>

刷新

</button>


</div>





<table>


<thead>

<tr>


<th>
服务名称
</th>


<th>
状态
</th>


<th>
启动类型
</th>


<th>
操作
</th>


</tr>


</thead>



<tbody>


{

list.map(
(service,index)=>(


<tr key={index}>


<td>

{
service.name
}

</td>



<td>


<span

className={
service.status==="running"
?
"service-running"
:
"service-stop"
}

>


{
service.status==="running"
?
"运行中"
:
service.status==="exited"
?
"已退出"
:
"停止"
}


</span>


</td>




<td>

{
service.enabled
}

</td>




<td>


<button

onClick={()=>serviceAction(
service.name,
"start"
)}

>

启动

</button>



<button

onClick={()=>serviceAction(
service.name,
"stop"
)}

>

停止

</button>



<button

onClick={()=>serviceAction(
service.name,
"restart"
)}

>

重启

</button>


</td>



</tr>


)

)

}



</tbody>


</table>



</div>


);


};
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

...(wnapp.size==="cstm"
?
wnapp.dim
:
null
),

zIndex:
wnapp.z,

}}


data-hide={
wnapp.hide
}


id={
wnapp.icon+
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


name="任务管理器"

/>




<div

className="windowScreen flex flex-col"

data-dock="true"

>


<div

className="restWindow flex-grow flex flex-col"

>



<nav

className={nav}

>



{

tabNames.map(
(item,index)=>(


<div

key={index}

className={

`navLink ${
item.key===tab
?
"selected"
:
""
}`

}


onClick={()=>{

setTab(
item.key
);

}}


>


<Icon

className="mx-2"

fafa={
item.icon
}

/>



<span

className="tabName"

>


{
item.title
}


</span>



</div>


)

)

}




<div

className="marker"

/>


</nav>





<main

className="win11Scroll"

>


<h3>

{

tabNames.find(
e=>
e.key===tab
)?.title

}

</h3>





{

(()=>{


switch(tab){



case "Processes":


return (

<div className="Processes">


<table>


<thead>


<tr>

<th>
名称
</th>

<th>
CPU
</th>

<th>
内存
</th>

<th>
磁盘
</th>

<th>
网络
</th>

<th>
GPU
</th>

<th>
功耗
</th>


</tr>


</thead>



<tbody>


{

appList.map(
(item,index)=>(


<tr

key={index}

>


<td className="name">

{
item
}

</td>



<td>

{
(
Math.random()*10
).toFixed(2)
}%

</td>



<td>

{
(
Math.random()*100
).toFixed(2)
}
MB

</td>



<td>

{
(
Math.random()*50
).toFixed(2)
}
MB/s

</td>



<td>

{
(
Math.random()*50
).toFixed(2)
}
MBps

</td>



<td>

{
(
Math.random()*10
).toFixed(2)
}%

</td>



<td>

{

powerUsage[
Math.floor(
Math.random()*
powerUsage.length
)
]

}

</td>



</tr>


)

)


}



</tbody>



</table>


</div>


);



case "Performance":


return (

<Performance/>

);



case "Services":


return (

<Services/>

);



default:


return (

<div className="empty-tab">

该功能正在开发

</div>

);


}



})()

}




</main>






<div

className="navMenuBtn"


onClick={()=>{

setNav(
nav
?
""
:
"open"
);

}}


>


<svg

xmlns="http://www.w3.org/2000/svg"

fill="currentColor"

viewBox="0 0 48 48"

width="24"

height="24"

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
