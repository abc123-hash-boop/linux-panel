<script setup>

import {
    useRouter
} from "vue-router"


const router = useRouter()



function logout(){


    fetch(
        "/api/logout",
        {

            method:"POST",

            credentials:"include"

        }

    )


    router.push("/login")


}


</script>



<template>


<div class="layout">


<!-- 左侧菜单 -->

<div class="sidebar">


<h2>
🐧 Linux Panel
</h2>



<div
class="menu"

@click="router.push('/')"

>

📊 运行状态

</div>




<div
class="menu"

@click="router.push('/files')"

>

📁 文件管理

</div>


<div
class="menu"

@click="router.push('/terminal')"

>

🖥️ 终端

</div>


<div
class="menu"

@click="router.push('/password')"

>

🔑 修改密码

</div>




<div
class="menu logout"

@click="logout"

>

🚪 退出登录

</div>



</div>





<!-- 内容区域 -->


<div class="content">


<router-view />


</div>



</div>


</template>




<style scoped>


.layout{


display:flex;


height:100vh;


background:#f5f7fa;


}





.sidebar{


width:230px;


background:#1e293b;


color:white;


padding:25px 15px;


box-sizing:border-box;


}





.sidebar h2{


text-align:center;


margin-bottom:30px;


}





.menu{


padding:15px;


margin-bottom:10px;


border-radius:8px;


cursor:pointer;


font-size:16px;


}



.menu:hover{


background:#334155;


}





.logout{


margin-top:30px;


color:#fca5a5;


}





.content{


flex:1;


overflow:auto;


}


</style>
