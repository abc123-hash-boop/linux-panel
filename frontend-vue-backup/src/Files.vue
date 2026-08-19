<script setup>

import {
    ref,
    onMounted
} from "vue"



const path = ref("/")

const files = ref([])


const viewFile = ref(null)

const content = ref("")


const editing = ref(false)


const currentPath = ref("")


const showViewer = ref(false)




async function load(){


    let res = await fetch(

        "/api/files?path=" +

        encodeURIComponent(path.value),

        {

            credentials:"include"

        }

    )


    let data = await res.json()


    files.value = data.files


}





async function openView(file){


    let full =


    path.value.endsWith("/")


    ?


    path.value + file.name


    :


    path.value + "/" + file.name




    let res = await fetch(

        "/api/file/read?path=" +

        encodeURIComponent(full),

        {

            credentials:"include"

        }

    )



    let data = await res.json()



    if(data.content !== undefined){



        viewFile.value = file.name


        currentPath.value = full


        content.value = data.content


        editing.value = false


        showViewer.value = true


    }


}






function openFile(file){



    if(file.dir){



        if(path.value.endsWith("/")){


            path.value += file.name


        }

        else{


            path.value += "/" + file.name


        }


        load()



    }

    else{


        openView(file)


    }


}







function closeViewer(){


    showViewer.value=false


    viewFile.value=null


    content.value=""


    editing.value=false


}






async function saveFile(){



    let res = await fetch(

        "/api/file/write",

        {


            method:"POST",


            credentials:"include",


            headers:{


                "Content-Type":

                "application/json"


            },


            body:JSON.stringify({


                path:

                currentPath.value,



                content:

                content.value


            })


        }

    )



    let data = await res.json()




    if(res.ok){


        alert("保存成功")


        editing.value=false


    }

    else{


        alert(

            data.error ||

            "保存失败"

        )


    }



}






function back(){



    if(path.value === "/")

        return




    let arr =

    path.value.split("/")



    arr.pop()



    path.value =

    arr.join("/") || "/"



    load()



}






function sizeFormat(size){



    if(size < 1024)


        return size+" B"




    if(size < 1024*1024)


        return (

            size/1024

        ).toFixed(1)+" KB"




    if(size < 1024*1024*1024)


        return (

            size/1024/1024

        ).toFixed(1)+" MB"




    return (

        size/1024/1024/1024

    ).toFixed(1)+" GB"



}






onMounted(()=>{


    load()


})



</script>





<template>


<div class="files">



<div class="toolbar">


当前路径：

{{path}}



<button

@click="back"

>

返回

</button>



</div>







<table>


<thead>


<tr>

<th>
名称
</th>


<th>
类型
</th>


<th>
大小
</th>


<th>
权限
</th>


</tr>


</thead>




<tbody>



<tr

v-for="f in files"

:key="f.name"

@click="openFile(f)"

>


<td>


<span v-if="f.dir">

📁

</span>


<span v-else>

📄

</span>


{{f.name}}



</td>





<td>


{{

f.dir

?

"目录"

:

"文件"

}}



</td>





<td>


{{sizeFormat(f.size)}}


</td>





<td>


{{f.mode}}


</td>



</tr>



</tbody>


</table>







<!-- 文件查看弹窗 -->


<div

class="modal"

v-if="showViewer"

>



<div class="modal-box">





<div class="modal-header">


<h2>

{{viewFile}}

</h2>




<button

@click="closeViewer"

>

✕

</button>



</div>






<textarea

v-model="content"

:readonly="!editing"

></textarea>







<div class="actions">



<button

v-if="!editing"

@click="editing=true"

>

编辑

</button>




<button

v-if="editing"

@click="saveFile"

>

保存

</button>



</div>





</div>


</div>





</div>


</template>







<style scoped>


.files{


padding:30px;


}




.toolbar{


background:white;


padding:15px;


border-radius:10px;


margin-bottom:20px;


box-shadow:

0 3px 10px rgba(0,0,0,.08);


}




button{


margin-left:15px;


padding:8px 18px;


border:0;


border-radius:8px;


background:#2563eb;


color:white;


cursor:pointer;


}




table{


width:100%;


background:white;


border-collapse:collapse;


box-shadow:

0 3px 10px rgba(0,0,0,.08);


}





th{


background:#f1f5f9;


padding:14px;


text-align:left;


}




td{


padding:14px;


border-bottom:

1px solid #eee;


cursor:pointer;


}




tr:hover{


background:#f8fafc;


}






.modal{


position:fixed;


top:0;


left:0;


width:100%;


height:100%;


background:

rgba(0,0,0,.45);


display:flex;


justify-content:center;


align-items:center;


z-index:9999;


}






.modal-box{


width:80%;


height:80%;


background:white;


border-radius:15px;


padding:20px;


box-shadow:

0 10px 40px rgba(0,0,0,.3);


display:flex;


flex-direction:column;


}






.modal-header{


display:flex;


justify-content:space-between;


align-items:center;


margin-bottom:15px;


}





.modal-header button{


background:#ef4444;


margin:0;


font-size:18px;


}





.modal textarea{


flex:1;


width:100%;


resize:none;


font-family:monospace;


font-size:14px;


padding:15px;


box-sizing:border-box;


border:

1px solid #ddd;


border-radius:8px;


}





.actions{


margin-top:15px;


}



</style>
