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
let loteOriginalId = null;
let cafeOriginalKg = 0;

let mapaLotes = {};
let listaLotesMateriaPrima = [];
let registrosProduccion = [];

// Valores por defecto del encabezado para Producción
let encabezadoGuardado = {
    titulo: "REGISTRO Y CONTROL DE PRODUCCIÓN",
    codigo: "REGP10",
    version: "001",
    elaboracion: "01/02/2024"
};

//=========================
// GESTIÓN DEL ENCABEZADO EDITABLE
//=========================
function inicializarEncabezado() {
    const guardadoLocal = localStorage.getItem("encabezado_produccion");
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

    localStorage.setItem("encabezado_produccion", JSON.stringify(encabezadoGuardado));

    aplicarValoresEncabezado();
    cerrarModoEdicionEncabezado();
    alert("✅ Cambios del encabezado guardados correctamente.");
};

window.cancelarEdicionEncabezado = function() {
    aplicarValoresEncabezado();
    cerrarModoEdicionEncabezado();
};

//=========================
// CÁLCULO EN TIEMPO REAL (Neto = Cápsulas - Desechos)
//=========================
function asignarCalculoNeto(idCapsulas, idDesechos, idNeto) {
    const caps = document.getElementById(idCapsulas);
    const dese = document.getElementById(idDesechos);
    if (caps && dese) {
        const calcular = () => {
            let c = Number(caps.value) || 0;
            let d = Number(dese.value) || 0;
            document.getElementById(idNeto).value = c - d;
        };
        caps.addEventListener("input", calcular);
        dese.addEventListener("input", calcular);
    }
}
asignarCalculoNeto("capsulas", "desechos", "neto");

//=========================
// CARGAR LOTES DESDE MATERIA PRIMA
//=========================
async function cargarLotes() {
    const select = document.getElementById("lote");
    if (!select) return;
    select.innerHTML = "<option value=''>Seleccione lote</option>";

    const snap = await getDocs(collection(db, "materiaPrima"));
    mapaLotes = {};
    listaLotesMateriaPrima = [];

    snap.forEach((docu) => {
        let d = docu.data();
        let disponible = Number(d.pesoDisponible ?? d.pesoTotal) || 0;
        disponible = Number(disponible.toFixed(2));

        listaLotesMateriaPrima.push({
            id: docu.id,
            loteInterno: d.loteInterno,
            material: d.material || "",
            pesoDisponible: disponible
        });

        if (d.loteInterno) {
            mapaLotes[docu.id] = d.loteInterno;
        }

        if (d.loteInterno && disponible > 0) {
            let option = document.createElement("option");
            option.value = docu.id;
            option.textContent = `${d.loteInterno} | ${d.material || ""} | ${disponible.toFixed(2)} kg`;
            select.appendChild(option);
        }
    });
}

//=========================
// GUARDAR NUEVO REGISTRO
//=========================
window.guardarProduccion = async function() {
    if (idEditar !== null) {
        alert("Por favor, termine de editar la fila activa antes de crear una nueva.");
        return;
    }

    let fechaInicio = document.getElementById("fechaInicio").value;
    let fechaFin = document.getElementById("fechaFin").value;
    let loteId = document.getElementById("lote").value;
    let producto = document.getElementById("producto").value.trim();
    let cafe = Number(document.getElementById("cafe").value) || 0;
    let molienda = document.getElementById("molienda").value;
    let arranque = document.getElementById("arranque").value;
    let finalMaquina = document.getElementById("final").value;
    let capsulas = Number(document.getElementById("capsulas").value) || 0;
    let desechos = Number(document.getElementById("desechos").value) || 0;
    let neto = Number(document.getElementById("neto").value) || 0;

    if (!fechaInicio || !fechaFin || !loteId || !producto || cafe <= 0) {
        alert("Por favor, complete todos los campos obligatorios.");
        return;
    }

    let loteSel = listaLotesMateriaPrima.find(l => l.id === loteId);
    if (loteSel && cafe > loteSel.pesoDisponible) {
        alert(`❌ Stock insuficiente en Materia Prima. Disponible: ${loteSel.pesoDisponible.toFixed(2)} kg.`);
        return;
    }

    let data = {
        fechaInicio,
        fechaFin,
        lote: loteId,
        producto,
        cafe,
        molienda,
        arranque,
        final: finalMaquina,
        capsulas,
        desechos,
        neto
    };

    try {
        await addDoc(collection(db, "produccion"), data);
        
        let nuevoStock = Number((loteSel.pesoDisponible - cafe).toFixed(2));
        await updateDoc(doc(db, "materiaPrima", loteId), { pesoDisponible: nuevoStock });

        alert("✅ Registro de producción guardado con éxito.");
        limpiarFormulario();
        await cargarLotes();
        cargarProduccion();
    } catch (e) {
        console.error(e);
        alert("Error al guardar la producción.");
    }
};

