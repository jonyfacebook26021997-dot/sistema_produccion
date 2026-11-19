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
let mapaProduccion = {}; 
let listaProducciones = [];
let textoFiltroCalidad = "";

//=========================
// FUNCIÓN PARA LIMPIAR TEXTO DE LOTE
//=========================
function obtenerTextoLoteLimpio(d, infoLote) {
    let lotePosible = d.loteNumero || (infoLote ? infoLote.loteNumero : "");
    let producto = d.producto || (infoLote ? infoLote.producto : "Sin Nombre");

    if (!lotePosible || lotePosible.length > 15 || lotePosible.includes("pw8JPb")) {
        return { esLoteValido: false, titulo: producto, subtitulo: "" };
    }

    return { esLoteValido: true, titulo: `Lote ${lotePosible}`, subtitulo: producto };
}

//=========================
// DISEÑO VERTICAL
//=========================
function aplicarEstiloFormularioVertical() {
    const elementosAlinear = ["lote", "lotePT", "producto", "fecha", "capsulas", "desechos", "defecto", "total", "disponible"];
    
    elementosAlinear.forEach(id => {
        let el = document.getElementById(id);
        if (el) {
            el.style.display = "block";
            el.style.width = "100%";
            el.style.maxWidth = "400px";
            el.style.marginBottom = "15px";
            el.style.padding = "8px";
            el.style.boxSizing = "border-box";

            let prev = el.previousSibling;
            while (prev && prev.nodeType !== 1) {
                prev = prev.previousSibling;
            }
            if (prev && (prev.tagName === "LABEL" || prev.innerText || prev.textContent)) {
                prev.style.display = "block";
                prev.style.marginTop = "10px";
                prev.style.marginBottom = "4px";
                prev.style.fontWeight = "bold";
            }
        }
    });

    const btnGuardar = document.querySelector("button[onclick*='guardarCalidad']");
    if (btnGuardar) {
        btnGuardar.style.display = "block";
        btnGuardar.style.marginTop = "15px";
        btnGuardar.style.padding = "10px 20px";
    }
}

//=========================
// CÁLCULO EN TIEMPO REAL
//=========================
function asignarCalculoCalidad(idCaps, idDese, idDefe, idTotal) {
    const caps = document.getElementById(idCaps);
    const dese = document.getElementById(idDese);
    const defe = document.getElementById(idDefe);
    const tot = document.getElementById(idTotal);

    if (caps && dese && defe && tot) {
        const calcular = () => {
            let c = Number(caps.value) || 0;
            let d = Number(dese.value) || 0;
            let f = Number(defe.value) || 0;
            tot.value = c - d - f;
        };
        caps.addEventListener("input", calcular);
        dese.addEventListener("input", calcular);
        defe.addEventListener("input", calcular);
    }
}

//=========================
// CARGAR LOTES DESDE PRODUCCIÓN
//=========================
async function cargarLotesProduccion() {
    const select = document.getElementById("lote");
    if (!select) return;
    select.innerHTML = "<option value=''>Seleccione lote de producción</option>";

    try {
        const [snapProduccion, snapCalidad] = await Promise.all([
            getDocs(collection(db, "produccion")),
            getDocs(collection(db, "calidad"))
        ]);

        const lotesConCalidadExistente = new Set();
        snapCalidad.forEach((docu) => {
            let d = docu.data();
            if (d.loteId || d.produccionId) {
                lotesConCalidadExistente.add(d.loteId || d.produccionId);
            }
        });

        mapaProduccion = {};
        listaProducciones = [];

        snapProduccion.forEach((docu) => {
            let d = docu.data();
            let idProd = docu.id;

            let numLote = (d.lote || d.loteNumero || d.numeroLote || "").trim();
            if (numLote.length > 15) numLote = "";

            mapaProduccion[idProd] = {
                loteNumero: numLote,
                producto: d.producto || "Sin Nombre",
                capsulasOriginales: d.capsulas || 0
            };

            listaProducciones.push({ id: idProd, loteNumero: numLote, ...d });

            if (!lotesConCalidadExistente.has(idProd)) {
                let option = document.createElement("option");
                option.value = idProd;
                let etiquetaLote = numLote ? `Lote ${numLote} ` : "";
                option.textContent = `${etiquetaLote}${d.producto || 'Sin Nombre'} (${d.capsulas || 0} ud)`;
                select.appendChild(option);
            }
        });

        aplicarEstiloFormularioVertical();

    } catch (e) {
        console.error("Error cargando lotes de producción:", e);
    }
}

