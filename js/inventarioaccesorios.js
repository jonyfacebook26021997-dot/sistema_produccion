import {
    db,
    collection,
    addDoc,
    getDocs,
    doc,
    deleteDoc,
    updateDoc,
    query,       
    where        
} from "./firebase.js";

let idEditar = null;

// 🔥 BLOQUEO GLOBAL ANTI-DUPLICADO
window.guardando = false;

//=========================
// FECHA Y HORA ACTUAL
//=========================
function now() {
    return new Date().toLocaleString();
}

// =========================
// GENERAR CONSECUTIVO
// =========================
async function generarConsecutivo() {
    const snap = await getDocs(collection(db, "materiaPrima"));

    let numero = snap.size + 1;
    let consecutivo = "REC-" + String(numero).padStart(6, "0");
    let fecha = new Date();

    let loteInterno =
        "LI-" +
        fecha.getFullYear() +
        String(fecha.getMonth() + 1).padStart(2, "0") +
        String(fecha.getDate()).padStart(2, "0") +
        "-" +
        String(numero).padStart(3, "0");

    if (!document.getElementById("numeroRecepcion").value) {
        document.getElementById("numeroRecepcion").value = consecutivo;
    }

    if (!document.getElementById("loteInterno").value) {
        document.getElementById("loteInterno").value = loteInterno;
    }
}

// =========================
// GUARDAR REGISTRO PRINCIPAL
// =========================
window.guardarRegistro = async function () {
    if (window.guardando) return;
    window.guardando = true;

    let loteProv = document.getElementById("loteProveedor").value;
    if (loteProv === "SI") {
        loteProv = document.getElementById("loteProveedorTexto").value;
    }

    let data = {
        fechaHora: document.getElementById("fechaHora").value,
        numeroRecepcion: document.getElementById("numeroRecepcion").value.trim(),
        proveedor: document.getElementById("proveedor").value,
        material: document.getElementById("material").value,
        loteProveedor: loteProv,
        loteInterno: document.getElementById("loteInterno").value,
        cantidad: Number(document.getElementById("cantidad").value),
        pesoTotal: Number(document.getElementById("pesoTotal").value),
        pesoDisponible: Number(document.getElementById("pesoTotal").value), // Al inicio es igual al total
        condTransporte: document.getElementById("condTransporte").value,
        condMaterial: document.getElementById("condMaterial").value,
        observaciones: document.getElementById("observaciones").value,
        entregadoPor: document.getElementById("entregadoPor").value,
        recibidoPor: document.getElementById("recibidoPor").value
    };

    if (!data.fechaHora || !data.proveedor || !data.material || !data.numeroRecepcion) {
        alert("Complete campos obligatorios");
        window.guardando = false;
        return;
    }

    try {
        if (idEditar == null) {
            // Consulta Anti-duplicados
            const q = query(collection(db, "materiaPrima"), where("numeroRecepcion", "==", data.numeroRecepcion));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                alert(`⚠️ El número de consecutivo "${data.numeroRecepcion}" ya existe.`);
                window.guardando = false;
                return; 
            }

            await addDoc(collection(db, "materiaPrima"), data);

            // Registro inicial en historial
            await addDoc(collection(db, "historialMateriaPrima"), {
                loteInterno: data.loteInterno,
                material: data.material,
                movimiento: "INGRESO INICIAL",
                pesoCambio: data.pesoTotal,
                fecha: now()
            });

        } else {
            // Guardar edición preservando el peso disponible real calculado
            const snapDoc = await getDocs(collection(db, "materiaPrima"));
            let disponibleActual = data.pesoTotal;
            snapDoc.forEach((d) => {
                if(d.id === idEditar) disponibleActual = d.data().pesoDisponible ?? data.pesoTotal;
            });
            data.pesoDisponible = disponibleActual;

            await updateDoc(doc(db, "materiaPrima", idEditar), data);
            idEditar = null;
        }

        limpiar();
        document.getElementById("numeroRecepcion").value = "";
        document.getElementById("loteInterno").value = "";
        
        await generarConsecutivo();
        cargarDatos();
        cargarHistorial();

    } catch (error) {
        console.error("Error al guardar:", error);
    }
    window.guardando = false;
};

