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

// Valores por defecto del encabezado
let encabezadoGuardado = {
    titulo: "REGISTRO DE RECEPCIÓN Y CONTROL DE MATERIAS PRIMAS E INSUMOS",
    codigo: "REGP9",
    version: "001",
    elaboracion: "01/02/2024"
};

//=========================
// GESTIÓN DEL ENCABEZADO EDITABLE (100% FUNCIONAL)
//=========================
function inicializarEncabezado() {
    const guardadoLocal = localStorage.getItem("encabezado_materia_prima");
    if (guardadoLocal) {
        try {
            encabezadoGuardado = JSON.parse(guardadoLocal);
        } catch (e) {
            console.error("Error leyendo encabezado guardado:", e);
        }
    }
    aplicarValoresEncabezado();
}

function aplicarValoresEncabezado() {
    document.getElementById("pdfTitulo").innerText = encabezadoGuardado.titulo;
    document.getElementById("pdfCodigo").innerText = encabezadoGuardado.codigo;
    document.getElementById("pdfVersion").innerText = encabezadoGuardado.version;
    document.getElementById("pdfElaboracion").innerText = encabezadoGuardado.elaboracion;

    document.getElementById("inputPdfTitulo").value = encabezadoGuardado.titulo;
    document.getElementById("inputPdfCodigo").value = encabezadoGuardado.codigo;
    document.getElementById("inputPdfVersion").value = encabezadoGuardado.version;
    document.getElementById("inputPdfElaboracion").value = encabezadoGuardado.elaboracion;
}

window.activarEdicionEncabezado = function() {
    document.getElementById("pdfTitulo").style.display = "none";
    document.getElementById("pdfCodigo").style.display = "none";
    document.getElementById("pdfVersion").style.display = "none";
    document.getElementById("pdfElaboracion").style.display = "none";

    document.getElementById("inputPdfTitulo").style.display = "block";
    document.getElementById("inputPdfCodigo").style.display = "block";
    document.getElementById("inputPdfVersion").style.display = "block";
    document.getElementById("inputPdfElaboracion").style.display = "block";

    document.getElementById("btnEditarEncabezado").style.display = "none";
    document.getElementById("grupoGuardarEncabezado").style.display = "flex";
};

function cerrarModoEdicionEncabezado() {
    document.getElementById("pdfTitulo").style.display = "block";
    document.getElementById("pdfCodigo").style.display = "inline";
    document.getElementById("pdfVersion").style.display = "inline";
    document.getElementById("pdfElaboracion").style.display = "inline";

    document.getElementById("inputPdfTitulo").style.display = "none";
    document.getElementById("inputPdfCodigo").style.display = "none";
    document.getElementById("inputPdfVersion").style.display = "none";
    document.getElementById("inputPdfElaboracion").style.display = "none";

    document.getElementById("btnEditarEncabezado").style.display = "inline-block";
    document.getElementById("grupoGuardarEncabezado").style.display = "none";
}

window.guardarEncabezado = function() {
    let nuevoTitulo = document.getElementById("inputPdfTitulo").value.trim() || encabezadoGuardado.titulo;
    let nuevoCodigo = document.getElementById("inputPdfCodigo").value.trim() || encabezadoGuardado.codigo;
    let nuevaVersion = document.getElementById("inputPdfVersion").value.trim() || encabezadoGuardado.version;
    let nuevaElaboracion = document.getElementById("inputPdfElaboracion").value.trim() || encabezadoGuardado.elaboracion;

    encabezadoGuardado = {
        titulo: nuevoTitulo,
        codigo: nuevoCodigo,
        version: nuevaVersion,
        elaboracion: nuevaElaboracion
    };

    localStorage.setItem("encabezado_materia_prima", JSON.stringify(encabezadoGuardado));

    aplicarValoresEncabezado();
    cerrarModoEdicionEncabezado();
    alert("✅ Cambios del encabezado guardados correctamente.");
};

window.cancelarEdicionEncabezado = function() {
    aplicarValoresEncabezado();
    cerrarModoEdicionEncabezado();
};

//=========================
// CONFIGURACIÓN DE BÚSQUEDA SIMPLE
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
// GUARDAR NUEVO REGISTRO
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

    let inputBusqueda = document.getElementById("buscarConsecutivo");
    if (inputBusqueda) inputBusqueda.value = "";
    textoFiltroMateria = "";

    try {
        const querySnapshot = await getDocs(collection(db, "materiaPrima"));
        registrosMateriaPrima = [];

        querySnapshot.forEach((docu) => {
            registrosMateriaPrima.push({ id: docu.id, ...docu.data() });
        });

        registrosMateriaPrima.sort((a, b) => {
            let nA = a.numeroRecepcion || "";
            let nB = b.numeroRecepcion || "";
            return nB.localeCompare(nA, undefined, { numeric: true, sensitivity: 'base' });
        });

        renderizarTablaMateria();
        actualizarDatalistPdf();

    } catch (e) {
        console.error("Error al cargar datos: ", e);
    }
};

