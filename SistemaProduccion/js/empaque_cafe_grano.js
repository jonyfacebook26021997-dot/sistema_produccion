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
let loteSeleccionado = null;
let pesoDisponibleLote = 0;

let unidadesOriginales = 0;
let loteOriginalId = null;

let mapaLotes = {};
let mapaPesosLotes = {}; 
let listaLotesMateriaPrima = [];
let registrosEmpaque = [];
let textoFiltro = "";

//=========================
// CÁLCULO Y LÓGICA DINÁMICA DE PRESENTACIÓN
//=========================
function inicializarEventosFormulario() {
    const selectTipo = document.getElementById("tipoPresentacion");
    const secPersonalizado = document.getElementById("secPersonalizado");
    const inputUnidades = document.getElementById("cantidadUnidades");
    const inputGramosPers = document.getElementById("gramosPorUnidadPersonalizado");
    const lblCantidad = document.getElementById("lblCantidadUnidades");

    if (selectTipo) {
        selectTipo.addEventListener("change", () => {
            const valor = selectTipo.value;

            if (valor === "personalizado") {
                secPersonalizado.classList.remove("campo-oculto");
                secPersonalizado.style.display = "block";
                if (lblCantidad) lblCantidad.textContent = "Cantidad de Unidades (Bolsas o Cajas)";
            } else if (valor === "degustacion") {
                secPersonalizado.classList.add("campo-oculto");
                secPersonalizado.style.display = "none";
                if (lblCantidad) lblCantidad.textContent = "Cantidad de Muestras / Pruebas";
            } else { // estandar_200g
                secPersonalizado.classList.add("campo-oculto");
                secPersonalizado.style.display = "none";
                if (lblCantidad) lblCantidad.textContent = "Cantidad de Bolsas (200g c/u)";
            }
            recalcularTotales();
        });
    }

    if (inputUnidades) inputUnidades.addEventListener("input", recalcularTotales);
    if (inputGramosPers) inputGramosPers.addEventListener("input", recalcularTotales);
}

function recalcularTotales() {
    const selectTipo = document.getElementById("tipoPresentacion");
    const inputUnidades = document.getElementById("cantidadUnidades");
    const inputGramosPers = document.getElementById("gramosPorUnidadPersonalizado");

    let unidades = Number(inputUnidades?.value) || 0;
    let gramosTotales = 0;

    let tipo = selectTipo?.value || "estandar_200g";

    if (tipo === "estandar_200g") {
        gramosTotales = unidades * 200;
    } else if (tipo === "personalizado") {
        let gramosUnidad = Number(inputGramosPers?.value) || 0;
        gramosTotales = unidades * gramosUnidad;
    } else if (tipo === "degustacion") {
        let gramosUnidad = Number(inputGramosPers?.value) || 100;
        gramosTotales = unidades * gramosUnidad;
    }

    let kilos = gramosTotales / 1000;

    const elemGramos = document.getElementById("totalGramos");
    const elemKilos = document.getElementById("totalKilos");

    if (elemGramos) elemGramos.value = gramosTotales + " g";
    if (elemKilos) elemKilos.value = kilos.toFixed(2) + " kg";
}

//=========================
// CARGAR LOTES Y RENDERIZAR TARJETA AZUL
//=========================
async function cargarLotes() {
    const select = document.getElementById("lote");
    if (!select) return;
    select.innerHTML = "<option value=''>Seleccione lote...</option>";

    try {
        const snap = await getDocs(collection(db, "materiaPrima"));
        mapaLotes = {};
        mapaPesosLotes = {}; 
        listaLotesMateriaPrima = [];

        snap.forEach((docu) => {
            let d = docu.data();
            let disponible = Number(d.pesoDisponible ?? d.pesoTotal ?? 0);
            disponible = Number(disponible.toFixed(2)); // 🔍 Forzar 2 decimales limpios

            let info = {
                id: docu.id,
                loteInterno: d.loteInterno || "Sin código",
                material: d.material || "",
                pesoDisponible: disponible
            };

            listaLotesMateriaPrima.push(info);

            if (d.loteInterno) {
                mapaLotes[docu.id] = d.loteInterno;
                mapaPesosLotes[docu.id] = disponible; 
                mapaPesosLotes[d.loteInterno] = disponible; 
            }

            if (disponible > 0) {
                let option = document.createElement("option");
                option.value = docu.id; 
                option.textContent = `${d.loteInterno || 'Lote'} | ${d.material || ""} | ${disponible.toFixed(2)} kg`; // 🔍 Ajustado a 2 decimales
                select.appendChild(option);
            }
        });

        select.onchange = function () {
            let id = this.value;
            if (!id) return;

            let encontrado = listaLotesMateriaPrima.find(l => l.id === id);
            if (encontrado) {
                loteSeleccionado = id;
                pesoDisponibleLote = encontrado.pesoDisponible;
            }
        };

        renderizarCuadroMateriaPrima();
        aplicarEstiloFormularioVertical();

    } catch (error) {
        console.error("Error al cargar lotes desde Firebase:", error);
    }
}

