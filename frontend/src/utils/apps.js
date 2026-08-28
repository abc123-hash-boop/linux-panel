export const gene_name = () =>
Math.random().toString(36).substring(2,10).toUpperCase();


let installed =
JSON.parse(
localStorage.getItem("installed") || "[]"
);


const apps=[


{
name:"Store",
icon:"store",
type:"app",
action:"WNSTORE",
},

{
name:"菜单",
icon:"home",
type:"action",
action:"STARTMENU",
},

{
name:"Task Manager",
icon:"taskmanager",
type:"app",
action:"TASKMANAGER",
},

{
name:"File Explorer",
icon:"explorer",
type:"app",
action:"EXPLORER",
},


{
name:"Docker",
icon:"docker",
type:"app",
action:"DOCKER",
},
{
name:"Terminal",
icon:"terminal",
type:"app",
action:"TERMINAL",
},

{
name:"Calculator",
icon:"calculator",
type:"app",
action:"CALCUAPP",
},

{
name:"Whiteboard",
icon:"board",
type:"app",
action:"WHITEBOARD",
},

];



for (let i = 0; i < installed.length; i++) {

    apps.push(installed[i]);

}



export default apps;
