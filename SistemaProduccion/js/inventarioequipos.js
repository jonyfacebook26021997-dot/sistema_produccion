import {
db,
collection,
addDoc,
getDocs,
doc,
updateDoc,
deleteDoc
} from "./firebase.js";

let idEditar = null;

//=========================
// FECHA Y HORA
//=========================
function now(){
    return new Date().toLocaleString();
}

//=========================
// NUMERO CONSECUTIVO
//=========================
async function consecutivo(){

    const snap = await getDocs(collection(db,"equipos"));

    let mayor = 0;

    snap.forEach(d=>{

        const n = Number(d.data().numero);

        if(!isNaN(n) && n>mayor){

            mayor = n;

        }

    });

    return mayor + 1;

}

//=========================
// IMAGEN BASE64
//=========================
function base64(file){

    return new Promise((resolve,reject)=>{

        const reader = new FileReader();

        reader.readAsDataURL(file);

        reader.onload = ()=>resolve(reader.result);

        reader.onerror = reject;

    });

}

//=========================
// COLORES SEGÚN CATEGORÍA
//=========================
window.cargarColores = function(){

    const categoria = document.getElementById("categoria").value;

    const color = document.getElementById("color");

    color.innerHTML = "";

    let lista = [];

    switch(categoria){

        case "BACCIO ORIGINAL":
            lista=["PLATA","NEGRO"];
        break;

        case "ESPUMANTE BACCIO":
        case "ESPUMANTE BACCIO PICCOLO":
            lista=["BLANCO","NEGRO"];
        break;

        case "VASOS BACCIO":
            lista=["PLATA","VERDE","ROJO","NEGRO","AZUL"];
        break;

        default:
            lista=["N/A"];

    }

    lista.forEach(c=>{

        color.innerHTML += `<option>${c}</option>`;

    });

}
//=========================
// GUARDAR / EDITAR
//=========================
window.guardarEquipo = async function(){

    let archivo = document.getElementById("imagen").files[0];

    let imagen = "";

    if(archivo){

        imagen = await base64(archivo);

    }

    let numero = document.getElementById("numero").value;

    if(numero==""){

        numero = await consecutivo();

    }

    let data={

        numero:numero,

        fecha:document.getElementById("fecha").value,

        categoria:document.getElementById("categoria").value,

        color:document.getElementById("color").value,

        nombre:document.getElementById("nombre").value,

        marca:document.getElementById("marca").value,

        modelo:document.getElementById("modelo").value,

        serie:document.getElementById("serie").value,

        responsable:document.getElementById("responsable").value,

        cantidad: document.getElementById("cantidad").value,

        imagen:imagen

    };

    if(

        data.fecha=="" ||

        data.categoria=="" ||

        data.nombre=="" ||

        data.marca=="" ||

        data.modelo=="" ||

        data.serie==""

    ){

        alert("Complete todos los datos.");

        return;

    }

    if(idEditar==null){

        await addDoc(collection(db,"equipos"),data);

        await addDoc(collection(db,"historialEquipos"),{

            numero:data.numero,

            categoria:data.categoria,

            color:data.color,

            nombre:data.nombre,

            serie:data.serie,

            movimiento:"REGISTRO",

            fecha:now()

        });

        alert("Equipo registrado correctamente.");

    }else{

        let actualizar={

            numero:data.numero,

            fecha:data.fecha,

            categoria:data.categoria,

            color:data.color,

            nombre:data.nombre,

            marca:data.marca,

            modelo:data.modelo,

            serie:data.serie,

            responsable:data.responsable

        };

        if(imagen!=""){

            actualizar.imagen=imagen;

        }

        await updateDoc(doc(db,"equipos",idEditar),actualizar);

        await addDoc(collection(db,"historialEquipos"),{

            numero:data.numero,

            categoria:data.categoria,

            color:data.color,

            nombre:data.nombre,

            serie:data.serie,

            movimiento:"ACTUALIZACIÓN",

            fecha:now()

        });

        alert("Equipo actualizado correctamente.");

        idEditar=null;

    }

    limpiar();

    cargar();

    cargarHistorial();

}
//=========================
// CANTIDAD
//=========================
window.masCantidad = function(){

    let c = document.getElementById("cantidad");

    c.value = Number(c.value) + 1;

};