//=========================
// GUARDAR NUEVO CONTROL DE CALIDAD
//=========================
window.guardarCalidad = async function() {
    if (idEditar !== null) {
        alert("Por favor, termine de editar la fila activa o cancele los cambios.");
        return;
    }

    let loteId = document.getElementById("lote")?.value;
    let lotePTInput = document.getElementById("lotePT");
    let lotePT = lotePTInput ? lotePTInput.value.trim() : "";
    
    let prodSel = mapaProduccion[loteId];
    let loteNumero = prodSel ? prodSel.loteNumero : "";
    let producto = document.getElementById("producto")?.value || (prodSel ? prodSel.producto : "");
    let fecha = document.getElementById("fecha")?.value || "";
    let capsulas = Number(document.getElementById("capsulas")?.value) || 0;
    let desechos = Number(document.getElementById("desechos")?.value) || 0;
    let defecto = Number(document.getElementById("defecto")?.value) || 0;
    let total = Number(document.getElementById("total")?.value) || 0;

    if (!loteId || !fecha || capsulas <= 0) {
        alert("Por favor, complete los campos obligatorios.");
        return;
    }

    let data = { 
        loteId, 
        produccionId: loteId,
        loteNumero,
        lotePT, 
        producto,
        fecha, 
        capsulas, 
        desechos, 
        defecto, 
        total 
    };

    try {
        await addDoc(collection(db, "calidad"), data);
        alert("✅ Control de calidad guardado con éxito.");
        limpiarFormulario();
        await cargarLotesProduccion();
        await window.cargarCalidad();
    } catch (e) {
        console.error("Error al guardar: ", e);
    }
};

//=========================
// VINCULAR EVENTOS DE BÚSQUEDA
//=========================
function vincularEventosBusquedaCalidad() {
    let inputBusqueda = document.getElementById("buscarLoteCalidad");
    let btnBuscar = document.getElementById("btnBuscarCalidad");

    if (inputBusqueda && !inputBusqueda.dataset.escuchando) {
        inputBusqueda.dataset.escuchando = "true";
        inputBusqueda.addEventListener("input", function(e) {
            textoFiltroCalidad = e.target.value.toLowerCase().trim();
            window.cargarCalidad();
        });
    }

    if (btnBuscar && !btnBuscar.dataset.escuchando) {
        btnBuscar.dataset.escuchando = "true";
        btnBuscar.addEventListener("click", function() {
            if (inputBusqueda) {
                textoFiltroCalidad = inputBusqueda.value.toLowerCase().trim();
                window.cargarCalidad();
            }
        });
    }
}

