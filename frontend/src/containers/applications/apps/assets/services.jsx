.services {

    width:100%;
    height:100%;
    padding:20px;

    color:var(--text-color);


}



.service-toolbar {

    display:flex;

    align-items:center;

    gap:12px;

    margin-bottom:16px;


    input {

        flex:1;

        height:36px;

        padding:0 14px;

        border-radius:8px;

        border:1px solid rgba(0,0,0,.12);

        background:
        rgba(255,255,255,.55);

        backdrop-filter:
        blur(15px);

        outline:none;

        font-size:14px;


        &:focus {

            border-color:#0078d4;

        }


    }



    button {


        height:36px;

        padding:
        0 16px;


        border:none;

        border-radius:8px;


        background:
        rgba(255,255,255,.6);


        cursor:pointer;


        transition:.15s;


        &:hover {

            background:
            rgba(255,255,255,.85);

        }


    }


}




.services table {


    width:100%;

    border-collapse:separate;

    border-spacing:0 8px;



}




.services thead {


    th {

        text-align:left;

        padding:
        8px 14px;

        font-size:13px;

        opacity:.7;

    }


}




.services tbody tr {


    background:
    rgba(255,255,255,.55);


    backdrop-filter:
    blur(18px);



    transition:.15s;



    &:hover {

        background:
        rgba(255,255,255,.75);

        transform:
        translateY(-1px);

    }


}



.services td {


    padding:
    14px;


    font-size:14px;



}



.services td:first-child {


    border-radius:
    10px 0 0 10px;


}



.services td:last-child {


    border-radius:
    0 10px 10px 0;


}




.services button {


    margin-right:8px;


    padding:
    5px 12px;


    border-radius:
    7px;


    border:none;


    cursor:pointer;


    background:
    rgba(255,255,255,.8);



    &:hover {

        background:
        white;

    }


}




.service-running {


    display:inline-flex;

    align-items:center;


    gap:5px;


    color:#107c10;


    font-weight:600;


}



.service-running::before {


    content:"";


    width:8px;

    height:8px;


    border-radius:50%;


    background:#16c60c;


}




.service-stop {


    display:inline-flex;

    align-items:center;


    gap:5px;


    color:#666;


}



.service-stop::before {


    content:"";


    width:8px;

    height:8px;


    border-radius:50%;


    background:#999;


}




.empty-tab {


    padding:30px;

    opacity:.7;

}