function renderizarCuadroMateriaPrima() {
    let divTotal = document.querySelector("#cuadroMateriaPrimaDisponible .total-destacado");
    let ulDetalle = document.getElementById("listaMateriaPrimaDetalle");

    if (!divTotal || !ulDetalle) return;

    let totalKilosGral = 0;
    ulDetalle.innerHTML = "";

    let lotesConStock = listaLotesMateriaPrima.filter(p => p.pesoDisponible > 0);

    if (lotesConStock.length === 0) {
        divTotal.textContent = "0.00 kg";
        divTotal.style.color = "#dc3545";
        ulDetalle.innerHTML = "<li style='list-style:none; color:#6c757d;'>No hay café disponible en materia prima actualmente.</li>";
        return;
    }

    lotesConStock.forEach(p => {
        totalKilosGral += p.pesoDisponible;
        let li = document.createElement("li");
        li.innerHTML = `<strong>${p.loteInterno}</strong> (${p.material}): ${p.pesoDisponible.toFixed(2)} kg disponibles.`; // 🔍 Forzado a 2 decimales
        ulDetalle.appendChild(li);
    });

    divTotal.textContent = `${totalKilosGral.toFixed(2)} kg totales disponibles`; // 🔍 Forzado a 2 decimales
    divTotal.style.color = "#0b5ed7";
}

function aplicarEstiloFormularioVertical() {
    const elementosAlinear = ["fechaRegistroManual", "lote", "tipoPresentacion", "tipoEmpaquePersonalizado", "gramosPorUnidadPersonalizado", "nombreOperario", "cantidadUnidades", "totalGramos", "totalKilos"];
    
    elementosAlinear.forEach(id => {
        let el = document.getElementById(id);
        if(el) {
            el.style.display = "block";
            el.style.width = "100%";
            el.style.maxWidth = "400px";
            el.style.marginBottom = "12px";
            el.style.padding = "8px";
            el.style.boxSizing = "border-box";

            let prev = el.previousElementSibling;
            if (prev && prev.tagName === "LABEL") {
                prev.style.display = "block";
                prev.style.marginTop = "10px";
                prev.style.marginBottom = "4px";
                prev.style.fontWeight = "bold";
            }
        }
    });

    const btnGuardar = document.querySelector("button[onclick*='guardarEmpaqueGrano']");
    if(btnGuardar) {
        btnGuardar.style.display = "block";
        btnGuardar.style.marginTop = "15px";
        btnGuardar.style.padding = "10px 20px";
    }
}

