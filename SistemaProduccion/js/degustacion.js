import {
    db,
    collection,
    getDocs,
    addDoc,
    doc,
    deleteDoc,
    updateDoc
} from "./firebase.js";

let idEditar = null;
let capsulasDisponiblesLote = 0; 
let loteSeleccionado = null;

let listaProducciones = [];
let mapaProduccion = {};
let mapaLotesPT = {}; 
let registrosDegustacion = []; 
let textoFiltro = "";

//=========================
// CARGAR LOTES Y DISPONIBILIDAD
//=========================
async function cargarLotes() {
    let select = document.getElementById("lote");
    if (!select) return;
    select.innerHTML = "<option value=''>Seleccione lote...</option>";

    try {
        const [queryProduccion, queryCalidad, queryEmpaque, queryDegustacion] = await Promise.all([
            getDocs(collection(db, "produccion")),
            getDocs(collection(db, "calidad")),
            getDocs(collection(db, "empaque")),
            getDocs(collection(db, "degustacion"))
        ]);

        let mapaCalidadPorId = {};
        mapaLotesPT = {};

        // 1. Obtener aprobados y Lotes PT desde Calidad
        queryCalidad.forEach((docu) => {
            let d = docu.data();
            let lotePTVal = d.lotePT || d.loteProductoTerminado || "";

            if (d.loteId) {
                mapaCalidadPorId[d.loteId] = Number(d.total) || 0;
                if (lotePTVal) mapaLotesPT[d.loteId] = lotePTVal;
            }
            if (d.loteNumero && lotePTVal) {
                mapaLotesPT[d.loteNumero] = lotePTVal;
            }
        });

        // 2. Sumar consumo de empaques
        let capsulasGastadasPorLote = {};
        queryEmpaque.forEach((docu) => {
            let d = docu.data();
            if (d.produccionId) {
                let gastado = (Number(d.empaques || 0) * Number(d.unidades || 0)) + Number(d.degustacion || 0);
                capsulasGastadasPorLote[d.produccionId] = (capsulasGastadasPorLote[d.produccionId] || 0) + gastado;
            }
        });

        // 3. Sumar consumo directo del módulo de Degustación
        registrosDegustacion = [];
        queryDegustacion.forEach((docu) => {
            let d = docu.data();
            registrosDegustacion.push({ id: docu.id, ...d });

            if (d.produccionId) {
                let gastadoDegust = Number(d.cantidadDegustacion || 0);
                capsulasGastadasPorLote[d.produccionId] = (capsulasGastadasPorLote[d.produccionId] || 0) + gastadoDegust;
            }
        });

        listaProducciones = [];
        mapaProduccion = {};

        // 4. Mapear disponibilidades por lote
        queryProduccion.forEach((docu) => {
            let d = docu.data();
            let idProd = docu.id;
            
            let productoLimpio = d.producto || "Sin Nombre";
            let rawLote = d.producto || idProd;
            
            let lotePTVal = d.lotePT || mapaLotesPT[idProd] || mapaLotesPT[rawLote] || "";
            let badgePTHTML = lotePTVal 
                ? `<span style="background:#198754; color:white; padding:2px 6px; border-radius:4px; font-size:11px; font-weight:bold;">${lotePTVal}</span>` 
                : `<span style="background:#6c757d; color:white; padding:2px 6px; border-radius:4px; font-size:11px; font-weight:bold;">Sin Lote PT</span>`;

            let loteLabel = d.producto ? `Lote: ${d.producto}` : `Lote ID: ${idProd}`;

            let inicialAprobado = mapaCalidadPorId[idProd] !== undefined ? mapaCalidadPorId[idProd] : (Number(d.capsulas) || 0);
            let yaGastado = capsulasGastadasPorLote[idProd] || 0;
            let saldoDisponible = inicialAprobado - yaGastado;

            let info = {
                id: idProd,
                lote: loteLabel,
                producto: productoLimpio,
                lotePT: lotePTVal,
                badgePTHTML: badgePTHTML,
                capsulasOriginales: inicialAprobado,
                capsulasActuales: saldoDisponible 
            };

            listaProducciones.push(info);
            mapaProduccion[idProd] = info;
        });

        // Llenar selector
        listaProducciones.forEach((info) => {
            if (info.capsulasActuales > 0 || (loteSeleccionado && loteSeleccionado.id === info.id)) {
                let option = document.createElement("option");
                option.value = JSON.stringify(info);
                let textoLotePT = info.lotePT ? ` [PT: ${info.lotePT}]` : ` [Sin Lote PT]`;
                option.text = `${info.lote}${textoLotePT} (Disponibles: ${info.capsulasActuales} ud)`;
                select.appendChild(option);
            }
        });

        actualizarDisponible();
        renderizarResumenGavetas();

    } catch (error) {
        console.error("Error cargando lotes para degustación:", error);
    }
}

