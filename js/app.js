import {
db,
collection,
addDoc,
getDocs
} from "./firebase.js";

window.guardarProduccion = async function () {

    let fecha = document.getElementById("fecha").value;
    let producto = document.getElementById("producto").value;
    let cantidad = document.getElementById("cantidad").value;

    if (fecha == "" || producto == "" || cantidad == "") {

        alert("Complete todos los campos");
        return;

    }

    await addDoc(collection(db, "produccion"), {

        fecha,
        producto,
        cantidad: Number(cantidad)

    });

    alert("Producción guardada");

    document.getElementById("fecha").value = "";
    document.getElementById("producto").value = "";
    document.getElementById("cantidad").value = "";

    cargarProduccion();

}

async function cargarProduccion() {

    const tabla = document.querySelector("#tablaProduccion tbody");

    tabla.innerHTML = "";

    const datos = await getDocs(collection(db, "produccion"));

    datos.forEach((doc) => {

        let fila = `

        <tr>

        <td>${doc.data().fecha}</td>

        <td>${doc.data().producto}</td>

        <td>${doc.data().cantidad}</td>

        </tr>

        `;

        tabla.innerHTML += fila;

    });

}

cargarProduccion();