//=========================
// GUARDAR REGISTRO Y ACTUALIZAR PESO DISPONIBLE DEL LOTE
//=========================
window.guardarEmpaqueGrano = async function(){
    let unidades = Number(document.getElementById("cantidadUnidades")?.value);
    let operario = document.getElementById("nombreOperario")?.value.trim(); 
    let loteActualId = document.getElementById("lote")?.value;
    let fechaManual = document.getElementById("fechaRegistroManual")?.value;
    let tipoPresentacion = document.getElementById("tipoPresentacion")?.value;

    if(!loteActualId || !operario || unidades <= 0){
        alert("Por favor complete todos los campos requeridos.");
        return;
    }

    let detalleEmpaque = "Bolsa Estándar (200g)";
    let gramosPorUnidad = 200;

    if (tipoPresentacion === "personalizado") {
        let empaque = document.getElementById("tipoEmpaquePersonalizado")?.value;
        gramosPorUnidad = Number(document.getElementById("gramosPorUnidadPersonalizado")?.value) || 0;
        
        if (gramosPorUnidad <= 0) {
            alert("Por favor ingrese los gramos por unidad para la opción personalizada.");
            return;
        }
        detalleEmpaque = `${empaque} Personalizada (${gramosPorUnidad}g)`;
    } else if (tipoPresentacion === "degustacion") {
        gramosPorUnidad = 100;
        detalleEmpaque = "☕ Degustación / Muestra Interna";
    }

    if (!fechaManual) {
        let ahora = new Date();
        fechaManual = ahora.getFullYear() + "-" + 
            String(ahora.getMonth() + 1).padStart(2, '0') + "-" + 
            String(ahora.getDate()).padStart(2, '0');
    }

    let gramosConsumidos = unidades * gramosPorUnidad;
    let kilosConsumidos = Number((gramosConsumidos / 1000).toFixed(2)); // 🔍 Redondeo estricto a 2 decimales

    if(kilosConsumidos > pesoDisponibleLote){
        alert(`❌ Stock insuficiente en Materia Prima. Disponible: ${pesoDisponibleLote.toFixed(2)} kg.`);
        return;
    }

    let loteInternoTexto = mapaLotes[loteActualId] || "";

    let data = {
        fechaHoraRegistro: fechaManual, 
        lote: loteActualId,
        loteInterno: loteInternoTexto,
        tipoPresentacion: tipoPresentacion,
        detalleEmpaque: detalleEmpaque,
        operario: operario,
        cantidadUnidades: unidades,
        unidadesDisponibles: unidades, 
        totalGramos: gramosConsumidos,
        totalKilos: kilosConsumidos
    };

    try {
        await addDoc(collection(db, "empaqueCafeGrano"), data);

        let nuevoStock = Number((pesoDisponibleLote - kilosConsumidos).toFixed(2));
        await updateDoc(doc(db, "materiaPrima", loteActualId), { pesoDisponible: nuevoStock });
        
        limpiar();
        await cargarLotes();
        await cargarEmpaqueGrano();
        alert("✅ Registro guardado con éxito y stock descontado.");

    } catch (e) {
        console.error(e);
        alert("Ocurrió un error al procesar el empaque.");
    }
};

//=========================
// BÚSQUEDA Y RENDERIZADO
//=========================
function vincularEventosBusqueda() {
    let inputBusqueda = document.getElementById("buscarLoteEmpaque");
    let btnBuscar = document.getElementById("btnBuscarEmpaque");

    if (inputBusqueda && !inputBusqueda.dataset.escuchando) {
        inputBusqueda.dataset.escuchando = "true";
        inputBusqueda.addEventListener("input", function(e) {
            textoFiltro = e.target.value.toLowerCase().trim();
            cargarEmpaqueGrano();
        });
    }

    if (btnBuscar && !btnBuscar.dataset.escuchando) {
        btnBuscar.dataset.escuchando = "true";
        btnBuscar.addEventListener("click", function() {
            if (inputBusqueda) {
                textoFiltro = inputBusqueda.value.toLowerCase().trim();
                cargarEmpaqueGrano();
            }
        });
    }
}