function renderizarResumenGavetas() {
    let divTotal = document.getElementById("totalGavetasDegustacion");
    let ulDetalle = document.getElementById("listaGavetasDegustacion");

    if (!divTotal || !ulDetalle) return;

    let totalCapsulas = 0;
    ulDetalle.innerHTML = "";

    let lotesConStock = listaProducciones.filter(p => p.capsulasActuales > 0);

    if (lotesConStock.length === 0) {
        divTotal.textContent = "0 cápsulas";
        divTotal.style.color = "#dc3545";
        ulDetalle.innerHTML = "<li style='list-style:none; color:#6c757d;'>No hay cápsulas disponibles para degustación.</li>";
        return;
    }

    lotesConStock.forEach(p => {
        totalCapsulas += p.capsulasActuales;
        let li = document.createElement("li");
        li.style.marginBottom = "6px";
        li.innerHTML = `<strong>${p.producto}</strong> - ${p.badgePTHTML}: ${p.capsulasActuales.toLocaleString()} cápsulas disponibles.`;
        ulDetalle.appendChild(li);
    });

    divTotal.textContent = `${totalCapsulas.toLocaleString()} cápsulas disponibles en total`;
    divTotal.style.color = "#0b5ed7";
}

if (document.getElementById("lote")) {
    document.getElementById("lote").addEventListener("change", actualizarDisponible);
}

function actualizarDisponible() {
    let select = document.getElementById("lote");
    if (!select || !select.value) return;

    let data = JSON.parse(select.value);
    loteSeleccionado = data;
    capsulasDisponiblesLote = Number(data.capsulasActuales);

    if (document.getElementById("producto")) {
        document.getElementById("producto").value = data.producto;
    }
    
    let inputDisponible = document.getElementById("disponible");
    if (inputDisponible) {
        inputDisponible.value = capsulasDisponiblesLote;
    }
    calcularDegustacion();
}

//=========================
// CÁLCULO DINÁMICO
//=========================
window.calcularDegustacion = function() {
    let cantidadDegust = Number(document.getElementById("cantidadDegustacion")?.value || 0);
    let inputDisponible = document.getElementById("disponible");
    
    if (inputDisponible) {
        inputDisponible.value = capsulasDisponiblesLote - cantidadDegust;
    }
};

if (document.getElementById("cantidadDegustacion")) {
    document.getElementById("cantidadDegustacion").addEventListener("input", calcularDegustacion);
}

//=========================
// GUARDAR REGISTRO DE DEGUSTACIÓN
//=========================
window.guardarDegustacion = async function() {
    if (idEditar !== null) {
        alert("Termine de editar el registro actual o cancele antes de continuar.");
        return;
    }

    let fechaHora = document.getElementById("fechaHora")?.value || "";
    let cantidadDegustacion = Number(document.getElementById("cantidadDegustacion")?.value || 0);
    let responsable = document.getElementById("responsable")?.value.trim() || "Sin Especificar";
    let observaciones = document.getElementById("observaciones")?.value.trim() || "-";

    if (!fechaHora || !loteSeleccionado) {
        alert("Por favor complete los campos obligatorios: Fecha/Hora y Lote.");
        return;
    }

    if (cantidadDegustacion <= 0) {
        alert("⚠️ Ingrese una cantidad válida de cápsulas para degustación.");
        return;
    }

    if (capsulasDisponiblesLote - cantidadDegustacion < 0) {
        alert(`❌ Cantidad excedida. Solo hay ${capsulasDisponiblesLote} cápsulas disponibles en este lote.`);
        return;
    }

    let data = {
        fechaHora,
        produccionId: loteSeleccionado.id,
        lote: loteSeleccionado.lote,
        producto: loteSeleccionado.producto,
        lotePT: loteSeleccionado.lotePT || "",
        cantidadDegustacion,
        responsable,
        observaciones,
        restante: capsulasDisponiblesLote - cantidadDegustacion
    };

    try {
        await addDoc(collection(db, "degustacion"), data);
        alert("✅ Registro de degustación guardado exitosamente.");
        limpiarFormulario();
        await cargarLotes();
        cargarTablaDegustacion();
    } catch (e) {
        console.error("Error al guardar degustación: ", e);
    }
};