window.menosCantidad = function(){

    let c = document.getElementById("cantidad");

    if(Number(c.value) > 1){

        c.value = Number(c.value) - 1;

    }

};
//=========================
// CARGAR EQUIPOS
//=========================
window.cargar = async function(){

    let tbody = document.querySelector("#tablaEquipos tbody");

    tbody.innerHTML = "";

    const snap = await getDocs(collection(db,"equipos"));

    snap.forEach(d=>{

        let x = d.data();

        tbody.innerHTML += `

        <tr>

        <td>${x.numero}</td>

        <td>${x.fecha}</td>

        <td>${x.categoria}</td>

        <td>${x.color}</td>

        <td>${x.nombre}</td>

        <td>${x.marca}</td>

        <td>${x.modelo}</td>

        <td>${x.serie}</td>

        <td>${x.responsable}</td>

        <td>${x.cantidad || 1}</td>

        <td>

        ${
        x.imagen
        ?
        `<img src="${x.imagen}" width="60" style="cursor:pointer;border-radius:6px" onclick="verImg('${x.imagen}')">`
        :
        ""
        }

        </td>

        <td>

        <button onclick="editarEquipo('${d.id}')">✏️</button>

        <button onclick="eliminarEquipo('${d.id}')">🗑️</button>

        </td>

        </tr>

        `;

    });

}

//=========================
// EDITAR
//=========================
window.editarEquipo = async function(id){

    const snap = await getDocs(collection(db,"equipos"));

    snap.forEach(d=>{

        if(d.id===id){

            let x = d.data();

            document.getElementById("numero").value = x.numero;

            document.getElementById("fecha").value = x.fecha;

            document.getElementById("categoria").value = x.categoria;

            cargarColores();

            document.getElementById("color").value = x.color;

            document.getElementById("nombre").value = x.nombre;

            document.getElementById("marca").value = x.marca;

            document.getElementById("modelo").value = x.modelo;

            document.getElementById("serie").value = x.serie;

            document.getElementById("responsable").value = x.responsable;

            document.getElementById("cantidad").value = x.cantidad || 1;

            idEditar = id;

            window.scrollTo({

                top:0,

                behavior:"smooth"

            });

        }

    });

}

//=========================
// ELIMINAR
//=========================
window.eliminarEquipo = async function(id){

    if(!confirm("¿Desea eliminar este equipo?")){

        return;

    }

    await deleteDoc(doc(db,"equipos",id));

    cargar();

}

//=========================
// BUSCAR
//=========================
window.filtrar = async function(){

    let texto = document.getElementById("buscar").value.toLowerCase();

    let tbody = document.querySelector("#tablaEquipos tbody");

    tbody.innerHTML = "";

    const snap = await getDocs(collection(db,"equipos"));

    snap.forEach(d=>{

        let x = d.data();

        let buscar = (

            x.categoria+" "+

            x.color+" "+

            x.nombre+" "+

            x.marca+" "+

            x.modelo+" "+

            x.serie+" "+

            x.responsable

        ).toLowerCase();

        if(buscar.includes(texto)){

            tbody.innerHTML += `

            <tr>

            <td>${x.numero}</td>

            <td>${x.fecha}</td>

            <td>${x.categoria}</td>

            <td>${x.color}</td>

            <td>${x.nombre}</td>

            <td>${x.marca}</td>

            <td>${x.modelo}</td>

            <td>${x.serie}</td>

            <td>${x.responsable}</td>

            <td>

            ${
            x.imagen
            ?
            `<img src="${x.imagen}" width="60" style="cursor:pointer;border-radius:6px" onclick="verImg('${x.imagen}')">`
            :
            ""
            }

            </td>

            <td>

            <button onclick="editarEquipo('${d.id}')">✏️</button>

            <button onclick="eliminarEquipo('${d.id}')">🗑️</button>

            </td>

            </tr>

            `;

        }

    });

}

//=========================
// VER IMAGEN
//=========================
window.verImg = function(src){

    document.getElementById("modalImg").style.display="flex";

    document.getElementById("imgGrande").src=src;

}