window.cargarEmpaqueGrano = async function(){
    let tabla = document.getElementById("tbodyEmpaqueGrano");
    if(!tabla) return;
    tabla.innerHTML = "";

    vincularEventosBusqueda();

    try {
        await cargarLotes();

        const querySnapshot = await getDocs(collection(db, "empaqueCafeGrano"));
        registrosEmpaque = [];

        querySnapshot.forEach((docu) => {
            registrosEmpaque.push({ id: docu.id, ...docu.data() });
        });

        registrosEmpaque.sort((a, b) => (b.fechaHoraRegistro || "").localeCompare(a.fechaHoraRegistro || ""));

        let registrosFiltrados = registrosEmpaque.filter(d => {
            if (!textoFiltro) return true;

            let nombreLote = (d.loteInterno || mapaLotes[d.lote] || d.lote || "").toLowerCase();
            let operario = (d.operario || "").toLowerCase();
            let detalle = (d.detalleEmpaque || "").toLowerCase();
            let fecha = (d.fechaHoraRegistro || "").toLowerCase();

            let todoElTextoFila = `${nombreLote} ${operario} ${detalle} ${fecha}`;
            let palabrasClave = textoFiltro.split(" ");
            return palabrasClave.every(palabra => todoElTextoFila.includes(palabra));
        });

        if (registrosFiltrados.length === 0) {
            tabla.innerHTML = `<tr><td colspan="10" style="text-align: center; color: #888; padding: 15px;">No se encontraron registros coincidentes.</td></tr>`;
            return;
        }

        registrosFiltrados.forEach((d) => {
            let id = d.id;
            let nombreLote = d.loteInterno || mapaLotes[d.lote] || d.lote || "-";
            
            let pesoRealDisponible = mapaPesosLotes[d.lote] ?? mapaPesosLotes[d.loteInterno] ?? 0;
            let pesoFormateado = Number(pesoRealDisponible).toFixed(2);

            let badgeColor = pesoRealDisponible > 0 ? "#d1e7dd" : "#f8d7da";
            let textColor = pesoRealDisponible > 0 ? "#0f5132" : "#842029";
            let textoEstado = pesoRealDisponible > 0 ? `🟢 Stock: ${pesoFormateado} kg` : `🔴 Agotado (0 kg)`;

            let totalKilosFormateado = Number(d.totalKilos || 0).toFixed(2); // 🔍 Formateado a 2 decimales

            if (idEditar === id) {
                let opcionesLote = listaLotesMateriaPrima.map(l => 
                    `<option value="${l.id}" ${l.id === d.lote ? 'selected' : ''}>${l.loteInterno}</option>`
                ).join('');

                tabla.innerHTML += `
                <tr style="background-color: #fff3cd;">
                    <td><input type="date" id="editFecha_${id}" value="${d.fechaHoraRegistro || ''}" style="width:130px;"></td>
                    <td>
                        <select id="editLote_${id}" style="width:120px;">
                            ${opcionesLote}
                        </select>
                    </td>
                    <td><input type="text" id="editDetalle_${id}" value="${d.detalleEmpaque || ''}" style="width:140px;"></td>
                    <td><input type="text" id="editOperario_${id}" value="${d.operario || ''}" style="width:120px;"></td>
                    <td><input type="number" id="editUnidades_${id}" value="${d.cantidadUnidades || 0}" style="width:70px;"></td>
                    <td>${d.totalGramos || 0} g</td>
                    <td>${totalKilosFormateado} kg</td>
                    <td style="background-color: ${badgeColor}; color: ${textColor}; font-weight: bold;">
                        ${textoEstado}
                    </td>
                    <td>
                        <button onclick="confirmarActualizacionLinea('${id}')" style="background-color:#198754; color:white;">💾</button>
                        <button onclick="cancelarEdicionLinea()" style="background-color:#6c757d; color:white;">❌</button>
                    </td>
                    <td>-</td>
                </tr>
                `;
            } else {
                tabla.innerHTML += `
                <tr>
                    <td>${d.fechaHoraRegistro || "-"}</td>
                    <td><strong style="color: #0d6efd;">${nombreLote}</strong></td>
                    <td><span style="background:#e9ecef; padding:3px 8px; border-radius:4px; font-size:12px;">${d.detalleEmpaque || "Estándar"}</span></td>
                    <td>${d.operario || "-"}</td>
                    <td><b style="color:#198754;">${d.cantidadUnidades || 0} ud</b></td>
                    <td>${d.totalGramos || 0} g</td>
                    <td>${totalKilosFormateado} kg</td>
                    <td style="background-color: ${badgeColor}; color: ${textColor}; font-weight: bold;">
                        ${textoEstado}
                    </td>
                    <td>
                        <button onclick="editarEmpaqueLinea('${id}', '${d.lote}', ${d.cantidadUnidades || 0})">✏</button>
                        <button onclick="eliminarEmpaque('${id}', '${d.lote}', ${d.cantidadUnidades || 0})">🗑</button>
                    </td>
                    <td>
                        <button onclick="generarPDF('${nombreLote}', '${d.operario || ''}', ${d.cantidadUnidades || 0}, '${d.totalGramos || 0}', '${totalKilosFormateado}', '${d.fechaHoraRegistro || ''}')">📄</button>
                    </td>
                </tr>
                `;
            }
        });
    } catch (error) {
        console.error("Error al obtener datos de Firebase:", error);
    }
};