//=========================
// BÚSQUEDA Y TABLA
//=========================
function vincularEventosBusqueda() {
    let inputBusqueda = document.getElementById("buscarDegustacion");
    let btnBuscar = document.getElementById("btnBuscarDegustacion");

    if (inputBusqueda && !inputBusqueda.dataset.escuchando) {
        inputBusqueda.dataset.escuchando = "true";
        inputBusqueda.addEventListener("input", function(e) {
            textoFiltro = e.target.value.toLowerCase().trim();
            cargarTablaDegustacion();
        });
    }

    if (btnBuscar && !btnBuscar.dataset.escuchando) {
        btnBuscar.dataset.escuchando = "true";
        btnBuscar.addEventListener("click", function() {
            if (inputBusqueda) {
                textoFiltro = inputBusqueda.value.toLowerCase().trim();
                cargarTablaDegustacion();
            }
        });
    }
}

async function cargarTablaDegustacion() {
    let tabla = document.querySelector("#tablaDegustacion tbody");
    if (!tabla) return;
    tabla.innerHTML = "";

    vincularEventosBusqueda();

    registrosDegustacion.sort((a, b) => (b.fechaHora || "").localeCompare(a.fechaHora || ""));

    let registrosFiltrados = registrosDegustacion.filter(d => {
        if (!textoFiltro) return true;

        let cruceID = mapaProduccion[d.produccionId];
        let loteLimpio = (cruceID ? cruceID.lote : d.lote || "").toLowerCase();
        let productoLimpio = (cruceID ? cruceID.producto : d.producto || "").toLowerCase();
        let lotePT = (d.lotePT || (cruceID ? cruceID.lotePT : "") || "").toLowerCase();
        let responsable = (d.responsable || "").toLowerCase();
        let obs = (d.observaciones || "").toLowerCase();

        let todoElTexto = `${loteLimpio} ${productoLimpio} ${lotePT} ${responsable} ${obs}`;
        return textoFiltro.split(" ").every(palabra => todoElTexto.includes(palabra));
    });

    if (registrosFiltrados.length === 0) {
        tabla.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #888; padding: 15px;">No se encontraron registros de degustación.</td></tr>`;
        return;
    }

    registrosFiltrados.forEach((d) => {
        let id = d.id;
        let fFormateada = d.fechaHora ? d.fechaHora.replace("T", " ") : "-";
        let cruceID = mapaProduccion[d.produccionId];

        let loteLimpio = cruceID ? cruceID.lote : d.lote;
        let productoLimpio = cruceID ? cruceID.producto : d.producto;
        
        let lotePTVal = d.lotePT || (cruceID ? cruceID.lotePT : "") || mapaLotesPT[d.produccionId] || "";
        let badgePTHTML = lotePTVal 
            ? `<span style="background:#198754; color:white; padding:2px 6px; border-radius:4px; font-size:11px; font-weight:bold;">${lotePTVal}</span>` 
            : `<span style="background:#6c757d; color:white; padding:2px 6px; border-radius:4px; font-size:11px; font-weight:bold;">Sin Lote PT</span>`;

        if (idEditar === id) {
            tabla.innerHTML += `
            <tr style="background-color: #fff3cd;">
                <td><input type="datetime-local" id="editFecha_${id}" value="${d.fechaHora || ''}"></td>
                <td><b>${loteLimpio}</b></td>
                <td><input type="number" id="editCantidad_${id}" value="${d.cantidadDegustacion || 0}" style="width:70px;"> ud</td>
                <td><input type="text" id="editResponsable_${id}" value="${d.responsable || ''}"></td>
                <td><input type="text" id="editObs_${id}" value="${d.observaciones || ''}"></td>
                <td>
                    <button onclick="confirmarActualizacion('${id}')" style="background-color:#198754; color:white;">💾</button>
                    <button onclick="cancelarEdicion()" style="background-color:#6c757d; color:white;">❌</button>
                </td>
                <td>-</td>
            </tr>`;
        } else {
            tabla.innerHTML += `
            <tr>
                <td>${fFormateada}</td>
                <td>
                    <strong>${loteLimpio}</strong> <br>
                    <small style="color:#6c757d;">${productoLimpio}</small> <br>
                    <div style="margin-top:4px;">${badgePTHTML}</div>
                </td>
                <td><b style="color:#0d6efd;">${d.cantidadDegustacion} ud</b></td>
                <td>${d.responsable || 'N/A'}</td>
                <td>${d.observaciones || '-'}</td>
                <td>
                    <button onclick="activarEdicion('${id}')">✏️</button>
                    <button onclick="eliminarDegustacion('${id}')">🗑️</button>
                </td>
                <td>
                    <button onclick="pdfDegustacion('${fFormateada}', '${loteLimpio}', '${productoLimpio}', '${d.cantidadDegustacion}', '${d.responsable}')">📄</button>
                </td>
            </tr>`;
        }
    });
}