// =========================
// CARGAR DATOS TABLA PRINCIPAL
// =========================
async function cargarDatos() {
    let tabla = document.getElementById("tbodyMateria");
    tabla.innerHTML = "";

    let total = 0;
    const snap = await getDocs(collection(db, "materiaPrima"));

    snap.forEach((d) => {
        let data = d.data();
        total++;

        let disponible = data.pesoDisponible ?? data.pesoTotal;
        let badgeColor = disponible > 0 ? "#d1e7dd" : "#f8d7da";
        let textColor = disponible > 0 ? "#0f5132" : "#842029";
        let textoEstado = disponible > 0 ? `🟢 Disponible: ${disponible} kg` : `🔴 Agotado (0 kg)`;

        tabla.innerHTML += `
        <tr>
        <td>${data.fechaHora}</td>
        <td>${data.numeroRecepcion}</td>
        <td>${data.proveedor}</td>
        <td>${data.material}</td>
        <td>${data.loteProveedor}</td>
        <td>${data.loteInterno}</td>
        <td>${data.cantidad}</td>
        <td>${data.pesoTotal} kg</td>
        <td style="background-color: ${badgeColor}; color: ${textColor}; font-weight: bold;">
            ${textoEstado}
        </td>
        <td>
            <button onclick="editarRegistro('${d.id}')">✏</button>
            <button onclick="eliminarRegistro('${d.id}')">🗑</button>
            <button onclick="restarPeso('${d.id}', ${disponible}, ${data.pesoTotal})">➖</button>
            <button onclick="sumarPeso('${d.id}', ${disponible}, ${data.pesoTotal})">➕</button>
        </td>
        <td>
            <button onclick="pdfRegistro('${d.id}')">📄</button>
        </td>
        </tr>
        `;
    });
    document.getElementById("totalRegistros").innerHTML = "Total registros: " + total;
}

// =========================
// ACCIÓN: RESTAR (SALIDA)
// =========================
window.restarPeso = async function(id, disponibleActual, pesoTotalActual) {
    let pesoDescontar = Number(prompt("Ingrese los Kilos (kg) a descontar de este lote:"));
    if (isNaN(pesoDescontar) || pesoDescontar <= 0) return;

    if (pesoDescontar > disponibleActual) {
        alert("No hay suficiente stock disponible para realizar esta salida.");
        return;
    }

    const snap = await getDocs(collection(db, "materiaPrima"));
    snap.forEach(async (d) => {
        if (d.id === id) {
            let x = d.data();
            let nuevoDisponible = disponibleActual - pesoDescontar;
            let nuevoTotal = pesoTotalActual - pesoDescontar; // Resta proporcional

            await updateDoc(doc(db, "materiaPrima", id), {
                pesoDisponible: nuevoDisponible,
                pesoTotal: nuevoTotal
            });

            // Guardar Movimiento en Historial
            await addDoc(collection(db, "historialMateriaPrima"), {
                loteInterno: x.loteInterno,
                material: x.material,
                movimiento: "SALIDA MANUAL",
                pesoCambio: pesoDescontar,
                fecha: now()
            });

            cargarDatos();
            cargarHistorial();
        }
    });
};

// =========================
// ACCIÓN: SUMAR (INGRESO EXTRA)
// =========================
window.sumarPeso = async function(id, disponibleActual, pesoTotalActual) {
    let pesoAgregar = Number(prompt("Ingrese los Kilos (kg) a sumar a este lote:"));
    if (isNaN(pesoAgregar) || pesoAgregar <= 0) return;

    const snap = await getDocs(collection(db, "materiaPrima"));
    snap.forEach(async (d) => {
        if (d.id === id) {
            let x = d.data();
            let nuevoDisponible = disponibleActual + pesoAgregar;
            let nuevoTotal = pesoTotalActual + pesoAgregar;

            await updateDoc(doc(db, "materiaPrima", id), {
                pesoDisponible: nuevoDisponible,
                pesoTotal: nuevoTotal
            });

            // Guardar Movimiento en Historial
            await addDoc(collection(db, "historialMateriaPrima"), {
                loteInterno: x.loteInterno,
                material: x.material,
                movimiento: "INGRESO MANUAL",
                pesoCambio: pesoAgregar,
                fecha: now()
            });

            cargarDatos();
            cargarHistorial();
        }
    });
};

