<script setup>

import {
    ref,
    onMounted,
    onBeforeUnmount
} from "vue"


import {
    Terminal
} from "xterm"


import {
    FitAddon
} from "xterm-addon-fit"


import "xterm/css/xterm.css"



const box = ref(null)


let ws=null


let term=null



onMounted(()=>{


    term=new Terminal({

        cursorBlink:true,

        fontSize:14,

        theme:{

            background:"#000000"

        }

    })



    const fit =
    new FitAddon()



    term.loadAddon(fit)



    term.open(box.value)


    fit.fit()





    ws=new WebSocket(

        "ws://"+location.host+"/ws/terminal"

    )





    ws.onmessage=(event)=>{


        term.write(

            event.data

        )


    }





    ws.onclose=()=>{


        term.write(

            "\r\n连接关闭"

        )


    }





    term.onData((data)=>{


        if(ws.readyState===1){


            ws.send(data)


        }


    })




})





onBeforeUnmount(()=>{


    if(ws)

        ws.close()



    if(term)

        term.dispose()



})



</script>



<template>


<div

class="terminal"

ref="box"

>


</div>


</template>



<style scoped>


.terminal{


height:700px;


width:100%;


background:#000;


padding:10px;


box-sizing:border-box;


border-radius:10px;


}


</style>