window.activarEdicion = function(id) { idEditar = id; cargarTablaDegustacion(); };
window.cancelarEdicion = function() { idEditar = null; cargarTablaDegustacion(); };

window.confirmarActualizacion = async function(id) {
    let fechaHora = document.getElementById(`editFecha_${id}`).value;
    let cantidadDegustacion = Number(document.getElementById(`editCantidad_${id}`).value || 0);
    let responsable = document.getElementById(`editResponsable_${id}`).value.trim();
    let observaciones = document.getElementById(`editObs_${id}`).value.trim();

    try {
        await updateDoc(doc(db, "degustacion", id), {
            fechaHora,
            cantidadDegustacion,
            responsable,
            observaciones
        });
        idEditar = null;
        alert("✅ Registro actualizado.");
        await cargarLotes();
        cargarTablaDegustacion();
    } catch (e) {
        console.error(e);
    }
};

window.eliminarDegustacion = async function(id) {
    if (confirm("¿Desea eliminar este registro de degustación? El stock volverá a estar disponible.")) {
        try {
            await deleteDoc(doc(db, "degustacion", id));
            alert("✅ Registro eliminado.");
            await cargarLotes();
            cargarTablaDegustacion();
        } catch (e) {
            console.error(e);
        }
    }
};

window.pdfDegustacion = function(fecha, lote, producto, cantidad, responsable) {
    if (!window.jspdf) {
        alert("Librería jsPDF no detectada en la página.");
        return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text("COMPROBANTE DE SALIDA PARA DEGUSTACIÓN", 20, 20);
    doc.text("Fecha: " + fecha, 20, 35);
    doc.text("Lote: " + lote, 20, 45);
    doc.text("Producto: " + producto, 20, 55);
    doc.text("Cantidad Entregada: " + cantidad + " cápsulas", 20, 65);
    doc.text("Responsable/Entregado a: " + responsable, 20, 75);
    doc.save(`degustacion_${lote.replace(/ /g, "_")}.pdf`);
};

function limpiarFormulario() {
    if (document.getElementById("fechaHora")) document.getElementById("fechaHora").value = "";
    if (document.getElementById("lote")) document.getElementById("lote").value = "";
    if (document.getElementById("producto")) document.getElementById("producto").value = "";
    if (document.getElementById("cantidadDegustacion")) document.getElementById("cantidadDegustacion").value = "";
    if (document.getElementById("responsable")) document.getElementById("responsable").value = "";
    if (document.getElementById("observaciones")) document.getElementById("observaciones").value = "";
    if (document.getElementById("disponible")) document.getElementById("disponible").value = "";
    
    idEditar = null; 
    loteSeleccionado = null;
}

async function init() {
    await cargarLotes();
    await cargarTablaDegustacion();
}

init();