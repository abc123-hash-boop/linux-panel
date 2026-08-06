<script setup>

import {
    ref,
    nextTick,
    onMounted
} from "vue"

import {
    useRouter
} from "vue-router"



const router = useRouter()


const username = ref("")

const password = ref("")


const error = ref("")

const loading = ref(false)


const usernameInput = ref(null)




async function login(){


    if(loading.value)
        return



    error.value=""



    if(!username.value || !password.value){

        error.value="请输入用户名和密码"

        return

    }



    loading.value=true



    try{


        let res =
        await fetch(
            "/api/login",
            {

                method:"POST",

                credentials:"include",

                headers:{

                    "Content-Type":
                    "application/json"

                },


                body:JSON.stringify({

                    username:
                    username.value,


                    password:
                    password.value

                })

            }
        )




        if(res.ok){


            router.push("/")


        }
        else{


            error.value="用户名或密码错误"


        }



    }
    catch(e){


        error.value="服务器连接失败"


    }
    finally{


        loading.value=false


    }


}





function enterLogin(e){


    if(e.key==="Enter"){

        login()

    }


}





onMounted(()=>{


    nextTick(()=>{

        usernameInput.value.focus()

    })


})



</script>




<template>


<div
class="login-page"
>


<div
class="login-box"
>


<div class="logo">

🐧

</div>



<h1>
Linux Panel
</h1>



<p class="subtitle">
服务器管理控制台
</p>




<form
@submit.prevent="login"
>



<input

ref="usernameInput"

v-model="username"

placeholder="用户名"

autocomplete="username"

/>





<input

v-model="password"

type="password"

placeholder="密码"

autocomplete="current-password"

@keyup="enterLogin"

/>





<div
class="error"
v-if="error"
>

{{error}}

</div>





<button
:disabled="loading"
>


{{

loading
?
"登录中..."
:
"登录"

}}



</button>



</form>



</div>



</div>


</template>





<style scoped>


.login-page{


height:100vh;

display:flex;

justify-content:center;

align-items:center;


background:

linear-gradient(
135deg,
#1e293b,
#334155
);


}





.login-box{


width:360px;

padding:40px;


background:white;


border-radius:18px;


box-shadow:

0 15px 40px
rgba(0,0,0,.25);


text-align:center;


}





.logo{


font-size:55px;

margin-bottom:10px;


}




h1{


margin:0;

font-size:30px;


}




.subtitle{


color:#888;

margin:10px 0 30px;


}





input{


width:100%;

box-sizing:border-box;


padding:14px;


margin-bottom:15px;


border-radius:8px;


border:1px solid #ddd;


font-size:16px;


}





input:focus{


outline:none;


border-color:#2563eb;


}





button{


width:100%;


padding:14px;


border:none;


border-radius:8px;


background:#2563eb;


color:white;


font-size:17px;


cursor:pointer;


}





button:hover{


background:#1d4ed8;


}





button:disabled{


opacity:.6;


cursor:not-allowed;


}





.error{


color:#ef4444;


margin-bottom:15px;


font-size:14px;


}



</style>