//=========================
// CARGAR TABLA CON EDICIÓN EN LÍNEA
//=========================
window.cargarProduccion = async function() {
    let tabla = document.getElementById("tbodyProduccion");
    if (!tabla) return;
    tabla.innerHTML = "";

    let inputBuscar = document.getElementById("buscarProduccion");
    if (inputBuscar) inputBuscar.value = "";

    try {
        const querySnapshot = await getDocs(collection(db, "produccion"));
        let total = 0;
        registrosProduccion = [];

        querySnapshot.forEach((docu) => {
            registrosProduccion.push({ id: docu.id, ...docu.data() });
        });

        // Ordenar descendentemente por Fecha de Inicio
        registrosProduccion.sort((a, b) => (b.fechaInicio || "").localeCompare(a.fechaInicio || ""));

        registrosProduccion.forEach((d) => {
            let id = d.id;
            total++;

            let nombreLote = mapaLotes[d.lote] || d.lote || "-";
            let fInicio = d.fechaInicio ? d.fechaInicio.replace("T", " ") : "-";
            let fFin = d.fechaFin ? d.fechaFin.replace("T", " ") : "-";
            let cafeFormateado = Number(d.cafe || 0).toFixed(2);

            if (idEditar === id) {
                let opcionesLote = listaLotesMateriaPrima.map(l => 
                    `<option value="${l.id}" ${l.id === d.lote ? 'selected' : ''}>${l.loteInterno} (Disp: ${l.pesoDisponible.toFixed(2)} kg)</option>`
                ).join('');

                tabla.innerHTML += `
                <tr style="background-color: #fff3cd;">
                    <td><input type="datetime-local" id="editFInicio_${id}" value="${d.fechaInicio || ''}" style="width:165px;"></td>
                    <td><input type="datetime-local" id="editFFin_${id}" value="${d.fechaFin || ''}" style="width:165px;"></td>
                    <td><select id="editLote_${id}" style="width:130px;">${opcionesLote}</select></td>
                    <td><input type="text" id="editProducto_${id}" value="${d.producto || ''}" style="width:110px;"></td>
                    <td><input type="number" id="editCafe_${id}" value="${d.cafe || 0}" style="width:70px;"></td>
                    <td><input type="number" id="editMolienda_${id}" value="${d.molienda || ''}" style="width:70px;"></td>
                    <td><input type="number" id="editArranque_${id}" value="${d.arranque || ''}" style="width:70px;"></td>
                    <td><input type="number" id="editFinal_${id}" value="${d.final || ''}" style="width:70px;"></td>
                    <td><input type="number" id="editCapsulas_${id}" value="${d.capsulas || 0}" style="width:70px;"></td>
                    <td><input type="number" id="editDesechos_${id}" value="${d.desechos || 0}" style="width:70px;"></td>
                    <td><input type="number" id="editNeto_${id}" value="${d.neto || 0}" readonly style="width:70px; background:#eee;"></td>
                    <td>
                        <button onclick="confirmarActualizacionProd('${id}')" style="background-color:#198754; color:white; padding:4px 8px;">💾</button>
                        <button onclick="cancelarEdicionProd()" style="background-color:#6c757d; color:white; padding:4px 8px;">❌</button>
                    </td>
                    <td>-</td>
                </tr>
                `;
                setTimeout(() => asignarCalculoNeto(`editCapsulas_${id}`, `editDesechos_${id}`, `editNeto_${id}`), 50);
            } else {
                tabla.innerHTML += `
                <tr>
                    <td>${fInicio}</td>
                    <td>${fFin}</td>
                    <td>${nombreLote}</td>
                    <td>${d.producto}</td>
                    <td>${cafeFormateado} kg</td>
                    <td>${d.molienda}</td>
                    <td>${d.arranque}</td>
                    <td>${d.final}</td>
                    <td>${d.capsulas} ud</td>
                    <td>${d.desechos}</td>
                    <td>${d.neto}</td>
                    <td>
                        <button onclick="activarEdicionProd('${id}', '${d.lote}', ${d.cafe})">✏</button>
                        <button onclick="eliminarProduccion('${id}', '${d.lote}', ${d.cafe})">🗑</button>
                    </td>
                    <td>
                        <button onclick="generarPDFProdPorId('${id}')">📄</button>
                    </td>
                </tr>
                `;
            }
        });

        let totalReg = document.getElementById("totalRegistros");
        if (totalReg) totalReg.innerText = `Total registros: ${total}`;

        actualizarDatalistPdfProduccion();
    } catch (e) { console.error(e); }
};