// =========================
// CARGAR HISTORIAL DE MOVIMIENTOS
// =========================
window.cargarHistorial = async function() {
    let tbody = document.querySelector("#tablaHistorial tbody");
    if (!tbody) return; // Validación por si no se encuentra en el HTML todavía
    tbody.innerHTML = "";

    const snap = await getDocs(collection(db, "historialMateriaPrima"));
    snap.forEach((d) => {
        let x = d.data();
        tbody.innerHTML += `
        <tr>
            <td>${x.fecha}</td>
            <td>${x.movimiento}</td>
            <td>${x.loteInterno}</td>
            <td>${x.material}</td>
            <td>${x.pesoCambio} kg</td>
            <td>
                <button onclick="eliminarHistorial('${d.id}')">🗑</button>
            </td>
        </tr>
        `;
    });
};

// =========================
// ELIMINAR REGISTRO DEL HISTORIAL
// =========================
window.eliminarHistorial = async function(id) {
    if (!confirm("¿Desea eliminar este movimiento del historial?")) return;
    await deleteDoc(doc(db, "historialMateriaPrima", id));
    alert("Movimiento eliminado del historial.");
    cargarHistorial();
};

// =========================
// ELIMINAR REGISTRO MATERIA PRIMA
// =========================
window.eliminarRegistro = async function (id) {
    if (!confirm("¿Está seguro de eliminar este registro?\n\nEsta acción no se puede deshacer.")) return;
    try {
        await deleteDoc(doc(db, "materiaPrima", id));
        alert("✅ Registro eliminado correctamente.");
        cargarDatos();
    } catch (error) {
        alert("❌ Error al eliminar.");
    }
};

// =========================
// BUSCAR HISTORIAL FILTRADO
// =========================
window.buscarHistorial = async function () {
    let desde = document.getElementById("buscarDesde").value;
    let hasta = document.getElementById("buscarHasta").value;
    let consecutivo = document.getElementById("buscarConsecutivo").value.toLowerCase().trim();
    let proveedor = document.getElementById("buscarProveedor").value.toLowerCase().trim();
    let material = document.getElementById("buscarMaterial").value.toLowerCase().trim();
    let lote = document.getElementById("buscarLote").value.toLowerCase().trim();

    let tabla = document.getElementById("tbodyMateria");
    tabla.innerHTML = "";

    let total = 0;
    const snap = await getDocs(collection(db, "materiaPrima"));

    snap.forEach((d) => {
        let data = d.data();
        let fecha = data.fechaHora.substring(0,10);
        let mostrar = true;

        if(desde !== "" && fecha < desde) mostrar = false;
        if(hasta !== "" && fecha > hasta) mostrar = false;
        if(consecutivo !== "" && !data.numeroRecepcion.toLowerCase().includes(consecutivo)) mostrar = false;
        if(proveedor !== "" && !data.proveedor.toLowerCase().includes(proveedor)) mostrar = false;
        if(material !== "" && !data.material.toLowerCase().includes(material)) mostrar = false;

        if(lote !== ""){
            let interno = (data.loteInterno || "").toLowerCase();
            let prov = (data.loteProveedor || "").toLowerCase();
            if(!interno.includes(lote) && !prov.includes(lote)) mostrar = false;
        }

        if(mostrar){
            total++;
            let disponible = data.pesoDisponible ?? data.pesoTotal;
            let badgeColor = disponible > 0 ? "#d1e7dd" : "#f8d7da";
            let textColor = disponible > 0 ? "#0f5132" : "#842029";
            let textoEstado = disponible > 0 ? `🟢 Disponible: ${disponible} kg` : `🔴 Agotado (0 kg)`;

            tabla.innerHTML += `
            <tr>
            <td>${data.fechaHora}</td>
            <td>${data.numeroRecepcion}</td>
            <td>${data.proveedor}</td>
            <td>${data.material}</td>
            <td>${data.loteProveedor}</td>
            <td>${data.loteInterno}</td>
            <td>${data.cantidad}</td>
            <td>${data.pesoTotal} kg</td>
            <td style="background-color: ${badgeColor}; color: ${textColor}; font-weight: bold;">
                ${textoEstado}
            </td>
            <td>
                <button onclick="editarRegistro('${d.id}')">✏</button>
                <button onclick="eliminarRegistro('${d.id}')">🗑</button>
                <button onclick="restarPeso('${d.id}', ${disponible}, ${data.pesoTotal})">➖</button>
                <button onclick="sumarPeso('${d.id}', ${disponible}, ${data.pesoTotal})">➕</button>
            </td>
            <td>
                <button onclick="pdfRegistro('${d.id}')">📄</button>
            </td>
            </tr>
            `;
        }
    });
    document.getElementById("totalRegistros").innerHTML = "Total registros: " + total;
};

