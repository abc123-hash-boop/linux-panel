<script setup>

import {
    ref,
    onMounted,
    onBeforeUnmount
} from "vue"

import {
    useRouter
} from "vue-router"

import * as echarts from "echarts"



const router = useRouter()

const showMenu = ref(false)

const system = ref({})


let ws = null

let chart = null

let reconnectTimer = null



const cpuData = ref([])

const timeData = ref([])





// 检查登录状态

async function checkLogin(){


    let res =
    await fetch(
        "/api/system/status"
    )


    if(res.status === 401){


        router.push("/login")


        return false

    }


    return true

}





// WebSocket连接

function connectWS(){



    const protocol =
        location.protocol === "https:"
        ? "wss://"
        : "ws://"



    ws =
    new WebSocket(
        protocol +
        location.host +
        "/ws/status"
    )





    ws.onmessage=function(event){


        let data =
        JSON.parse(event.data)



        system.value=data




        let now =
        new Date()
        .toLocaleTimeString()



        timeData.value.push(now)



        cpuData.value.push(
            data.cpu
        )



        if(timeData.value.length > 20){


            timeData.value.shift()

            cpuData.value.shift()


        }



        updateChart()



    }





    ws.onclose=function(){



        console.log(
            "WebSocket断开"
        )



        reconnectTimer =
        setTimeout(()=>{


            connectWS()


        },3000)



    }





    ws.onerror=function(){


        ws.close()


    }


}





// 更新CPU图表

function updateChart(){


    if(!chart)
        return



    chart.setOption({


        xAxis:{


            data:
            timeData.value


        },


        series:[{

            data:
            cpuData.value

        }]


    })



}





onMounted(async ()=>{



    let ok =
    await checkLogin()



    if(!ok)
        return





    chart =
    echarts.init(
        document.getElementById("cpuChart")
    )





    chart.setOption({


        title:{

            text:"CPU实时监控"

        },



        xAxis:{


            type:"category",

            data:[]

        },



        yAxis:{


            type:"value",

            max:100


        },



        series:[{


            type:"line",

            smooth:true,

            data:[]


        }]


    })




    connectWS()



})



async function logout(){


    await fetch(
        "/api/logout",
        {

            method:"POST",

            credentials:"include"

        }
    )


    router.push("/login")

}



onBeforeUnmount(()=>{



    if(reconnectTimer){


        clearTimeout(
            reconnectTimer
        )

    }



    if(ws){


        ws.close()


    }



    if(chart){


        chart.dispose()


    }



})



</script>





<template>


<div class="panel">



<div class="header">


<h1>
Linux Panel
</h1>



<div class="user">


<button
@click="showMenu=!showMenu"
class="user-btn"
>

admin ▼

</button>



<div
v-if="showMenu"
class="menu"
>


<div
@click="router.push('/password')"
>

修改密码

</div>



<div
@click="logout"
>

退出登录

</div>



</div>



</div>



</div>




<div class="cards">



<div class="card">

<h3>
CPU
</h3>


<div class="value">

{{system.cpu?.toFixed(1)}}%

</div>


</div>





<div class="card">


<h3>
Memory
</h3>


<div class="value">

{{system.memory?.toFixed(1)}}%

</div>


</div>





<div class="card">


<h3>
Disk
</h3>


<div class="value">

{{system.disk?.toFixed(1)}}%

</div>


</div>



</div>








<div class="info">


<h2>
系统信息
</h2>



<p>
主机:
{{system.hostname}}
</p>



<p>
CPU:
{{system.cpu_model}}
</p>



<p>
核心:
{{system.cpu_cores}}
核 /
{{system.cpu_threads}}
线程
</p>



<p>
Kernel:
{{system.kernel}}
</p>



<p>
系统:
{{system.os}}
</p>



<p>
运行时间:
{{system.uptime_text}}
</p>



<p>
Load:

{{system.load1}}
/

{{system.load5}}
/

{{system.load15}}

</p>



</div>







<div class="network">


<h2>
网络
</h2>



<p>

↓ 下载:

{{((system.network?.rx || 0)/1024/1024).toFixed(2)}}

MB/s

</p>



<p>

↑ 上传:

{{((system.network?.tx || 0)/1024/1024).toFixed(2)}}

MB/s

</p>



</div>








<div
id="cpuChart"
class="chart">
</div>





</div>


</template>







<style scoped>


.panel{

padding:30px;

font-family:

Arial,
sans-serif;

background:#f5f7fa;

min-height:100vh;

}





.cards{


display:flex;

gap:20px;

margin-top:20px;


}






.card{


background:white;

padding:20px;

border-radius:12px;

width:220px;


box-shadow:

0 3px 10px rgba(0,0,0,.08);


}





.card h3{


margin:0;

color:#666;


}




.value{


font-size:36px;

font-weight:bold;

margin-top:15px;


}





.info,
.network{


background:white;

margin-top:25px;

padding:20px;

border-radius:12px;


box-shadow:

0 3px 10px rgba(0,0,0,.08);


}





.info p,
.network p{


font-size:16px;

line-height:1.8;


}






.chart{


margin-top:30px;

background:white;

border-radius:12px;

padding:20px;


width:800px;

height:400px;


box-shadow:

0 3px 10px rgba(0,0,0,.08);


}

.header{

    display:flex;

    justify-content:space-between;

    align-items:center;

    margin-bottom:20px;

}



/* 用户区域 */

.user{

    position:relative;

}



/* 用户按钮 */

.user-btn{


    background:white;

    border:none;

    padding:10px 18px;


    border-radius:8px;


    cursor:pointer;


    font-size:15px;


    box-shadow:

    0 3px 10px rgba(0,0,0,.08);


}



.user-btn:hover{


    background:#f1f5f9;


}



/* 下拉菜单 */

.menu{


    position:absolute;


    right:0;


    top:45px;


    width:160px;


    background:white;


    border-radius:10px;


    overflow:hidden;


    box-shadow:

    0 5px 20px rgba(0,0,0,.15);


    z-index:100;


}





/* 菜单项目 */

.menu div{


    padding:12px 16px;


    cursor:pointer;


    font-size:15px;


}




.menu div:hover{


    background:#f1f5f9;


}

</style>
