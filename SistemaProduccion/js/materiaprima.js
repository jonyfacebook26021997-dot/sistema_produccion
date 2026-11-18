import {
    db,
    collection,
    addDoc,
    getDocs,
    doc,
    deleteDoc,
    updateDoc
} from "./firebase.js";

let idEditar = null;
let registrosMateriaPrima = [];
let textoFiltroMateria = "";

//=========================
// CONFIGURACIÓN DE BÚSQUEDA SIMPLE (ESTILO EMPAQUE)
//=========================
function vincularEventosBusquedaMateria() {
    let inputBusqueda = document.getElementById("buscarConsecutivo");
    
    if (inputBusqueda && !inputBusqueda.dataset.escuchando) {
        inputBusqueda.dataset.escuchando = "true";
        inputBusqueda.placeholder = "Escribe para buscar...";
        inputBusqueda.addEventListener("input", function(e) {
            textoFiltroMateria = e.target.value.toLowerCase().trim();
            renderizarTablaMateria();
        });
    }
}

//=========================
// GUARDAR NUEVO REGISTRO DESDE EL FORMULARIO SUPERIOR
//=========================
window.guardarRegistro = async function() {
    if (idEditar !== null) {
        alert("Por favor, termine de editar la fila activa en la tabla o cancele los cambios.");
        return;
    }

    let fechaHora = document.getElementById("fechaHora").value;
    let numeroRecepcion = document.getElementById("numeroRecepcion").value.trim();
    let proveedor = document.getElementById("proveedor").value.trim();
    let material = document.getElementById("material").value.trim();
    let loteProveedor = document.getElementById("loteProveedor").value;
    let loteProveedorTexto = document.getElementById("loteProveedorTexto").value.trim();
    let loteInterno = document.getElementById("loteInterno").value.trim();
    let cantidad = Number(document.getElementById("cantidad").value) || 0;
    let pesoTotal = Number(document.getElementById("pesoTotal").value) || 0;
    let condTransporte = document.getElementById("condTransporte").value;
    let condMaterial = document.getElementById("condMaterial").value;
    let observaciones = document.getElementById("observaciones").value.trim();
    let entregadoPor = document.getElementById("entregadoPor").value.trim();
    let recibidoPor = document.getElementById("recibidoPor").value.trim();

    if (!fechaHora || !numeroRecepcion || !proveedor || !material || !loteInterno || cantidad <= 0 || pesoTotal <= 0) {
        alert("Por favor, complete todos los campos obligatorios.");
        return;
    }

    let data = {
        fechaHora,
        numeroRecepcion,
        proveedor,
        material,
        loteProveedor,
        loteProveedorTexto: loteProveedor === "SI" ? loteProveedorTexto : "N/A",
        loteInterno,
        cantidad,
        pesoTotal,
        pesoDisponible: pesoTotal,
        condTransporte,
        condMaterial,
        observaciones,
        entregadoPor,
        recibidoPor
    };

    try {
        await addDoc(collection(db, "materiaPrima"), data);
        alert("✅ Registro guardado con éxito.");
        limpiarFormulario();
        cargarDatos();
    } catch (e) {
        console.error("Error al guardar: ", e);
        alert("Error al guardar el registro.");
    }
};

//=========================
// CARGAR DATOS DESDE FIREBASE
//=========================
window.cargarDatos = async function() {
    vincularEventosBusquedaMateria();

    // Limpiamos los filtros secundarios si se presiona mostrar todos
    let inputBusqueda = document.getElementById("buscarConsecutivo");
    if (inputBusqueda) inputBusqueda.value = "";
    textoFiltroMateria = "";

    try {
        const querySnapshot = await getDocs(collection(db, "materiaPrima"));
        registrosMateriaPrima = [];

        querySnapshot.forEach((docu) => {
            registrosMateriaPrima.push({ id: docu.id, ...docu.data() });
        });

        // 🔥 ORDENACIÓN: Consecutivo más actual (mayor) primero
        registrosMateriaPrima.sort((a, b) => {
            let nA = a.numeroRecepcion || "";
            let nB = b.numeroRecepcion || "";
            return nB.localeCompare(nA, undefined, { numeric: true, sensitivity: 'base' });
        });

        renderizarTablaMateria();

    } catch (e) {
        console.error("Error al cargar datos: ", e);
    }
};

