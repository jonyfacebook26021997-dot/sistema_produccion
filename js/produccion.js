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
            option.textContent = `${d.loteInterno} | ${d.material || ""} | ${disponible} kg`;
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

    // Validar Stock del lote seleccionado
    let loteSel = listaLotesMateriaPrima.find(l => l.id === loteId);
    if (loteSel && cafe > loteSel.pesoDisponible) {
        alert(`❌ Stock insuficiente en Materia Prima. Disponible: ${loteSel.pesoDisponible} kg.`);
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
        
        // Descontar stock
        let nuevoStock = Number(loteSel.pesoDisponible) - cafe;
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

    try {
        const querySnapshot = await getDocs(collection(db, "produccion"));
        let total = 0;
        let registros = [];

        querySnapshot.forEach((docu) => {
            registros.push({ id: docu.id, ...docu.data() });
        });

        // Ordenar descendentemente por Fecha de Inicio
        registros.sort((a, b) => (b.fechaInicio || "").localeCompare(a.fechaInicio || ""));

        registros.forEach((d) => {
            let id = d.id;
            total++;

            let nombreLote = mapaLotes[d.lote] || d.lote || "-";
            let fInicio = d.fechaInicio ? d.fechaInicio.replace("T", " ") : "-";
            let fFin = d.fechaFin ? d.fechaFin.replace("T", " ") : "-";

            if (idEditar === id) {
                let opcionesLote = listaLotesMateriaPrima.map(l => 
                    `<option value="${l.id}" ${l.id === d.lote ? 'selected' : ''}>${l.loteInterno} (Disp: ${l.pesoDisponible} kg)</option>`
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
                    <td>${d.cafe} kg</td>
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
                        <button onclick="generarPDFProd('${fInicio}', '${fFin}', '${nombreLote}', '${d.producto}', ${d.cafe}, ${d.neto})">📄</button>
                    </td>
                </tr>
                `;
            }
        });

        let totalReg = document.getElementById("totalRegistros");
        if (totalReg) totalReg.innerText = `Total registros: ${total}`;
    } catch (e) { console.error(e); }
};

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
            mapaStockMateria[docM.id] = Number(docM.data().pesoDisponible ?? docM.data().pesoTotal) || 0;
        });

        if (nuevoLoteId === loteOriginalId) {
            let stockActualLote = mapaStockMateria[nuevoLoteId] || 0;
            let diferencia = nuevoCafe - cafeOriginalKg; 

            if (diferencia > stockActualLote) {
                alert(`❌ Stock insuficiente en el lote. Disponible adicional: ${stockActualLote} kg.`);
                return;
            }
            await updateDoc(doc(db, "materiaPrima", nuevoLoteId), { 
                pesoDisponible: stockActualLote - diferencia 
            });
        } else {
            let stockLoteNuevo = mapaStockMateria[nuevoLoteId] || 0;
            if (nuevoCafe > stockLoteNuevo) {
                alert(`❌ El nuevo lote no tiene suficiente stock. Disponible: ${stockLoteNuevo} kg.`);
                return;
            }
            let stockLoteViejo = mapaStockMateria[loteOriginalId] || 0;
            await updateDoc(doc(db, "materiaPrima", loteOriginalId), { 
                pesoDisponible: stockLoteViejo + cafeOriginalKg 
            });
            await updateDoc(doc(db, "materiaPrima", nuevoLoteId), { 
                pesoDisponible: stockLoteNuevo - nuevoCafe 
            });
        }

        // 1. Actualizar el registro principal en la colección "produccion"
        await updateDoc(doc(db, "produccion", id), {
            fechaInicio, fechaFin, lote: nuevoLoteId, producto, cafe: nuevoCafe, molienda, arranque, final: finalMaquina, capsulas, desechos, neto
        });

        // 2. Propagar el nuevo nombre del producto en cascada a Calidad, Empaque e Inventario Terminado
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
                await updateDoc(doc(db, "materiaPrima", loteId), { 
                    pesoDisponible: stockActual + cafeDevolver 
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
// BUSCADOR / HISTORIAL
//=========================
window.buscarProduccion = async function() {
    let desde = document.getElementById("buscarDesde").value;
    let hasta = document.getElementById("buscarHasta").value;
    let loteB = document.getElementById("buscarLote").value.toLowerCase().trim();
    let prodB = document.getElementById("buscarProducto").value.toLowerCase().trim();

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
        let cumple = true;

        if (desde && fInicio.substring(0, 10) < desde) cumple = false;
        if (hasta && fInicio.substring(0, 10) > hasta) cumple = false;
        if (loteB && !nombreLote.toLowerCase().includes(loteB)) cumple = false;
        if (prodB && !d.producto.toLowerCase().includes(prodB)) cumple = false;

        if (cumple) {
            contador++;
            tabla.innerHTML += `
            <tr>
                <td>${fInicio}</td>
                <td>${fFin}</td>
                <td>${nombreLote}</td>
                <td>${d.producto}</td>
                <td>${d.cafe} kg</td>
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
                    <button onclick="generarPDFProd('${fInicio}', '${fFin}', '${nombreLote}', '${d.producto}', ${d.cafe}, ${d.neto})">📄</button>
                </td>
            </tr>`;
        }
    });
    let totalReg = document.getElementById("totalRegistros");
    if (totalReg) totalReg.innerText = `Total registros (Filtrados): ${contador}`;
};

window.generarPDFProd = function(inicio, fin, lote, prod, cafe, neto) {
    if (!window.jspdf) {
        alert("Error: La librería jsPDF no está disponible.");
        return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text("REPORTE - PRODUCCIÓN DE CÁPSULAS", 20, 20);
    doc.text("Inicio: " + inicio, 20, 35);
    doc.text("Fin: " + fin, 20, 45);
    doc.text("Lote M.P: " + lote, 20, 55);
    doc.text("Producto: " + prod, 20, 65);
    doc.text("Café usado: " + cafe + " kg", 20, 75);
    doc.text("Total Neto: " + neto, 20, 85);
    doc.save("Produccion_" + String(lote).replace(/ /g, "_") + ".pdf");
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
    await cargarLotes();
    cargarProduccion();
}
inicializar();