//=========================
// ACTUALIZAR DATALIST DE PDF DE PRODUCCIÓN CON BUSCADOR
//=========================
function actualizarDatalistPdfProduccion() {
    let datalist = document.getElementById("listaPdfProduccion");
    if (!datalist) return;

    datalist.innerHTML = "";
    registrosProduccion.forEach(r => {
        let nombreLote = mapaLotes[r.lote] || r.lote || 'N/A';
        let fechaCorta = r.fechaInicio ? r.fechaInicio.replace("T", " ") : 'S/F';
        let option = document.createElement("option");
        option.value = `Lote: ${nombreLote} - ${r.producto || ''} (${fechaCorta})`;
        option.dataset.id = r.id;
        datalist.appendChild(option);
    });
}

window.activarEdicionProd = function(id, loteId, cafeKg) {
    idEditar = id;
    loteOriginalId = loteId;
    cafeOriginalKg = Number(cafeKg) || 0;
    cargarProduccion();
};

window.cancelarEdicionProd = function() {
    idEditar = null;
    cargarProduccion();
};

//=========================
// CONFIRMAR ACTUALIZACIÓN Y AJUSTAR MATERIA PRIMA (EN CASCADA)
//=========================
window.confirmarActualizacionProd = async function(id) {
    if (!confirm("¿Quieres actualizar este registro? Se ajustará la materia prima y se propagará el cambio de producto en cascada.")) return;

    let fechaInicio = document.getElementById(`editFInicio_${id}`).value;
    let fechaFin = document.getElementById(`editFFin_${id}`).value;
    let nuevoLoteId = document.getElementById(`editLote_${id}`).value;
    let producto = document.getElementById(`editProducto_${id}`).value.trim();
    let nuevoCafe = Number(document.getElementById(`editCafe_${id}`).value) || 0;
    let molienda = document.getElementById(`editMolienda_${id}`).value;
    let arranque = document.getElementById(`editArranque_${id}`).value;
    let finalMaquina = document.getElementById(`editFinal_${id}`).value;
    let capsulas = Number(document.getElementById(`editCapsulas_${id}`).value) || 0;
    let desechos = Number(document.getElementById(`editDesechos_${id}`).value) || 0;
    let neto = Number(document.getElementById(`editNeto_${id}`).value) || 0;

    if (!fechaInicio || !fechaFin || !nuevoLoteId || !producto || nuevoCafe <= 0) {
        alert("Complete todos los campos de manera correcta.");
        return;
    }

    try {
        const snapMateria = await getDocs(collection(db, "materiaPrima"));
        let mapaStockMateria = {};
        snapMateria.forEach(docM => {
            let disp = Number(docM.data().pesoDisponible ?? docM.data().pesoTotal) || 0;
            mapaStockMateria[docM.id] = Number(disp.toFixed(2));
        });

        if (nuevoLoteId === loteOriginalId) {
            let stockActualLote = mapaStockMateria[nuevoLoteId] || 0;
            let diferencia = nuevoCafe - cafeOriginalKg; 

            if (diferencia > stockActualLote) {
                alert(`❌ Stock insuficiente en el lote. Disponible adicional: ${stockActualLote.toFixed(2)} kg.`);
                return;
            }
            let stockFinal = Number((stockActualLote - diferencia).toFixed(2));
            await updateDoc(doc(db, "materiaPrima", nuevoLoteId), { 
                pesoDisponible: stockFinal 
            });
        } else {
            let stockLoteNuevo = mapaStockMateria[nuevoLoteId] || 0;
            if (nuevoCafe > stockLoteNuevo) {
                alert(`❌ El nuevo lote no tiene suficiente stock. Disponible: ${stockLoteNuevo.toFixed(2)} kg.`);
                return;
            }
            let stockLoteViejo = mapaStockMateria[loteOriginalId] || 0;
            let stockViejoRestaurado = Number((stockLoteViejo + cafeOriginalKg).toFixed(2));
            await updateDoc(doc(db, "materiaPrima", loteOriginalId), { 
                pesoDisponible: stockViejoRestaurado 
            });

            let stockNuevoDescontado = Number((stockLoteNuevo - nuevoCafe).toFixed(2));
            await updateDoc(doc(db, "materiaPrima", nuevoLoteId), { 
                pesoDisponible: stockNuevoDescontado 
            });
        }

        await updateDoc(doc(db, "produccion", id), {
            fechaInicio, fechaFin, lote: nuevoLoteId, producto, cafe: nuevoCafe, molienda, arranque, final: finalMaquina, capsulas, desechos, neto
        });

        const [snapCalidad, snapEmpaque, snapInventario] = await Promise.all([
            getDocs(collection(db, "calidad")),
            getDocs(collection(db, "empaque")),
            getDocs(collection(db, "inventario_terminado"))
        ]);

        let batchUpdates = [];

        snapCalidad.forEach(docC => {
            let dataC = docC.data();
            if (dataC.produccionId === id || dataC.loteId === id) {
                batchUpdates.push(updateDoc(doc(db, "calidad", docC.id), { producto: producto }));
            }
        });

        snapEmpaque.forEach(docE => {
            let dataE = docE.data();
            if (dataE.produccionId === id) {
                batchUpdates.push(updateDoc(doc(db, "empaque", docE.id), { producto: producto }));
            }
        });

        snapInventario.forEach(docI => {
            let dataI = docI.data();
            if (dataI.produccionId === id) {
                batchUpdates.push(updateDoc(doc(db, "inventario_terminado", docI.id), { variedad: producto }));
            }
        });

        if (batchUpdates.length > 0) {
            await Promise.all(batchUpdates);
        }

        idEditar = null;
        alert("✅ Registro actualizado y nombre propagado correctamente en cascada.");
        await cargarLotes();
        cargarProduccion();
    } catch (e) { 
        console.error(e);
        alert("Hubo un error al guardar los cambios.");
    }
};