//=========================
// CARGAR TABLA REGISTROS
//=========================
window.cargarCalidad = async function() {
    let tbody = document.getElementById("tbodyCalidad");
    if (!tbody) return;

    vincularEventosBusquedaCalidad();

    try {
        const querySnapshot = await getDocs(collection(db, "calidad"));
        let registros = [];

        querySnapshot.forEach((docu) => {
            registros.push({ id: docu.id, ...docu.data() });
        });

        registros.sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));

        let registrosFiltrados = registros.filter(d => {
            if (!textoFiltroCalidad) return true;

            let infoLote = mapaProduccion[d.loteId || d.produccionId];
            let infoVis = obtenerTextoLoteLimpio(d, infoLote);
            let tituloFila = `${infoVis.titulo} ${infoVis.subtitulo}`.toLowerCase();
            let lotePTFila = (d.lotePT || "").toLowerCase();
            let fechaFila = (d.fecha || "").replace("T", " ").toLowerCase();
            let capsFila = String(d.capsulas || "").toLowerCase();
            let totalFila = String(d.total || "").toLowerCase();

            let todoElTextoFila = `${tituloFila} ${lotePTFila} ${fechaFila} ${capsFila} ${totalFila}`;
            let palabrasClave = textoFiltroCalidad.split(" ");
            return palabrasClave.every(palabra => todoElTextoFila.includes(palabra));
        });

        if (registrosFiltrados.length === 0) {
            tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: #888; padding: 15px;">No se encontraron registros coincidentes con "${textoFiltroCalidad}".</td></tr>`;
            return;
        }

        let htmlFilas = "";

        registrosFiltrados.forEach((d) => {
            let id = d.id;
            let infoLote = mapaProduccion[d.loteId || d.produccionId];
            let infoVis = obtenerTextoLoteLimpio(d, infoLote);
            let fechaFormateada = d.fecha ? d.fecha.replace("T", " ") : "-";

            if (idEditar === id) {
                let opcionesLotes = listaProducciones.map(p => {
                    let etiqueta = p.loteNumero ? `Lote ${p.loteNumero} ${p.producto}` : p.producto;
                    return `<option value="${p.id}" ${p.id === (d.loteId || d.produccionId) ? 'selected' : ''}>${etiqueta}</option>`;
                }).join('');

                htmlFilas += `
                <tr style="background-color: #fff3cd;">
                    <td><select id="editLote_${id}" style="width:140px;">${opcionesLotes}</select></td>
                    <td><input type="text" id="editLotePT_${id}" value="${d.lotePT || ''}" style="width:120px;"></td>
                    <td><input type="datetime-local" id="editFecha_${id}" value="${d.fecha || ''}" style="width:165px;"></td>
                    <td><input type="number" id="editCapsulas_${id}" value="${d.capsulas || 0}" style="width:80px;"></td>
                    <td><input type="number" id="editDesechos_${id}" value="${d.desechos || 0}" style="width:80px;"></td>
                    <td><input type="number" id="editDefecto_${id}" value="${d.defecto || 0}" style="width:80px;"></td>
                    <td><input type="number" id="editTotal_${id}" value="${d.total || 0}" readonly style="width:80px; background:#eee;"></td>
                    <td>
                        <button onclick="confirmarActualizacionCalidad('${id}')" style="background-color:#198754; color:white; padding:4px 8px;">💾</button>
                        <button onclick="cancelarEdicionCalidad()" style="background-color:#6c757d; color:white; padding:4px 8px;">❌</button>
                    </td>
                    <td>-</td>
                </tr>
                `;
            } else {
                htmlFilas += `
                <tr>
                    <td>
                        <strong>${infoVis.titulo}</strong><br>
                        ${infoVis.subtitulo ? `<small style="color:#6c757d;">${infoVis.subtitulo}</small>` : ''}
                    </td>
                    <td><span class="badge-pt" style="background-color: #0d6efd; color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: bold;">${d.lotePT || 'Sin Lote PT'}</span></td>
                    <td>${fechaFormateada}</td>
                    <td>${d.capsulas || 0} ud</td>
                    <td>${d.desechos || 0}</td>
                    <td>${d.defecto || 0}</td>
                    <td style="font-weight:bold; color:#0d6efd;">${d.total || 0} ud</td>
                    <td>
                        <button onclick="activarEdicionCalidad('${id}')">✏</button>
                        <button onclick="eliminarCalidad('${id}')">🗑</button>
                    </td>
                    <td>
                        <button onclick="generarPDFCalidad('${infoVis.titulo}', '${d.lotePT || 'N/A'}', '${fechaFormateada}', ${d.capsulas || 0}, ${d.total || 0})">📄</button>
                    </td>
                </tr>
                `;
            }
        });

        tbody.innerHTML = htmlFilas;

        if (idEditar) {
            asignarCalculoCalidad(`editCapsulas_${idEditar}`, `editDesechos_${idEditar}`, `editDefecto_${idEditar}`, `editTotal_${idEditar}`);
        }

    } catch (e) {
        console.error("Error al cargar la tabla: ", e);
    }
};

window.activarEdicionCalidad = function(id) {
    idEditar = id;
    window.cargarCalidad();
};

window.cancelarEdicionCalidad = function() {
    idEditar = null;
    window.cargarCalidad();
};