window.cerrarImg = function(){

    document.getElementById("modalImg").style.display="none";

}
//=========================
// PDF INVENTARIO
//=========================
window.generarPDF = async function(){

    const texto = document.getElementById("buscar").value.toLowerCase();

    const { jsPDF } = window.jspdf;

    const pdf = new jsPDF();

    pdf.setFontSize(16);
    pdf.text("INVENTARIO DE EQUIPOS",20,20);

    let y=35;

    pdf.setFontSize(10);

    pdf.text("N°",10,y);
    pdf.text("Categoría",25,y);
    pdf.text("Equipo",75,y);
    pdf.text("Serie",140,y);
    pdf.text("Responsable",170,y);

    y+=8;

    const snap = await getDocs(collection(db,"equipos"));

    snap.forEach(d=>{

        const x=d.data();

        const buscar=(

            x.categoria+" "+
            x.color+" "+
            x.nombre+" "+
            x.marca+" "+
            x.modelo+" "+
            x.serie+" "+
            x.responsable

        ).toLowerCase();

        if(buscar.includes(texto)){

            if(y>270){

                pdf.addPage();

                y=20;

            }

            pdf.text(String(x.numero),10,y);

            pdf.text(x.categoria,25,y);

            pdf.text(x.nombre.substring(0,30),75,y);

            pdf.text(x.serie,140,y);

            pdf.text(x.responsable.substring(0,20),170,y);

            y+=8;

        }

    });

    pdf.save("Inventario_Equipos.pdf");

};

//=========================
// CARGAR HISTORIAL
//=========================
window.cargarHistorial = async function(){

    const tbody=document.querySelector("#tablaHistorial tbody");

    tbody.innerHTML="";

    const snap=await getDocs(collection(db,"historialEquipos"));

    snap.forEach(d=>{

        const x=d.data();

        tbody.innerHTML+=`

        <tr>

        <td>${x.fecha}</td>

        <td>${x.movimiento}</td>

        <td>${x.categoria}</td>

        <td>${x.nombre}</td>

        <td>${x.serie}</td>

        <td>

        <button onclick="eliminarHistorial('${d.id}')">

        🗑

        </button>

        </td>

        </tr>

        `;

    });

};

//=========================
// FILTRAR HISTORIAL
//=========================
window.filtrarHistorial = async function(){

    const categoria=document.getElementById("buscarHistorial").value;

    const tbody=document.querySelector("#tablaHistorial tbody");

    tbody.innerHTML="";

    const snap=await getDocs(collection(db,"historialEquipos"));

    snap.forEach(d=>{

        const x=d.data();

        if(categoria=="" || x.categoria==categoria){

            tbody.innerHTML+=`

            <tr>

            <td>${x.fecha}</td>

            <td>${x.movimiento}</td>

            <td>${x.categoria}</td>

            <td>${x.nombre}</td>

            <td>${x.serie}</td>

            <td>

            <button onclick="eliminarHistorial('${d.id}')">

            🗑

            </button>

            </td>

            </tr>

            `;

        }

    });

};

//=========================
// PDF HISTORIAL
//=========================
window.pdfHistorial = async function(){

    const categoria=document.getElementById("buscarHistorial").value;

    const {jsPDF}=window.jspdf;

    const pdf=new jsPDF();

    pdf.setFontSize(16);

    pdf.text("HISTORIAL DE EQUIPOS",20,20);

    let y=35;

    pdf.setFontSize(10);

    const snap=await getDocs(collection(db,"historialEquipos"));

    snap.forEach(d=>{

        const x=d.data();

        if(categoria=="" || x.categoria==categoria){

            if(y>270){

                pdf.addPage();

                y=20;

            }

            pdf.text(x.fecha,10,y);

            pdf.text(x.movimiento,60,y);

            pdf.text(x.nombre.substring(0,30),100,y);

            pdf.text(x.serie,165,y);

            y+=8;

        }

    });

    pdf.save("Historial_Equipos.pdf");

};

//=========================
// ELIMINAR HISTORIAL
//=========================
window.eliminarHistorial = async function(id){

    if(confirm("¿Desea eliminar este registro del historial?")){

        await deleteDoc(doc(db,"historialEquipos",id));

        cargarHistorial();

    }

};

//=========================
// LIMPIAR
//=========================
function limpiar(){

    document.getElementById("numero").value="";

    document.getElementById("fecha").value="";

    document.getElementById("categoria").value="";

    document.getElementById("color").innerHTML="<option>Seleccione una categoría</option>";

    document.getElementById("nombre").value="";

    document.getElementById("marca").value="";

    document.getElementById("modelo").value="";

    document.getElementById("serie").value="";

    document.getElementById("responsable").value="";

    document.getElementById("imagen").value="";

}

//=========================
// INICIO
//=========================
cargar();

cargarHistorial();