//=========================
// ELIMINAR Y DEVOLVER STOCK (EN CASCADA)
//=========================
window.eliminarProduccion = async function(id, loteId, cafeKg) {
    if (!confirm("¿Está seguro de eliminar esta producción?\nSe devolverá el café consumido a Materia Prima en cascada.")) return;

    try {
        const snapMateria = await getDocs(collection(db, "materiaPrima"));
        for (let docM of snapMateria.docs) {
            if (docM.id === loteId) {
                let stockActual = Number(docM.data().pesoDisponible ?? docM.data().pesoTotal) || 0;
                let cafeDevolver = Number(cafeKg) || 0;
                let stockDevueltoFinal = Number((stockActual + cafeDevolver).toFixed(2));
                await updateDoc(doc(db, "materiaPrima", loteId), { 
                    pesoDisponible: stockDevueltoFinal 
                });
                break;
            }
        }

        await deleteDoc(doc(db, "produccion", id));
        alert("✅ Registro eliminado y stock devuelto a materia prima.");
        await cargarLotes();
        cargarProduccion();
    } catch (e) { 
        console.error(e); 
    }
};

//=========================
// BUSCADOR / HISTORIAL (Global de un solo campo)
//=========================
window.buscarProduccion = async function() {
    let inputEl = document.getElementById("buscarProduccion");
    if (!inputEl) return;
    let queryText = inputEl.value.toLowerCase().trim();

    let tabla = document.getElementById("tbodyProduccion");
    if (!tabla) return;
    tabla.innerHTML = "";
    let contador = 0;

    const snap = await getDocs(collection(db, "produccion"));
    let registros = [];
    snap.forEach(docu => registros.push({ id: docu.id, ...docu.data() }));

    registros.sort((a, b) => (b.fechaInicio || "").localeCompare(a.fechaInicio || ""));

    registros.forEach((d) => {
        let fInicio = d.fechaInicio ? d.fechaInicio.replace("T", " ") : "-";
        let fFin = d.fechaFin ? d.fechaFin.replace("T", " ") : "-";
        let nombreLote = mapaLotes[d.lote] || d.lote || "";
        let cafeFormateado = Number(d.cafe || 0).toFixed(2);
        
        let textoCompleto = `${fInicio} ${fFin} ${nombreLote} ${d.producto} ${cafeFormateado} ${d.molienda} ${d.arranque} ${d.final} ${d.capsulas} ${d.desechos} ${d.neto}`.toLowerCase();

        let cumple = queryText === "" || textoCompleto.includes(queryText);

        if (cumple) {
            contador++;
            tabla.innerHTML += `
            <tr>
                <td>${fInicio}</td>
                <td>${fFin}</td>
                <td>${nombreLote}</td>
                <td>${d.producto}</td>
                <td>${cafeFormateado} kg</td>
                <td>${d.molienda}</td>
                <td>${d.arranque}</td>
                <td>${d.final}</td>
                <td>${d.capsulas} ud</td>
                <td>${d.desechos}</td>
                <td>${d.neto}</td>
                <td>
                    <button onclick="activarEdicionProd('${d.id}', '${d.lote}', ${d.cafe})">✏</button>
                    <button onclick="eliminarProduccion('${d.id}', '${d.lote}', ${d.cafe})">🗑</button>
                </td>
                <td>
                    <button onclick="generarPDFProdPorId('${d.id}')">📄</button>
                </td>
            </tr>`;
        }
    });

    let totalReg = document.getElementById("totalRegistros");
    if (totalReg) totalReg.innerText = `Total registros: ${contador}`;
};