//=========================
// RENDERIZAR TABLA CON FILTRO SIMPLIFICADO
//=========================
function renderizarTablaMateria() {
    let tabla = document.getElementById("tbodyMateria");
    if (!tabla) return;
    tabla.innerHTML = "";

    let registrosFiltrados = registrosMateriaPrima.filter(d => {
        if (!textoFiltroMateria) return true;

        let consecutivo = (d.numeroRecepcion || "").toLowerCase();
        let proveedor = (d.proveedor || "").toLowerCase();
        let material = (d.material || "").toLowerCase();
        let loteInt = (d.loteInterno || "").toLowerCase();
        let fecha = (d.fechaHora || "").toLowerCase();

        let textoCompleto = `${consecutivo} ${proveedor} ${material} ${loteInt} ${fecha}`;
        let palabras = textoFiltroMateria.split(" ");
        return palabras.every(palabra => textoCompleto.includes(palabra));
    });

    if (registrosFiltrados.length === 0) {
        tabla.innerHTML = `<tr><td colspan="11" style="text-align: center; color: #888; padding: 15px;">No se encontraron registros coincidentes.</td></tr>`;
        let totalElem = document.getElementById("totalRegistros");
        if (totalElem) totalElem.innerText = `Total registros: 0`;
        return;
    }

    let total = 0;

    registrosFiltrados.forEach((d) => {
        let id = d.id;
        total++;

        let disponible = d.pesoDisponible ?? d.pesoTotal;
        let disponibleFormateado = Number(disponible).toFixed(2);

        let badgeColor = disponible > 0 ? "#d1e7dd" : "#f8d7da";
        let textColor = disponible > 0 ? "#0f5132" : "#842029";
        let textoEstado = disponible > 0 ? `🟢 Stock: ${disponibleFormateado} kg` : `🔴 Agotado (0 kg)`;

        if (idEditar === id) {
            tabla.innerHTML += `
            <tr style="background-color: #fff3cd;">
                <td><input type="datetime-local" id="editFecha_${id}" value="${d.fechaHora || ''}" style="width:160px;"></td>
                <td><input type="text" id="editConsecutivo_${id}" value="${d.numeroRecepcion || ''}" style="width:100px;"></td>
                <td><input type="text" id="editProveedor_${id}" value="${d.proveedor || ''}" style="width:110px;"></td>
                <td><input type="text" id="editMaterial_${id}" value="${d.material || ''}" style="width:110px;"></td>
                <td>
                    <select id="editLoteProv_${id}" style="width:70px;">
                        <option value="N/A" ${d.loteProveedor === 'N/A' ? 'selected' : ''}>N/A</option>
                        <option value="SI" ${d.loteProveedor === 'SI' ? 'selected' : ''}>Sí</option>
                    </select>
                    <input type="text" id="editLoteProvTxt_${id}" value="${d.loteProveedorTexto || ''}" style="width:90px; margin-top:2px;" placeholder="Lote">
                </td>
                <td><input type="text" id="editLoteInt_${id}" value="${d.loteInterno || ''}" style="width:100px;"></td>
                <td><input type="number" id="editCantidad_${id}" value="${d.cantidad || 0}" style="width:70px;"></td>
                <td><input type="number" id="editPeso_${id}" value="${d.pesoTotal || 0}" style="width:70px;"></td>
                <td style="background-color: ${badgeColor}; color: ${textColor}; font-weight: bold;">
                    ${textoEstado} <br><small style="color:#6c757d;">No editable</small>
                </td>
                <td>
                    <button onclick="confirmarActualizacionMateria('${id}')" style="background-color:#198754; color:white; padding:4px 8px;">💾</button>
                    <button onclick="cancelarEdicionMateria()" style="background-color:#6c757d; color:white; padding:4px 8px;">❌</button>
                </td>
                <td>-</td>
            </tr>
            `;
        } else {
            tabla.innerHTML += `
            <tr>
                <td>${d.fechaHora ? d.fechaHora.replace("T", " ") : "-"}</td>
                <td>${d.numeroRecepcion || "-"}</td>
                <td>${d.proveedor || "-"}</td>
                <td>${d.material || "-"}</td>
                <td>${d.loteProveedor === "SI" ? d.loteProveedorTexto : "N/A"}</td>
                <td><strong style="color: #0d6efd;">${d.loteInterno || "-"}</strong></td>
                <td>${d.cantidad || 0} ud</td>
                <td>${d.pesoTotal || 0} kg</td>
                <td style="background-color: ${badgeColor}; color: ${textColor}; font-weight: bold;">
                    ${textoEstado}
                </td>
                <td>
                    <button onclick="activarEdicionMateria('${id}')">✏</button>
                    <button onclick="eliminarRegistro('${id}')">🗑</button>
                </td>
                <td>
                    <button onclick="generarPDFMateria('${d.fechaHora}', '${d.numeroRecepcion}', '${d.proveedor}', '${d.material}', '${d.loteInterno}', ${d.pesoTotal})">📄</button>
                </td>
            </tr>
            `;
        }
    });

    let totalRegElem = document.getElementById("totalRegistros");
    if (totalRegElem) totalRegElem.innerText = `Total registros: ${total}`;
}

// Mantener compatibilidad si el HTML llama a buscarHistorial
window.buscarHistorial = function() {
    let inputBusqueda = document.getElementById("buscarConsecutivo");
    if (inputBusqueda) {
        textoFiltroMateria = inputBusqueda.value.toLowerCase().trim();
        renderizarTablaMateria();
    }
};

