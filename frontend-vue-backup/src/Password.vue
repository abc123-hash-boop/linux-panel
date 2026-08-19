<script setup>

import {
    ref
} from "vue"

import {
    useRouter
} from "vue-router"


const router = useRouter()


const oldPassword = ref("")

const newPassword = ref("")


const message = ref("")

const error = ref("")


const loading = ref(false)



async function changePassword(){


    if(loading.value)

        return




    message.value=""

    error.value=""




    if(!oldPassword.value || !newPassword.value){


        error.value =
        "请输入完整密码"


        return

    }




    loading.value=true



    try{


        let res =

        await fetch(

            "/api/user/password",

            {


                method:"POST",


                credentials:"include",



                headers:{


                    "Content-Type":

                    "application/json"


                },



                body:JSON.stringify({


                    old_password:

                    oldPassword.value,



                    new_password:

                    newPassword.value


                })


            }

        )





        let data =

        await res.json()





        if(res.ok){



            message.value =

            "密码修改成功，正在返回主页..."




            oldPassword.value=""


            newPassword.value=""




            setTimeout(()=>{


                router.push("/")


            },1000)




        }
        else{


            error.value =

            data.error ||

            "修改失败"



        }



    }
    catch(e){



        error.value =

        "服务器连接失败"



    }
    finally{


        loading.value=false


    }


}



</script>




<template>


<div class="page">



<div class="box">



<h1>
修改密码
</h1>




<form

@submit.prevent="changePassword"

>




<input


v-model="oldPassword"


type="password"


placeholder="旧密码"


autocomplete="current-password"



/>





<input


v-model="newPassword"


type="password"


placeholder="新密码"


autocomplete="new-password"



/>





<button


type="submit"


:disabled="loading"


>


{{

loading

?

"保存中..."

:

"保存"

}}


</button>




</form>





<p

class="success"

v-if="message"

>

{{message}}

</p>





<p

class="error"

v-if="error"

>

{{error}}

</p>




</div>


</div>


</template>





<style scoped>


.page{


height:100vh;


display:flex;


justify-content:center;


align-items:center;


background:#f5f7fa;


}




.box{


width:360px;


background:white;


padding:40px;


border-radius:16px;


box-shadow:

0 5px 20px rgba(0,0,0,.12);


}




h1{


text-align:center;


margin-bottom:30px;


color:#1e293b;


}





input{


width:100%;


box-sizing:border-box;


padding:14px;


margin-bottom:16px;


border:1px solid #ddd;


border-radius:8px;


font-size:16px;


}





input:focus{


outline:none;


border-color:#2563eb;


}





button{


width:100%;


padding:14px;


border:0;


border-radius:8px;


background:#2563eb;


color:white;


font-size:16px;


cursor:pointer;


}





button:hover{


background:#1d4ed8;


}





button:disabled{


opacity:.6;


cursor:not-allowed;


}





.success{


margin-top:15px;


text-align:center;


color:#16a34a;


}





.error{


margin-top:15px;


text-align:center;


color:#dc2626;


}


</style>