//=========================
// GENERADOR PDF COMPLETO (CAPTURA EL ENCABEZADO EXACTAMENTE COMO EN PANTALLA)
//=========================
window.generarPDFProdPorId = async function(id) {
    let registro = registrosProduccion.find(r => r.id === id);
    if (!registro) {
        alert("No se encontró el registro.");
        return;
    }

    if (!window.jspdf) {
        alert("Error: La librería jsPDF no está disponible.");
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

    let nombreLote = mapaLotes[registro.lote] || registro.lote || "-";
    let fInicio = registro.fechaInicio ? registro.fechaInicio.replace("T", " ") : "-";
    let fFin = registro.fechaFin ? registro.fechaFin.replace("T", " ") : "-";
    let cafeFormateado = Number(registro.cafe || 0).toFixed(2);

    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("DETALLE DE PRODUCCIÓN", 20, y);
    y += 10;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");

    let salto = 8;

    doc.text("• Fecha y Hora de Inicio: " + fInicio, 20, y); y += salto;
    doc.text("• Fecha y Hora de Fin: " + fFin, 20, y); y += salto;
    doc.text("• Lote Disponible (Materia Prima): " + nombreLote, 20, y); y += salto;
    doc.text("• Producto: " + (registro.producto || "-"), 20, y); y += salto;
    doc.text("• Total Café en Grano: " + cafeFormateado + " kg", 20, y); y += salto;
    doc.text("• Punto de Molienda: " + (registro.molienda || "-"), 20, y); y += salto;
    doc.text("• Arranque Máquina: " + (registro.arranque || "-"), 20, y); y += salto;
    doc.text("• Arranque Final Máquina: " + (registro.final || "-"), 20, y); y += salto;
    doc.text("• Total Cápsulas: " + (registro.capsulas || 0) + " ud", 20, y); y += salto;
    doc.text("• Desechos: " + (registro.desechos || 0), 20, y); y += salto;
    doc.text("• Total Neto: " + (registro.neto || 0) + " ud", 20, y);

    doc.save("Produccion_" + String(nombreLote).replace(/ /g, "_") + ".pdf");
};

//=========================
// EXPORTAR PDF DESDE EL INPUT CON BUSCADOR / DATALIST
//=========================
window.exportarPdfProduccionSeleccionado = function() {
    let inputPdf = document.getElementById("inputPdfProduccion");
    let valorEscrito = inputPdf ? inputPdf.value.trim() : "";

    if (!valorEscrito) {
        alert("Por favor, escriba o seleccione un registro en el campo de búsqueda.");
        return;
    }

    let datalist = document.getElementById("listaPdfProduccion");
    let idEncontrado = "";

    // 1. Coincidencia exacta con una opción del datalist
    if (datalist) {
        for (let option of datalist.options) {
            if (option.value === valorEscrito) {
                idEncontrado = option.dataset.id;
                break;
            }
        }
    }

    // 2. Búsqueda flexible por lote o producto si el usuario escribió parcialmente
    if (!idEncontrado) {
        let match = registrosProduccion.find(r => {
            let nombreLote = mapaLotes[r.lote] || r.lote || '';
            return (nombreLote && String(nombreLote).toLowerCase().includes(valorEscrito.toLowerCase())) ||
                   (r.producto && r.producto.toLowerCase().includes(valorEscrito.toLowerCase()));
        });
        if (match) {
            idEncontrado = match.id;
        }
    }

    if (!idEncontrado) {
        alert("❌ No se encontró ningún registro que coincida con lo escrito. Asegúrese de seleccionarlo de la lista.");
        return;
    }

    generarPDFProdPorId(idEncontrado);
};

function limpiarFormulario() {
    document.getElementById("fechaInicio").value = "";
    document.getElementById("fechaFin").value = "";
    document.getElementById("lote").value = "";
    document.getElementById("producto").value = "";
    document.getElementById("cafe").value = "";
    document.getElementById("molienda").value = "";
    document.getElementById("arranque").value = "";
    document.getElementById("final").value = "";
    document.getElementById("capsulas").value = "";
    document.getElementById("desechos").value = "";
    document.getElementById("neto").value = "";
    idEditar = null;
}

async function inicializar() {
    inicializarEncabezado();
    await cargarLotes();
    cargarProduccion();
}
inicializar();