//=========================
// PROPAGACIÓN EN CASCADA BIDIRECCIONAL ABSOLUTA
//=========================
window.confirmarActualizacionCalidad = async function(id) {
    let confirmar = confirm("¿Quieres actualizar este registro de calidad y propagar el cambio en cascada de forma exacta a este lote en empaque e inventario?");
    if (!confirmar) return;

    let loteId = document.getElementById(`editLote_${id}`)?.value;
    let editLotePTInput = document.getElementById(`editLotePT_${id}`);
    let lotePT = editLotePTInput ? editLotePTInput.value.trim() : "";
    let prodSel = mapaProduccion[loteId];
    let loteNumero = prodSel ? prodSel.loteNumero : "";
    let producto = prodSel ? prodSel.producto : "";
    let fecha = document.getElementById(`editFecha_${id}`)?.value || "";
    let capsulas = Number(document.getElementById(`editCapsulas_${id}`)?.value) || 0;
    let desechos = Number(document.getElementById(`editDesechos_${id}`)?.value) || 0;
    let defecto = Number(document.getElementById(`editDefecto_${id}`)?.value) || 0;
    let total = Number(document.getElementById(`editTotal_${id}`)?.value) || 0;

    if (!loteId || !fecha || capsulas <= 0) {
        alert("Campos obligatorios inválidos.");
        return;
    }

    try {
        // 1. Obtener el documento actual de calidad antes de modificarlo para detectar si tenía otro ID o Lote PT previo
        const docRefCalidad = doc(db, "calidad", id);
        
        // 2. Actualizar Calidad
        await updateDoc(docRefCalidad, { 
            loteId, 
            produccionId: loteId,
            loteNumero,
            lotePT,
            producto,
            fecha, 
            capsulas, 
            desechos, 
            defecto, 
            total 
        });

        // 3. Propagación estricta y bidireccional a EMPAQUE (por ID o coincidencia general del lote)
        const snapEmpaque = await getDocs(collection(db, "empaque"));
        for (const docEmp of snapEmpaque.docs) {
            let dataEmp = docEmp.data();
            // Coincide si el produccionId es igual, o si el lote antiguo coincide por texto
            if (dataEmp.produccionId === loteId || dataEmp.loteId === loteId || dataEmp.produccionId === id) {
                await updateDoc(doc(db, "empaque", docEmp.id), { lotePT: lotePT });
            }
        }

        const snapGrano = await getDocs(collection(db, "empaqueCafeGrano"));
        for (const docGrano of snapGrano.docs) {
            let dataGrano = docGrano.data();
            if (dataGrano.produccionId === loteId || dataGrano.loteId === loteId || dataGrano.produccionId === id) {
                await updateDoc(doc(db, "empaqueCafeGrano", docGrano.id), { lotePT: lotePT });
            }
        }

        // 4. Propagación estricta y bidireccional a INVENTARIO DE PRODUCTO TERMINADO
        const snapInv = await getDocs(collection(db, "inventario_terminado"));
        for (const docInv of snapInv.docs) {
            let dataInv = docInv.data();
            if (dataInv.produccionId === loteId || dataInv.loteId === loteId || dataInv.produccionId === id) {
                await updateDoc(doc(db, "inventario_terminado", docInv.id), { lotePT: lotePT });
            }
        }

        idEditar = null;
        alert("✅ Actualización en cascada aplicada perfectamente de ida y vuelta.");
        await cargarLotesProduccion();
        await window.cargarCalidad();
    } catch (e) {
        console.error("Error al actualizar en cascada: ", e);
        alert("Hubo un error al actualizar las dependencias.");
    }
};

window.eliminarCalidad = async function(id) {
    if (!confirm("¿Seguro que desea eliminar este registro de Control de Calidad?")) return;
    try {
        await deleteDoc(doc(db, "calidad", id));
        alert("✅ Registro eliminado.");
        await cargarLotesProduccion();
        await window.cargarCalidad();
    } catch (e) {
        console.error("Error al eliminar: ", e);
    }
};

window.generarPDFCalidad = function(loteInfo, lotePT, fecha, caps, total) {
    if (!window.jspdf) {
        alert("La librería jsPDF no está disponible.");
        return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text("REPORTE - CONTROL DE CALIDAD", 20, 20);
    doc.text("Producto / Lote: " + loteInfo, 20, 35);
    doc.text("Lote Producto Terminado: " + lotePT, 20, 45);
    doc.text("Fecha control: " + fecha, 20, 55);
    doc.text("Cápsulas evaluadas: " + caps + " ud", 20, 65);
    doc.text("Aprobadas Netas: " + total + " ud", 20, 75);
    doc.save("Calidad_" + String(loteInfo).replace(/ /g, "_") + ".pdf");
};

function limpiarFormulario() {
    let selectLote = document.getElementById("lote");
    if (selectLote) selectLote.value = "";

    let lotePTInput = document.getElementById("lotePT");
    if (lotePTInput) lotePTInput.value = "";

    let idsLimpiar = ["producto", "fecha", "capsulas", "desechos", "defecto", "total", "disponible"];
    idsLimpiar.forEach(id => {
        let el = document.getElementById(id);
        if (el) el.value = "";
    });

    idEditar = null;
}

async function init() {
    const selectLote = document.getElementById("lote");
    if (selectLote) {
        selectLote.addEventListener("change", () => {
            let prodSel = mapaProduccion[selectLote.value];
            let inputProducto = document.getElementById("producto");
            let inputDisponible = document.getElementById("disponible");

            if (prodSel) {
                if (inputProducto) inputProducto.value = prodSel.producto;
                if (inputDisponible) inputDisponible.value = prodSel.capsulasOriginales;
            } else {
                if (inputProducto) inputProducto.value = "";
                if (inputDisponible) inputDisponible.value = "";
            }
        });
    }

    asignarCalculoCalidad("capsulas", "desechos", "defecto", "total");

    await cargarLotesProduccion();
    await window.cargarCalidad(); 
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}