// =========================
// EDITAR REGISTRO PRINCIPAL
// =========================
window.editarRegistro = async function (id) {
    const snap = await getDocs(collection(db, "materiaPrima"));
    snap.forEach((d) => {
        if (d.id === id) {
            let data = d.data();
            document.getElementById("fechaHora").value = data.fechaHora;
            document.getElementById("numeroRecepcion").value = data.numeroRecepcion;
            document.getElementById("proveedor").value = data.proveedor;
            document.getElementById("material").value = data.material;
            document.getElementById("loteInterno").value = data.loteInterno;
            document.getElementById("cantidad").value = data.cantidad;
            document.getElementById("pesoTotal").value = data.pesoTotal;
            document.getElementById("condTransporte").value = data.condTransporte;
            document.getElementById("condMaterial").value = data.condMaterial;
            document.getElementById("observaciones").value = data.observaciones;
            document.getElementById("entregadoPor").value = data.entregadoPor;
            document.getElementById("recibidoPor").value = data.recibidoPor;
            idEditar = id;
        }
    });
};

// =========================
// PDF INDIVIDUAL
// =========================
window.pdfRegistro = async function (id) {
    const snap = await getDocs(collection(db, "materiaPrima"));
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();

    snap.forEach((d) => {
        if (d.id === id) {
            let data = d.data();
            let disponible = data.pesoDisponible ?? data.pesoTotal;

            pdf.setFontSize(14);
            pdf.text("REPORTE MATERIA PRIMA", 20, 20);
            pdf.setFontSize(11);
            pdf.text("Fecha: " + data.fechaHora, 20, 35);
            pdf.text("Consecutivo: " + data.numeroRecepcion, 20, 45);
            pdf.text("Proveedor: " + data.proveedor, 20, 55);
            pdf.text("Material: " + data.material, 20, 65);
            pdf.text("Lote Interno: " + data.loteInterno, 20, 85);
            pdf.text("Stock Actual Disponible: " + disponible + " kg", 20, 113);

            pdf.save(data.numeroRecepcion + ".pdf");
        }
    });
};

function limpiar() {
    document.getElementById("fechaHora").value = "";
    document.getElementById("proveedor").value = "";
    document.getElementById("material").value = "";
    document.getElementById("loteProveedorTexto").value = "";
    document.getElementById("cantidad").value = "";
    document.getElementById("pesoTotal").value = "";
    document.getElementById("observaciones").value = "";
    document.getElementById("entregadoPor").value = "";
    document.getElementById("recibidoPor").value = "";
}

// Inicialización
generarConsecutivo();
cargarDatos();
cargarHistorial();