import {
    db,
    collection,
    getDocs,
    addDoc,
    doc,
    deleteDoc,
    updateDoc
} from "./firebase.js";

// ==========================
// ESTADO GLOBAL
// ==========================
let idEditar = null;
let capsulasOriginalesLote = 0; 
let capsulasDisponiblesLote = 0; 
let loteSeleccionado = null;

let listaProducciones = [];
let mapaProduccion = {};
let mapaLotesPT = {}; 
let registrosEmpaque = []; 
let textoFiltro = "";

// ==========================
// FUNCIONES AUXILIARES DE FORMATO
// ==========================
function formatearTipoEmpaque(tipo, registro = {}) {
    let t = String(tipo || "").toLowerCase();
    
    if (t === 'degustacion') {
        return {
            titulo: "Degustación",
            subtitulo: ""
        };
    } else if (t === 'custom' || t === 'personalizado') {
        let empaqueTipo = (registro.empaqueTipo || "bolsa").toLowerCase();
        let esBolsa = empaqueTipo === "bolsa";
        let empaqueTexto = esBolsa ? "Bolsas" : "Cajas";
        let unidades = registro.unidades || 0;
        
        return {
            titulo: "Personalizado",
            subtitulo: `${empaqueTexto} x${unidades} und`
        };
    } else if (t === '15' || t.includes('bolsa')) {
        return {
            titulo: `Bolsa x${tipo} und`,
            subtitulo: ""
        };
    } else {
        return {
            titulo: `Caja x${tipo} und`,
            subtitulo: ""
        };
    }
}

function obtenerUnidadEmpaque(tipo, registro = {}) {
    let t = String(tipo || "").toLowerCase();
    
    if (t === 'degustacion') {
        return 'cápsulas';
    } else if (t === 'custom' || t === 'personalizado') {
        let empaqueTipo = (registro.empaqueTipo || "").toLowerCase();
        let esBolsa = empaqueTipo === "bolsa";
        return esBolsa ? 'bolsas' : 'cajas';
    } else if (t === '15' || t.includes('bolsa')) {
        return 'bolsas';
    } else {
        return 'cajas';
    }
}