//=========================
// EDICIÓN EN LÍNEA Y ACCIONES
//=========================
window.editarEmpaqueLinea = function(id, loteId, unidades) {
    idEditar = id;
    loteOriginalId = loteId;
    unidadesOriginales = unidades;
    cargarEmpaqueGrano();
};

window.cancelarEdicionLinea = function() {
    idEditar = null;
    cargarEmpaqueGrano();
};

window.confirmarActualizacionLinea = async function(id) {
    if (!confirm("¿Quieres actualizar este registro? Se sincronizará el stock en Materia Prima.")) return;

    let nuevaFecha = document.getElementById(`editFecha_${id}`)?.value;
    let nuevoLoteId = document.getElementById(`editLote_${id}`)?.value;
    let nuevoDetalle = document.getElementById(`editDetalle_${id}`)?.value;
    let nuevoOperario = document.getElementById(`editOperario_${id}`)?.value.trim();
    let nuevasUnidades = Number(document.getElementById(`editUnidades_${id}`)?.value);

    if (!nuevoLoteId || !nuevoOperario || nuevasUnidades <= 0) {
        alert("Por favor complete los campos correctamente.");
        return;
    }

    try {
        let registroAntiguo = registrosEmpaque.find(r => r.id === id);
        if (!registroAntiguo) {
            alert("No se encontró el registro original.");
            return;
        }

        let loteAntiguoId = registroAntiguo.lote;
        let kilosAntiguos = registroAntiguo.totalKilos || 0;

        let gramosPorUnidadOriginal = registroAntiguo.totalGramos ? (registroAntiguo.totalGramos / registroAntiguo.cantidadUnidades) : 200;
        let nuevosGramos = nuevasUnidades * gramosPorUnidadOriginal;
        let nuevosKilos = Number((nuevosGramos / 1000).toFixed(2)); // 🔍 Redondeo a 2 decimales

        let snapMateria = await getDocs(collection(db, "materiaPrima"));
        let stockMap = {};
        snapMateria.forEach(docM => {
            let datos = docM.data();
            let disp = datos.pesoDisponible ?? datos.pesoTotal ?? 0;
            stockMap[docM.id] = Number(Number(disp).toFixed(2));
        });

        let stockDisponibleNuevoLote = stockMap[nuevoLoteId] || 0;
        let stockMaximoPermitido = (nuevoLoteId === loteAntiguoId) 
            ? Number((stockDisponibleNuevoLote + kilosAntiguos).toFixed(2)) 
            : stockDisponibleNuevoLote;

        if (nuevosKilos > stockMaximoPermitido) {
            alert(`❌ Stock insuficiente en el lote seleccionado. Disponible real: ${stockMaximoPermitido.toFixed(2)} kg.`);
            return;
        }

        if (loteAntiguoId === nuevoLoteId) {
            let diferenciaKilos = Number((nuevosKilos - kilosAntiguos).toFixed(2));
            let stockActualLote = stockMap[loteAntiguoId];
            let stockFinal = Number((stockActualLote - diferenciaKilos).toFixed(2));

            await updateDoc(doc(db, "materiaPrima", loteAntiguoId), { pesoDisponible: stockFinal });
        } else {
            let stockViejoLote = stockMap[loteAntiguoId] || 0;
            let stockViejoRestaurado = Number((stockViejoLote + kilosAntiguos).toFixed(2));
            await updateDoc(doc(db, "materiaPrima", loteAntiguoId), { pesoDisponible: stockViejoRestaurado });

            let stockNuevoLoteActual = stockMap[nuevoLoteId] || 0;
            let stockNuevoDescontado = Number((stockNuevoLoteActual - nuevosKilos).toFixed(2));
            await updateDoc(doc(db, "materiaPrima", nuevoLoteId), { pesoDisponible: stockNuevoDescontado });
        }

        let nuevoLoteInternoTexto = mapaLotes[nuevoLoteId] || "";

        let dataActualizada = {
            fechaHoraRegistro: nuevaFecha,
            lote: nuevoLoteId,
            loteInterno: nuevoLoteInternoTexto,
            detalleEmpaque: nuevoDetalle,
            operario: nuevoOperario,
            cantidadUnidades: nuevasUnidades,
            unidadesDisponibles: nuevasUnidades,
            totalGramos: nuevosGramos,
            totalKilos: nuevosKilos
        };

        await updateDoc(doc(db, "empaqueCafeGrano", id), dataActualizada);

        idEditar = null;
        alert("✅ Registro actualizado correctamente y stock sincronizado.");
        
        await cargarLotes();
        await cargarEmpaqueGrano();

    } catch (e) {
        console.error(e);
        alert("Ocurrió un error al actualizar la fila.");
    }
};