//=========================
// CONTROLADORES DE EDICIÓN EN LÍNEA
//=========================
window.activarEdicionMateria = function(id) {
    idEditar = id;
    renderizarTablaMateria();
};

window.cancelarEdicionMateria = function() {
    idEditar = null;
    renderizarTablaMateria();
};

//=========================
// PROCESAR ACTUALIZACIÓN
//=========================
window.confirmarActualizacionMateria = async function(id) {
    let confirmar = confirm("¿Quieres actualizar este registro? (Sí / No)");
    if (!confirmar) return;

    let fechaHora = document.getElementById(`editFecha_${id}`).value;
    let numeroRecepcion = document.getElementById(`editConsecutivo_${id}`).value.trim();
    let proveedor = document.getElementById(`editProveedor_${id}`).value.trim();
    let material = document.getElementById(`editMaterial_${id}`).value.trim();
    let loteProveedor = document.getElementById(`editLoteProv_${id}`).value;
    let loteProveedorTexto = document.getElementById(`editLoteProvTxt_${id}`).value.trim();
    let loteInterno = document.getElementById(`editLoteInt_${id}`).value.trim();
    let cantidad = Number(document.getElementById(`editCantidad_${id}`).value) || 0;
    let pesoTotal = Number(document.getElementById(`editPeso_${id}`).value) || 0;

    if (!fechaHora || !numeroRecepcion || !proveedor || !material || !loteInterno || cantidad <= 0 || pesoTotal <= 0) {
        alert("Por favor complete todos los datos obligatorios de la fila.");
        return;
    }

    try {
        const docRef = doc(db, "materiaPrima", id);
        let regActual = registrosMateriaPrima.find(r => r.id === id);
        let pesoTotalViejo = regActual ? (regActual.pesoTotal || 0) : pesoTotal;
        let pesoDisponibleViejo = regActual ? (regActual.pesoDisponible ?? regActual.pesoTotal) : pesoTotal;

        let diferenciaPeso = pesoTotal - pesoTotalViejo;
        let nuevoPesoDisponible = Number((pesoDisponibleViejo + diferenciaPeso).toFixed(2));

        if (nuevoPesoDisponible < 0) {
            alert("❌ No puedes reducir tanto el peso total porque ya se ha consumido café de este lote.");
            return;
        }

        let dataActualizada = {
            fechaHora,
            numeroRecepcion,
            proveedor,
            material,
            loteProveedor,
            loteProveedorTexto: loteProveedor === "SI" ? loteProveedorTexto : "N/A",
            loteInterno,
            cantidad,
            pesoTotal,
            pesoDisponible: nuevoPesoDisponible
        };

        await updateDoc(docRef, dataActualizada);
        
        idEditar = null;
        alert("✅ Registro de materia prima actualizado.");
        cargarDatos();

    } catch (e) {
        console.error("Error al actualizar la línea: ", e);
        alert("Ocurrió un error al guardar los cambios.");
    }
};

//=========================
// ELIMINAR REGISTRO
//=========================
window.eliminarRegistro = async function(id) {
    if (!confirm("¿Está seguro de eliminar este lote de Materia Prima?")) return;

    try {
        await deleteDoc(doc(db, "materiaPrima", id));
        alert("✅ Registro eliminado de forma definitiva.");
        cargarDatos();
    } catch (e) {
        console.error(e);
        alert("Error al eliminar.");
    }
};

//=========================
// GENERADOR PDF
//=========================
window.generarPDFMateria = function(fecha, consecutivo, prov, mat, lote, peso) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text("REPORTE - RECEPCIÓN DE MATERIA PRIMA", 20, 20);
    doc.text("Consecutivo: " + consecutivo, 20, 35);
    doc.text("Fecha: " + fecha.replace("T", " "), 20, 45);
    doc.text("Proveedor: " + prov, 20, 55);
    doc.text("Material: " + mat, 20, 65);
    doc.text("Lote Interno: " + lote, 20, 75);
    doc.text("Peso Total: " + peso + " kg", 20, 85);
    doc.save("MateriaPrima_" + lote + ".pdf");
};

function limpiarFormulario() {
    document.getElementById("fechaHora").value = "";
    document.getElementById("numeroRecepcion").value = "";
    document.getElementById("proveedor").value = "";
    document.getElementById("material").value = "";
    document.getElementById("loteProveedor").value = "N/A";
    document.getElementById("loteProveedorTexto").value = "";
    document.getElementById("loteInterno").value = "";
    document.getElementById("cantidad").value = "";
    document.getElementById("pesoTotal").value = "";
    document.getElementById("observaciones").value = "";
    document.getElementById("entregadoPor").value = "";
    document.getElementById("recibidoPor").value = "";
    idEditar = null;
}

// Inicialización automática
cargarDatos();