//=========================
// ACTUALIZAR DATALIST DE PDF CON BUSCADOR
//=========================
function actualizarDatalistPdf() {
    let datalist = document.getElementById("listaRegistrosPdf");
    if (!datalist) return;

    datalist.innerHTML = "";
    registrosMateriaPrima.forEach(r => {
        let option = document.createElement("option");
        // El texto que se muestra y busca en el campo
        option.value = `Consecutivo: ${r.numeroRecepcion || 'N/A'} - Lote: ${r.loteInterno || 'N/A'} - Prov: ${r.proveedor || 'N/A'}`;
        // Guardamos el ID real en el dataset para recuperarlo al exportar
        option.dataset.id = r.id;
        datalist.appendChild(option);
    });
}

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

        let disponible = Number(d.pesoDisponible ?? d.pesoTotal) || 0;
        let disponibleFormateado = disponible.toFixed(2);

        let tieneStock = disponible > 0;
        let badgeColor = tieneStock ? "#d1e7dd" : "#f8d7da";
        let textColor = tieneStock ? "#0f5132" : "#842029";
        let textoEstado = tieneStock ? `🟢 Stock: ${disponibleFormateado} kg` : `🔴 Agotado (0 kg)`;

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
                    <button onclick="generarPDFPorId('${d.id}')">📄</button>
                </td>
            </tr>
            `;
        }
    });

    let totalRegElem = document.getElementById("totalRegistros");
    if (totalRegElem) totalRegElem.innerText = `Total registros: ${total}`;
}

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
// GENERADOR PDF COMPLETO
//=========================
window.generarPDFPorId = async function(id) {
    let registro = registrosMateriaPrima.find(r => r.id === id);
    if (!registro) {
        alert("No se encontró el registro.");
        return;
    }

    const estabaEditando = document.getElementById("grupoGuardarEncabezado").style.display === "flex";
    if (estabaEditando) {
        cerrarModoEdicionEncabezado();
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    let elementoEncabezado = document.getElementById("encabezadoParaPdf");
    let y = 55;

    if (elementoEncabezado && window.html2canvas) {
        try {
            const canvas = await html2canvas(elementoEncabezado, {
                scale: 2,
                useCORS: true,
                backgroundColor: "#ffffff"
            });

            const imgData = canvas.toDataURL("image/png");
            const imgWidth = 170;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            doc.addImage(imgData, "PNG", 20, 15, imgWidth, imgHeight);
            y = 15 + imgHeight + 12;
        } catch (error) {
            console.error("Error al capturar encabezado:", error);
        }
    }

    if (estabaEditando) {
        activarEdicionEncabezado();
    }

    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("DETALLE DE RECEPCIÓN DE MATERIA PRIMA", 20, y);
    y += 10;
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");

    let salto = 8;

    doc.text("• Fecha y Hora: " + (registro.fechaHora ? registro.fechaHora.replace("T", " ") : "-"), 20, y); y += salto;
    doc.text("• Número Consecutivo: " + (registro.numeroRecepcion || "-"), 20, y); y += salto;
    doc.text("• Proveedor: " + (registro.proveedor || "-"), 20, y); y += salto;
    doc.text("• Material o Insumo: " + (registro.material || "-"), 20, y); y += salto;
    
    let textoLoteProv = registro.loteProveedor === "SI" ? `Sí (${registro.loteProveedorTexto})` : "N/A";
    doc.text("• Lote del Proveedor: " + textoLoteProv, 20, y); y += salto;
    
    doc.text("• Lote Interno: " + (registro.loteInterno || "-"), 20, y); y += salto;
    doc.text("• Cantidad en Bolsas: " + (registro.cantidad || 0) + " ud", 20, y); y += salto;
    doc.text("• Peso Total: " + (registro.pesoTotal || 0) + " kg", 20, y); y += salto;
    doc.text("• Condición de Transporte: " + (registro.condTransporte || "-"), 20, y); y += salto;
    doc.text("• Condición del Material: " + (registro.condMaterial || "-"), 20, y); y += salto;
    
    let textoObs = "• Observaciones: " + (registro.observaciones || "Ninguna");
    doc.text(textoObs, 20, y, { maxWidth: 165 }); 
    
    let lineasObs = doc.splitTextToSize(textoObs, 165);
    y += (lineasObs.length * 5) + 4;

    doc.text("• Entregado por: " + (registro.entregadoPor || "-"), 20, y); y += salto;
    doc.text("• Recibido por: " + (registro.recibidoPor || "-"), 20, y);

    doc.save("MateriaPrima_" + (registro.loteInterno || "Reporte") + ".pdf");
};

//=========================
// EXPORTAR PDF DESDE EL INPUT CON BUSCADOR / DATALIST
//=========================
window.exportarPdfSeleccionado = function() {
    let inputPdf = document.getElementById("inputPdfRegistro");
    let valorEscrito = inputPdf ? inputPdf.value.trim() : "";

    if (!valorEscrito) {
        alert("Por favor, escriba o seleccione un registro en el campo de búsqueda.");
        return;
    }

    // Intentar buscar por coincidencia exacta o parcial en el datalist o en la lista interna
    let datalist = document.getElementById("listaRegistrosPdf");
    let idEncontrado = "";

    if (datalist) {
        for (let option of datalist.options) {
            if (option.value === valorEscrito) {
                idEncontrado = option.dataset.id;
                break;
            }
        }
    }

    // Si no encontró coincidencia exacta en las opciones, buscar por similitud en el texto o lote interno
    if (!idEncontrado) {
        let match = registrosMateriaPrima.find(r => 
            (r.numeroRecepcion && r.numeroRecepcion.toLowerCase().includes(valorEscrito.toLowerCase())) ||
            (r.loteInterno && r.loteInterno.toLowerCase().includes(valorEscrito.toLowerCase())) ||
            (r.proveedor && r.proveedor.toLowerCase().includes(valorEscrito.toLowerCase()))
        );
        if (match) {
            idEncontrado = match.id;
        }
    }

    if (!idEncontrado) {
        alert("❌ No se encontró ningún registro que coincida con lo escrito. Asegúrese de seleccionarlo de la lista.");
        return;
    }

    generarPDFPorId(idEncontrado);
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
inicializarEncabezado();
cargarDatos();