window.eliminarEmpaque = async function(id, loteId, unidades) {
    if(!confirm("¿Está seguro de eliminar este registro?\nEsto devolverá el café al stock de Materia Prima.")) return;

    try {
        let regAEliminar = registrosEmpaque.find(r => r.id === id);
        if (regAEliminar && regAEliminar.lote && regAEliminar.totalKilos) {
            let snapMateria = await getDocs(collection(db, "materiaPrima"));
            snapMateria.forEach(async (docM) => {
                if (docM.id === regAEliminar.lote) {
                    let datosM = docM.data();
                    let pesoAct = Number(datosM.pesoDisponible ?? datosM.pesoTotal ?? 0);
                    let pesoRestaurado = Number((pesoAct + regAEliminar.totalKilos).toFixed(2)); // 🔍 Redondeo a 2 decimales
                    await updateDoc(doc(db, "materiaPrima", docM.id), { pesoDisponible: pesoRestaurado });
                }
            });
        }

        await deleteDoc(doc(db, "empaqueCafeGrano", id));
        alert("✅ Registro eliminado correctamente y stock devuelto a materia prima.");
        
        await cargarLotes();
        await cargarEmpaqueGrano();
    } catch(e) { console.error(e); }
};

window.generarPDF = function(lote, operario, unidades, gramos, kilos, fecha) {
    if (!window.jspdf) {
        alert("La librería jsPDF no está cargada.");
        return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text("REPORTE - EMPAQUE CAFÉ EN GRANO", 20, 20);
    doc.text("Fecha Registro: " + fecha, 20, 35);
    doc.text("Lote Origen: " + lote, 20, 45);
    doc.text("Producto / Operario: " + operario, 20, 55);
    doc.text("Cantidad Unidades: " + unidades, 20, 65);
    doc.text("Total Gramos: " + gramos, 20, 75);
    doc.text("Total Kilos: " + kilos, 20, 85);
    doc.save("Empaque_" + lote + ".pdf");
};

function limpiar(){
    if (document.getElementById("lote")) document.getElementById("lote").value = "";
    if (document.getElementById("nombreOperario")) document.getElementById("nombreOperario").value = "";
    if (document.getElementById("cantidadUnidades")) document.getElementById("cantidadUnidades").value = "";
    if (document.getElementById("gramosPorUnidadPersonalizado")) document.getElementById("gramosPorUnidadPersonalizado").value = "";
    if (document.getElementById("totalGramos")) document.getElementById("totalGramos").value = "";
    if (document.getElementById("totalKilos")) document.getElementById("totalKilos").value = "";
    if (document.getElementById("fechaRegistroManual")) document.getElementById("fechaRegistroManual").value = "";
    
    const secPers = document.getElementById("secPersonalizado");
    if(secPers) secPers.style.display = "none";
    
    idEditar = null;
}

async function iniciar() {
    inicializarEventosFormulario();
    await cargarLotes();
    await cargarEmpaqueGrano();
}

iniciar();