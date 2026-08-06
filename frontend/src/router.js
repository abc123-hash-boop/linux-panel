import {
createRouter,
createWebHistory
} from "vue-router"


import Login from "./Login.vue"
import Password from "./Password.vue"
import Dashboard from "./Dashboard.vue"
import Files from "./Files.vue"
import Terminal from "./Terminal.vue"


export default createRouter({

history:createWebHistory(),


routes:[


{
path:"/",
component:Dashboard
},


{
path:"/login",
component:Login
},

{
    path:"/password",
    component:Password
},


{
path:"/files",
component:Files
},


{
 path:"/terminal",
 component:Terminal
}


]

})