// ==========================
// CARGAR LOTES ENLAZADOS Y CALCULAR GAVETAS
// ==========================
async function cargarLotes() {
    let select = document.getElementById("lote");
    if (!select) return;
    select.innerHTML = "<option value=''>Seleccione lote...</option>";

    try {
        const [queryProduccion, queryCalidad, queryEmpaque] = await Promise.all([
            getDocs(collection(db, "produccion")),
            getDocs(collection(db, "calidad")),
            getDocs(collection(db, "empaque"))
        ]);

        let mapaCalidadPorId = {};
        mapaLotesPT = {}; 

        queryCalidad.forEach((docu) => {
            let d = docu.data();
            let lotePTVal = d.lotePT || d.loteProductoTerminado || "";

            if (d.loteId || d.produccionId) {
                let idRef = d.loteId || d.produccionId;
                mapaCalidadPorId[idRef] = Number(d.total) || 0;
                if (lotePTVal) mapaLotesPT[idRef] = lotePTVal;
            }
            if (d.loteNumero && lotePTVal) {
                mapaLotesPT[d.loteNumero] = lotePTVal;
            }
        });

        let capsulasGastadasPorLote = {};
        registrosEmpaque = [];
        queryEmpaque.forEach((docu) => {
            let d = docu.data();
            registrosEmpaque.push({ id: docu.id, ...d });
            
            if (d.produccionId) {
                let gastadoEnEsteRegistro = Number(d.empaques || 0) * Number(d.unidades || 0);
                capsulasGastadasPorLote[d.produccionId] = (capsulasGastadasPorLote[d.produccionId] || 0) + gastadoEnEsteRegistro;
            }
        });

        listaProducciones = [];
        mapaProduccion = {};

        queryProduccion.forEach((docu) => {
            let d = docu.data();
            let idProd = docu.id;
            
            let productoLimpio = d.producto || "Sin Nombre";
            let rawLote = d.producto || idProd;
            
            let lotePTVal = mapaLotesPT[idProd] || mapaLotesPT[rawLote] || d.lotePT || "";
            let badgePTHTML = lotePTVal 
                ? `<span style="background:#198754; color:white; padding:2px 6px; border-radius:4px; font-size:11px; font-weight:bold;">${lotePTVal}</span>` 
                : `<span style="background:#6c757d; color:white; padding:2px 6px; border-radius:4px; font-size:11px; font-weight:bold;">Sin Lote PT</span>`;

            let loteLabel = d.producto ? `Lote: ${d.producto}` : `Lote ID: ${idProd}`;

            let inicialAprobado = mapaCalidadPorId[idProd];
            if (inicialAprobado === undefined) {
                inicialAprobado = Number(d.capsulas) || 0;
            }
            
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

        listaProducciones.forEach((info) => {
            if (info.capsulasActuales > 0 || (loteSeleccionado && loteSeleccionado.id === info.id)) {
                let option = document.createElement("option");
                option.value = JSON.stringify(info);
                let textoLotePT = info.lotePT ? ` [PT: ${info.lotePT}]` : ` [Sin Lote PT]`;
                option.text = `${info.lote}${textoLotePT} (Disponibles: ${info.capsulasActuales} ud / Total CC: ${info.capsulasOriginales})`;
                select.appendChild(option);
            }
        });

        actualizarDisponible();
        renderizarCuadroGavetas();
        aplicarEstiloFormularioVertical();

    } catch (error) {
        console.error("Error cargando datos de lotes e inventario:", error);
    }
}

function renderizarCuadroGavetas() {
    let divTotal = document.querySelector("#cuadroGavetasDisponibles .total-destacado");
    let ulDetalle = document.getElementById("listaGavetasDetalle");

    if (!divTotal || !ulDetalle) return;

    let totalCapsulasGaveta = 0;
    ulDetalle.innerHTML = "";

    let lotesConStock = listaProducciones.filter(p => p.capsulasActuales > 0);

    if (lotesConStock.length === 0) {
        divTotal.textContent = "0 cápsulas";
        divTotal.style.color = "#dc3545";
        ulDetalle.innerHTML = "<li style='list-style:none; color:#6c757d;'>No hay cápsulas sueltas en gavetas actualmente.</li>";
        return;
    }

    lotesConStock.forEach(p => {
        totalCapsulasGaveta += p.capsulasActuales;
        let li = document.createElement("li");
        li.style.marginBottom = "6px";
        li.innerHTML = `<strong>${p.producto}</strong> - ${p.badgePTHTML}: ${p.capsulasActuales.toLocaleString()} cápsulas disponibles.`;
        ulDetalle.appendChild(li);
    });

    divTotal.textContent = `${totalCapsulasGaveta.toLocaleString()} cápsulas totales en gavetas`;
    divTotal.style.color = "#0b5ed7";
}

function actualizarDisponible() {
    let select = document.getElementById("lote");
    if (!select || !select.value) {
        loteSeleccionado = null;
        capsulasDisponiblesLote = 0;
        capsulasOriginalesLote = 0;
        let inputDisponible = document.getElementById("disponible");
        if (inputDisponible) inputDisponible.value = "";
        return;
    }

    let data = JSON.parse(select.value);
    loteSeleccionado = data;
    
    capsulasDisponiblesLote = Number(data.capsulasActuales);
    capsulasOriginalesLote = Number(data.capsulasOriginales);

    if (document.getElementById("producto")) {
        document.getElementById("producto").value = data.producto;
    }
    
    let inputDisponible = document.getElementById("disponible");
    if (inputDisponible) {
        inputDisponible.value = capsulasDisponiblesLote;
    }
    calcularEmpaque();
}

window.calcularEmpaque = function() {
    let tipoElemento = document.getElementById("tipo");
    if (!tipoElemento) return;

    let tipo = tipoElemento.value;
    let esCustom = tipo === "custom" || tipo === "personalizado";
    let esDegustacion = tipo === "degustacion";
    
    let unidades = esDegustacion 
        ? 1 
        : (esCustom ? Number(document.getElementById("personalizado")?.value || 0) : Number(tipo || 0));

    let empaques = Number(document.getElementById("cantidadEmpacar")?.value || 0);
    let usadoAhora = empaques * unidades;
    
    let inputDisponible = document.getElementById("disponible");
    if (inputDisponible) {
        inputDisponible.value = capsulasDisponiblesLote - usadoAhora;
    }
};

function manejarVisibilidadCustom() {
    let tipo = document.getElementById("tipo") ? document.getElementById("tipo").value : "";
    let esCustom = tipo === "custom" || tipo === "personalizado";
    let esDegustacion = tipo === "degustacion";

    let tipoContenedorCustom = document.getElementById("tipoContenedorCustom");
    let pers = document.getElementById("personalizado");
    let lblCantidad = document.getElementById("lblCantidadEmpacar");
    let inputCantidad = document.getElementById("cantidadEmpacar");

    if (tipoContenedorCustom) {
        tipoContenedorCustom.style.display = esCustom ? "block" : "none";
    }

    if (pers) {
        pers.style.display = esCustom ? "block" : "none";
        pers.placeholder = esCustom ? "Cápsulas por empaque (Ej: 10)" : "Unidades personalizadas";
    }

    if (lblCantidad) {
        lblCantidad.textContent = esDegustacion 
            ? "Cantidad de cápsulas para degustación" 
            : "Cantidad de empaques (Cajas/Bolsas)";
    }
    
    if (inputCantidad) {
        inputCantidad.placeholder = esDegustacion 
            ? "Cantidad de cápsulas a restar" 
            : "Cantidad de empaques";
    }

    calcularEmpaque();
}

function aplicarEstiloFormularioVertical() {
    const elementosAlinear = ["lote", "producto", "tipo", "tipoContenedorCustom", "personalizado", "cantidadEmpacar", "disponible"];
    
    elementosAlinear.forEach(id => {
        let el = document.getElementById(id);
        if (el) {
            let esCustom = (id === "personalizado" || id === "tipoContenedorCustom");
            el.style.display = (esCustom && el.style.display === "none") ? "none" : "block";
            el.style.width = "100%";
            el.style.maxWidth = "400px";
            el.style.marginBottom = "12px";
            el.style.padding = "8px";
            el.style.boxSizing = "border-box";

            let prev = el.previousSibling;
            while (prev && prev.nodeType !== 1) {
                prev = prev.previousSibling;
            }
            if (prev && (prev.tagName === "LABEL" || prev.innerText)) {
                prev.style.display = "block";
                prev.style.marginTop = "10px";
                prev.style.marginBottom = "4px";
                prev.style.fontWeight = "bold";
            }
        }
    });

    const btnGuardar = document.querySelector("button[onclick*='guardarEmpaque']");
    if (btnGuardar) {
        btnGuardar.style.display = "block";
        btnGuardar.style.marginTop = "15px";
        btnGuardar.style.padding = "10px 20px";
    }
}

window.guardarEmpaque = async function() {
    if (idEditar !== null) {
        alert("Por favor, termine de editar la fila activa o cancele los cambios.");
        return;
    }

    let fechaHora = document.getElementById("fechaHora") ? document.getElementById("fechaHora").value : "";
    let tipo = document.getElementById("tipo") ? document.getElementById("tipo").value : "";
    
    let esCustom = tipo === "custom" || tipo === "personalizado";
    let esDegustacion = tipo === "degustacion";

    let empaqueTipo = esDegustacion 
        ? "degustacion" 
        : (esCustom 
            ? (document.getElementById("tipoContenedorCustom") ? document.getElementById("tipoContenedorCustom").value : "bolsa") 
            : (tipo === "15" ? "bolsa" : "caja"));

    let unidades = esDegustacion 
        ? 1 
        : (esCustom ? Number(document.getElementById("personalizado")?.value || 0) : Number(tipo || 0));

    let empaques = Number(document.getElementById("cantidadEmpacar")?.value || 0);

    if (!fechaHora || !loteSeleccionado) {
        alert("Por favor, complete los campos obligatorios (Fecha, Hora y Lote).");
        return;
    }

    if (esCustom && unidades <= 0) {
        alert("⚠️ Ingrese manualmente la cantidad de cápsulas por empaque.");
        return;
    }

    let usadoAhora = empaques * unidades;
    
    if (capsulasDisponiblesLote - usadoAhora < 0) {
        alert(`❌ Error: Cantidad excedida. Solo dispone de ${capsulasDisponiblesLote} cápsulas.`);
        return;
    }

    let data = {
        fechaHora,
        produccionId: loteSeleccionado.id, 
        lote: loteSeleccionado.lote,
        producto: loteSeleccionado.producto,
        lotePT: loteSeleccionado.lotePT || "",
        tipo,
        unidades,
        empaqueTipo,
        empaques,
        restante: capsulasDisponiblesLote - usadoAhora 
    };

    try {
        await addDoc(collection(db, "empaque"), data);

        alert("✅ Empaque registrado exitosamente.");
        limpiarFormulario();
        await cargarLotes();
        cargarEmpaque();
    } catch (e) {
        console.error("Error al guardar empaque: ", e);
    }
};

function vincularEventosBusqueda() {
    let inputBusqueda = document.getElementById("buscarLoteEmpaque");
    let btnBuscar = document.getElementById("btnBuscarEmpaque");

    if (inputBusqueda && !inputBusqueda.dataset.escuchando) {
        inputBusqueda.dataset.escuchando = "true";
        inputBusqueda.addEventListener("input", function(e) {
            textoFiltro = e.target.value.toLowerCase().trim();
            cargarEmpaque();
        });
    }

    if (btnBuscar && !btnBuscar.dataset.escuchando) {
        btnBuscar.dataset.escuchando = "true";
        btnBuscar.addEventListener("click", function() {
            if (inputBusqueda) {
                textoFiltro = inputBusqueda.value.toLowerCase().trim();
                cargarEmpaque();
            }
        });
    }
}

async function cargarEmpaque() {
    let tabla = document.querySelector("#tablaEmpaque tbody");
    if (!tabla) return;
    tabla.innerHTML = "";

    vincularEventosBusqueda();

    registrosEmpaque.sort((a, b) => (b.fechaHora || "").localeCompare(a.fechaHora || ""));

    let registrosFiltrados = registrosEmpaque.filter(d => {
        if (!textoFiltro) return true;

        let cruceID = mapaProduccion[d.produccionId];
        let loteLimpio = (cruceID ? cruceID.lote : d.lote || "").toLowerCase();
        let productoLimpio = (cruceID ? cruceID.producto : d.producto || "").toLowerCase();
        
        let lotePT = (mapaLotesPT[d.produccionId] || (cruceID ? cruceID.lotePT : "") || d.lotePT || "").toLowerCase();
        let fecha = (d.fechaHora || "").replace("T", " ").toLowerCase();
        let infoTipo = formatearTipoEmpaque(d.tipo, d);
        let tipoTexto = `${infoTipo.titulo} ${infoTipo.subtitulo}`.toLowerCase();

        let todoElTextoFila = `${loteLimpio} ${productoLimpio} ${lotePT} ${fecha} ${tipoTexto}`;
        let palabrasClave = textoFiltro.split(" ");
        return palabrasClave.every(palabra => todoElTextoFila.includes(palabra));
    });

    if (registrosFiltrados.length === 0) {
        tabla.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #888; padding: 15px;">No se encontraron registros coincidentes con "${textoFiltro}".</td></tr>`;
        return;
    }

    registrosFiltrados.forEach((d) => {
        let id = d.id;
        let fFormateada = d.fechaHora ? d.fechaHora.replace("T", " ") : "-";
        let cruceID = mapaProduccion[d.produccionId];

        let loteLimpio = cruceID ? cruceID.lote : d.lote;
        let productoLimpio = cruceID ? cruceID.producto : d.producto;
        
        let lotePTVal = (d.produccionId && mapaLotesPT[d.produccionId]) || (cruceID ? cruceID.lotePT : "") || d.lotePT || "";
        
        let badgePTHTML = lotePTVal 
            ? `<span style="background:#198754; color:white; padding:2px 6px; border-radius:4px; font-size:11px; font-weight:bold;">${lotePTVal}</span>` 
            : `<span style="background:#6c757d; color:white; padding:2px 6px; border-radius:4px; font-size:11px; font-weight:bold;">Sin Lote PT</span>`;

        let infoEmpaque = formatearTipoEmpaque(d.tipo, d);
        let unidadTexto = obtenerUnidadEmpaque(d.tipo, d);

        if (idEditar === id) {
            let opcionesLotes = listaProducciones.map(p => 
                `<option value="${p.id}" ${p.id === d.produccionId ? 'selected' : ''}>${p.lote} (Disp: ${p.capsulasActuales})</option>`
            ).join('');

            let esCustom = d.tipo === 'custom' || d.tipo === 'personalizado';

            tabla.innerHTML += `
            <tr style="background-color: #fff3cd;">
                <td><input type="datetime-local" id="editFecha_${id}" value="${d.fechaHora || ''}" style="width:165px;"></td>
                <td><select id="editProdId_${id}" style="width:150px;">${opcionesLotes}</select></td>
                <td>
                    <select id="editTipo_${id}" onchange="let esC = this.value === 'custom' || this.value === 'personalizado'; document.getElementById('editContenedorWrap_${id}').style.display = esC ? 'block' : 'none'; document.getElementById('editUnidadesPersonalizadas_${id}').style.display = esC ? 'block' : 'none';" style="width:110px;">
                        <option value="10" ${d.tipo === '10' ? 'selected' : ''}>Caja x10</option>
                        <option value="3" ${d.tipo === '3' ? 'selected' : ''}>Caja x3</option>
                        <option value="15" ${d.tipo === '15' ? 'selected' : ''}>Bolsa x15</option>
                        <option value="degustacion" ${d.tipo === 'degustacion' ? 'selected' : ''}>Degustación</option>
                        <option value="custom" ${esCustom ? 'selected' : ''}>Personalizado</option>
                    </select>
                    <div id="editContenedorWrap_${id}" style="display:${esCustom ? 'block' : 'none'}; margin-top:4px;">
                        <select id="editTipoContenedor_${id}" style="width:110px;">
                            <option value="bolsa" ${d.empaqueTipo === 'bolsa' ? 'selected' : ''}>Bolsa</option>
                            <option value="caja" ${d.empaqueTipo === 'caja' ? 'selected' : ''}>Caja</option>
                        </select>
                    </div>
                    <input type="number" id="editUnidadesPersonalizadas_${id}" placeholder="Capsulas x empaque" value="${esCustom ? (d.unidades || '') : ''}" style="width:110px; margin-top:4px; display:${esCustom ? 'block' : 'none'};">
                </td>
                <td><input type="number" id="editEmpaques_${id}" value="${d.empaques || 0}" style="width:70px;"></td>
                <td><span style="color:#6c757d; font-size:12px;">Automático al guardar</span></td>
                <td>
                    <button onclick="confirmarActualizacionEmpaque('${id}')" style="background-color:#198754; color:white; padding:4px 8px;">💾</button>
                    <button onclick="cancelarEdicionEmpaque()" style="background-color:#6c757d; color:white; padding:4px 8px;">❌</button>
                </td>
                <td>-</td>
            </tr>
            `;
        } else {
            tabla.innerHTML += `
            <tr>
                <td>${fFormateada}</td>
                <td>
                    <strong>${loteLimpio}</strong> <br>
                    <small style="color:#6c757d;">${productoLimpio}</small> <br>
                    <div style="margin-top:4px;">${badgePTHTML}</div>
                </td>
                <td>
                    <strong>${infoEmpaque.titulo}</strong>
                    ${infoEmpaque.subtitulo ? `<br><small style="color:#6c757d;">${infoEmpaque.subtitulo}</small>` : ''}
                </td>
                <td><b style="color:#198754;">${d.empaques} ${unidadTexto}</b></td>
                <td><span style="color:#6c757d;">Saldo: ${d.restante || 0} ud</span></td>
                <td>
                    <button onclick="activarEdicionEmpaque('${id}')">✏</button>
                    <button onclick="eliminarEmpaque('${id}')">🗑</button>
                </td>
                <td>
                    <button onclick="pdfEmpaque('${fFormateada}', '${loteLimpio}','${productoLimpio}','${infoEmpaque.titulo} ${infoEmpaque.subtitulo}','${d.empaques}','${d.restante}')">📄</button>
                </td>
            </tr>
            `;
        }
    });
}

window.activarEdicionEmpaque = function(id) { idEditar = id; cargarEmpaque(); };
window.cancelarEdicionEmpaque = function() { idEditar = null; cargarEmpaque(); };

window.confirmarActualizacionEmpaque = async function(id) {
    let fechaHora = document.getElementById(`editFecha_${id}`).value;
    let prodIdSel = document.getElementById(`editProdId_${id}`).value;
    let tipo = document.getElementById(`editTipo_${id}`).value;
    let empaques = Number(document.getElementById(`editEmpaques_${id}`).value || 0);
    
    let esCustom = tipo === "custom" || tipo === "personalizado";
    let esDegustacion = tipo === "degustacion";

    let empaqueTipo = esDegustacion 
        ? "degustacion" 
        : (esCustom 
            ? document.getElementById(`editTipoContenedor_${id}`).value 
            : (tipo === "15" ? "bolsa" : "caja"));

    let unidades = esDegustacion 
        ? 1 
        : (esCustom ? Number(document.getElementById(`editUnidadesPersonalizadas_${id}`)?.value || 0) : Number(tipo || 0));

    if (esCustom && unidades <= 0) {
        alert("⚠️ Ingrese manualmente la cantidad de cápsulas por empaque.");
        return;
    }

    let infoProd = mapaProduccion[prodIdSel];
    if (!infoProd) return;

    let gastadoEnOtrosRegistros = 0;
    registrosEmpaque.forEach(r => {
        if (r.produccionId === prodIdSel && r.id !== id) {
            gastadoEnOtrosRegistros += Number(r.empaques || 0) * Number(r.unidades || 0);
        }
    });

    let stockTotalLote = infoProd.capsulasOriginales;
    let stockDisponibleReal = stockTotalLote - gastadoEnOtrosRegistros;
    let consumoNuevo = empaques * unidades;

    if (consumoNuevo > stockDisponibleReal) {
        alert(`❌ No hay suficientes cápsulas en gavetas y no se puede guardar este proceso.\n\nDisponibles en este lote: ${stockDisponibleReal} cápsulas.\nIntentando gastar: ${consumoNuevo} cápsulas.`);
        return;
    }

    let dataActualizada = {
        fechaHora,
        produccionId: infoProd.id,
        lote: infoProd.lote,
        producto: infoProd.producto,
        lotePT: infoProd.lotePT || "",
        tipo,
        unidades,
        empaqueTipo,
        empaques,
        restante: stockDisponibleReal - consumoNuevo
    };

    try {
        await updateDoc(doc(db, "empaque", id), dataActualizada);
        idEditar = null;
        alert("✅ Registro de empaque actualizado correctamente.");
        await cargarLotes();
        cargarEmpaque();
    } catch (e) { 
        console.error("Error al actualizar empaque:", e); 
    }
};

window.eliminarEmpaque = async function(id) {
    if (confirm("¿Seguro que desea remover este empaque?")) {
        try {
            await deleteDoc(doc(db, "empaque", id));
            alert("✅ Registro eliminado.");
            await cargarLotes();
            cargarEmpaque();
        } catch (e) { 
            console.error("Error al eliminar empaque:", e); 
        }
    }
};

window.pdfEmpaque = function(fecha, lote, producto, tipo, empaques, restante) {
    if (!window.jspdf) {
        alert("Error: La librería jsPDF no está disponible.");
        return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text("REPORTE DE EMPAQUE", 20, 20);
    doc.text("Fecha: " + fecha, 20, 35);
    doc.text("Lote: " + lote, 20, 45);
    doc.text("Producto: " + producto, 20, 55);
    doc.text("Tipo de Empaque: " + tipo, 20, 65);
    doc.text("Cantidad Empacada: " + empaques, 20, 75);
    doc.text("Saldo Restante: " + restante, 20, 85);
    doc.save(`empaque_${String(lote).replace(/ /g, "_")}.pdf`);
};

function limpiarFormulario() {
    if (document.getElementById("fechaHora")) document.getElementById("fechaHora").value = "";
    if (document.getElementById("lote")) document.getElementById("lote").value = "";
    if (document.getElementById("producto")) document.getElementById("producto").value = "";
    if (document.getElementById("cantidadEmpacar")) document.getElementById("cantidadEmpacar").value = "";
    if (document.getElementById("disponible")) document.getElementById("disponible").value = "";
    if (document.getElementById("tipoContenedorCustom")) {
        document.getElementById("tipoContenedorCustom").value = "bolsa";
        document.getElementById("tipoContenedorCustom").style.display = "none";
    }
    if (document.getElementById("personalizado")) {
        document.getElementById("personalizado").value = "";
        document.getElementById("personalizado").style.display = "none";
    }
    idEditar = null; 
    loteSeleccionado = null;
    manejarVisibilidadCustom();
}

document.addEventListener("DOMContentLoaded", () => {
    let selectLote = document.getElementById("lote");
    if (selectLote) {
        selectLote.addEventListener("change", actualizarDisponible);
    }

    let selectTipo = document.getElementById("tipo");
    if (selectTipo) {
        selectTipo.addEventListener("change", manejarVisibilidadCustom);
    }

    let selectTipoContenedor = document.getElementById("tipoContenedorCustom");
    if (selectTipoContenedor) {
        selectTipoContenedor.addEventListener("change", manejarVisibilidadCustom);
    }

    ["cantidadEmpacar", "personalizado"].forEach(id => {
        let el = document.getElementById(id);
        if (el) el.addEventListener("input", window.calcularEmpaque);
    });

    init();
});

async function init() {
    await cargarLotes();
    await cargarEmpaque();
}