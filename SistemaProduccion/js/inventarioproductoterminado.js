import { initializeApp } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-app.js";
import {
    getFirestore,
    collection,
    getDocs,
    doc,
    deleteDoc,
    updateDoc,
    addDoc
} from "https://www.gstatic.com/firebasejs/11.3.0/firebase-firestore.js";

import { 
    getAuth 
} from "https://www.gstatic.com/firebasejs/11.3.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyBrgepLE66VmIbLX2FK5Pvw8ldTiHY1a10",
    authDomain: "sistemaproduccion-1cf69.firebaseapp.com",
    projectId: "sistemaproduccion-1cf69",
    storageBucket: "sistemaproduccion-1cf69.firebasestorage.app",
    messagingSenderId: "673896576310",
    appId: "1:673896576310:web:eafe4ee37cf4c35223af97"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

let registradosCapsulas = [];
let registradosGrano = [];
let movimientosAutomaticos = [];
let mapaCalidadPorId = {}; 

let stockCalculadoGlobal = {};
let productosOcultos = [];
try {
    productosOcultos = JSON.parse(localStorage.getItem("productosOcultos_terminado")) || [];
} catch (e) {
    productosOcultos = [];
}

let filtroHistorialGlobal = "";

async function cargarTodoElSistema() {
    try {
        const snapCalidad = await getDocs(collection(db, "calidad"));
        mapaCalidadPorId = {};
        snapCalidad.forEach(docu => {
            let d = docu.data();
            let idRef = d.loteId || d.produccionId;
            let lotePTVal = d.lotePT || d.loteProductoTerminado || "";
            if (idRef) {
                mapaCalidadPorId[idRef] = {
                    lotePT: lotePTVal || "Sin Lote PT",
                    loteNumero: d.loteNumero || "",
                    producto: normalizarNombreProducto(d.producto || "Sin Nombre")
                };
            }
            if (d.loteNumero && lotePTVal) {
                mapaCalidadPorId[d.loteNumero] = {
                    lotePT: lotePTVal,
                    producto: normalizarNombreProducto(d.producto || "Sin Nombre")
                };
            }
        });

        // Cargar mapa directo de materia prima para asegurar los códigos de lote interno
        const snapMateria = await getDocs(collection(db, "materiaPrima"));
        snapMateria.forEach(docu => {
            let d = docu.data();
            if (d.loteInterno) {
                mapaCalidadPorId[docu.id] = {
                    lotePT: d.loteInterno,
                    producto: d.material || "Café en Grano"
                };
            }
        });

        const snapCapsulas = await getDocs(collection(db, "empaque"));
        registradosCapsulas = [];
        snapCapsulas.forEach(docu => {
            let d = docu.data();
            registradosCapsulas.push({ id: docu.id, ...d });
        });

        const snapGrano = await getDocs(collection(db, "empaqueCafeGrano"));
        registradosGrano = [];
        snapGrano.forEach(docu => {
            let d = docu.data();
            registradosGrano.push({ id: docu.id, ...d });
        });

        const snapManuales = await getDocs(collection(db, "inventario_terminado"));
        movimientosAutomaticos = [];
        snapManuales.forEach(docu => movimientosAutomaticos.push({ id: docu.id, ...docu.data() }));

        movimientosAutomaticos.sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));

        renderizarTarjetasDinamicas();
        renderizarBuscadorHistorialUI();
        renderizarTablaHistorial();

    } catch (e) {
        console.error("Error cargando almacén: ", e);
    }
}

function normalizarNombreProducto(nombreBruto) {
    if (!nombreBruto) return "Cápsula";
    let limpio = String(nombreBruto).trim();
    let lower = limpio.toLowerCase();

    if (lower.includes("dolce")) return "Baccio Dolce";
    if (lower.includes("intenso")) return "Baccio Intenso";
    if (lower.includes("clasico") || lower.includes("clásico")) return "Baccio Classico";
    if (lower.includes("decaf") || lower.includes("tone")) return "Decaf Tone";
    if (lower.includes("finca soledad") || lower.includes("soledad")) return "Finca Soledad";
    if (lower.includes("finca chorora") || lower.includes("chorora")) return "Finca Chorora";
    if (lower.includes("cc finca") || lower.includes("chika")) return "CC Finca Chika";
    if (lower.includes("imbabura")) return "Imbabura";
    if (lower.includes("loja")) return "Loja";
    if (lower.includes("huma") || lower.includes("raíces") || lower.includes("raices")) return "Huma Raíces";
    if (lower.includes("raymi")) return "Raymi Coffee";
    if (lower.includes("typpy") || lower.includes("tippy")) return "Tippytea";

    return limpio;
}

function obtenerLotePT(d) {
    if (d.loteInterno && !d.loteInterno.toLowerCase().startsWith("lote:")) return d.loteInterno;
    
    if (d.produccionId && mapaCalidadPorId[d.produccionId]) {
        let pt = mapaCalidadPorId[d.produccionId].lotePT;
        if (pt && pt !== "Sin Lote PT") return pt;
    }
    if (d.loteId && mapaCalidadPorId[d.loteId]) {
        let pt = mapaCalidadPorId[d.loteId].lotePT;
        if (pt && pt !== "Sin Lote PT") return pt;
    }
    if (d.lote && mapaCalidadPorId[d.lote]) {
        let pt = mapaCalidadPorId[d.lote].lotePT;
        if (pt && pt !== "Sin Lote PT") return pt;
    }
    let numLotePT = d.lotePT || d.lotePTCodigo || d.loteProductoTerminado || d.lote || "";
    numLotePT = String(numLotePT || "").trim();
    return (numLotePT && !numLotePT.toLowerCase().startsWith("lote:")) ? numLotePT : "Sin Lote PT";
}

function renderizarTarjetasDinamicas() {
    const contenedor = document.getElementById("resumenStock");
    if (!contenedor) return;

    let mapaBolsas = {};
    let mapaCajas = {};
    let mapaCajasx3 = {};
    let mapaCustom = {};
    let mapaDegustacion = {};

    registradosCapsulas.forEach(r => {
        let nombreProdBruto = r.producto || r.nombreProducto || r.variedad || "Cápsula";
        let nombreProd = normalizarNombreProducto(nombreProdBruto);
        let numLotePT = obtenerLotePT(r);
        let idUnico = r.produccionId || r.loteId || r.id;

        let tipoStr = String(r.tipo || "").toLowerCase();
        let empaqueTipoStr = String(r.empaqueTipo || "").toLowerCase();
        
        let esDegustacion = tipoStr === 'degustacion' || empaqueTipoStr === 'degustacion';
        let esCustom = tipoStr === 'custom' || tipoStr === 'personalizado' || empaqueTipoStr === 'personalizado';
        let esBolsa = !esCustom && (tipoStr === '15' || tipoStr.includes('bolsa') || empaqueTipoStr === 'bolsa');
        let esCajax3 = tipoStr === '3' || empaqueTipoStr.includes('3');

        let empaqueTexto = "";
        let unidadLabel = "cx";
        let categoriaDestino = "cajas";
        let cantidadItem = Number(r.empaques || r.cantidad || 0);

        if (esDegustacion) {
            empaqueTexto = 'Degustación';
            unidadLabel = 'ud';
            categoriaDestino = "degustacion";
        } else if (esCustom) {
            let unidadesCustom = Number(r.unidades || 0);
            let esBolsaCustom = empaqueTipoStr === 'bolsa' || empaqueTipoStr === '' || !empaqueTipoStr.includes('caja');
            let tipoContenedor = esBolsaCustom ? 'Bolsa Personalizada' : 'Caja Personalizada';
            empaqueTexto = `${tipoContenedor} x${unidadesCustom} und.`;
            unidadLabel = esBolsaCustom ? 'bl' : 'cx';
            categoriaDestino = "custom";
        } else if (esBolsa) {
            let unidadesBolsa = r.unidades || '15';
            empaqueTexto = `Bolsa x${unidadesBolsa} und.`;
            unidadLabel = 'bl';
            categoriaDestino = "bolsas";
        } else if (esCajax3) {
            empaqueTexto = 'Caja x3 und.';
            unidadLabel = 'cx';
            categoriaDestino = "cajasx3";
        } else {
            let unidadesCaja = r.unidades || tipoStr || '10';
            empaqueTexto = `Caja x${unidadesCaja} und.`;
            unidadLabel = 'cx';
            categoriaDestino = "cajas";
        }

        let nombreMostrar = `${nombreProd} (${empaqueTexto})`;
        let clave = `${numLotePT}__${nombreProd}__${empaqueTexto}`;

        let mapaObjetivo;
        if (categoriaDestino === "degustacion") mapaObjetivo = mapaDegustacion;
        else if (categoriaDestino === "bolsas") mapaObjetivo = mapaBolsas;
        else if (categoriaDestino === "cajasx3") mapaObjetivo = mapaCajasx3;
        else if (categoriaDestino === "custom") mapaObjetivo = mapaCustom;
        else mapaObjetivo = mapaCajas;

        if (!mapaObjetivo[clave]) {
            mapaObjetivo[clave] = { 
                produccionId: idUnico,
                nombreMostrar: nombreMostrar,
                cantidad: 0, 
                unidadLabel: unidadLabel, 
                lotePT: numLotePT, 
                categoriaOriginal: esCustom ? "Cápsulas Personalizadas" : "Cápsulas" 
            };
        }
        mapaObjetivo[clave].cantidad += cantidadItem;
    });

    let mapaGrano = {};
    registradosGrano.forEach(g => {
        let detalle = g.detalleEmpaque || "Bolsa Estándar (200g)";
        let nombreProductoBase = g.operario || g.producto || g.nombreProducto || "Café en Grano";
        let nombreProducto = `${detalle}`;
        
        // 🔍 CORRECCIÓN PARA CAFÉ EN GRANO: Lee siempre el lote interno exacto del registro
        let numLotePT = g.loteInterno || obtenerLotePT(g);
        let idUnico = g.produccionId || g.loteId || g.id;
        
        let claveGrano = `${numLotePT}__${nombreProducto}`;
        let disponibles = Number(g.unidadesDisponibles ?? g.cantidadUnidades ?? g.cantidad ?? 0);

        if (!mapaGrano[claveGrano]) {
            mapaGrano[claveGrano] = { 
                produccionId: idUnico,
                nombreMostrar: nombreProducto,
                cantidad: 0, 
                unidadLabel: "und",
                lotePT: numLotePT, 
                categoriaOriginal: "Café en Grano" 
            };
        }
        mapaGrano[claveGrano].cantidad += disponibles;
    });

    movimientosAutomaticos.forEach(m => {
        let cantidad = Number(m.cantidad || 0);
        let impacto = m.tipoMovimiento === "Salida" ? -cantidad : cantidad;
        let numLotePT = obtenerLotePT(m);
        let variedadMovRaw = (m.variedad || "").toLowerCase();
        let categoriaLower = (m.categoria || "").toLowerCase();

        let esCustomMov = categoriaLower.includes("personalizada") || variedadMovRaw.includes("personalizada") || variedadMovRaw.includes("pers");
        let esDegustacionMov = categoriaLower.includes("degustacion") || variedadMovRaw.includes("degustación") || variedadMovRaw.includes("degustacion");
        let esBolsa15 = !esCustomMov && !esDegustacionMov && (variedadMovRaw.includes("x15") || variedadMovRaw.includes("bolsa x15") || categoriaLower.includes("bolsas"));
        let esCaja10 = !esCustomMov && !esDegustacionMov && (variedadMovRaw.includes("x10") || categoriaLower.includes("cajas x10"));
        let esCajax3 = !esCustomMov && !esDegustacionMov && (variedadMovRaw.includes("x3") || categoriaLower.includes("cajas x3"));

        let mapaObjetivo = null;
        if (esCustomMov) mapaObjetivo = mapaCustom;
        else if (esDegustacionMov) mapaObjetivo = mapaDegustacion;
        else if (esBolsa15) mapaObjetivo = mapaBolsas;
        else if (esCaja10) mapaObjetivo = mapaCajas;
        else if (esCajax3) mapaObjetivo = mapaCajasx3;
        else if (m.categoria === "Café en Grano") mapaObjetivo = mapaGrano;
        else mapaObjetivo = mapaCajas;

        let aplicado = false;
        let variedadLimpiaMov = variedadMovRaw.replace(/[^a-z0-9]/g, '');

        for (let k in mapaObjetivo) {
            let item = mapaObjetivo[k];
            let coincideLote = numLotePT !== "Sin Lote PT" && item.lotePT === numLotePT;

            if (esCustomMov) {
                let movEsBolsa = variedadMovRaw.includes("bolsa") || variedadMovRaw.includes("bl");
                let itemEsBolsa = item.nombreMostrar.toLowerCase().includes("bolsa");
                let movEsCaja = variedadMovRaw.includes("caja") || variedadMovRaw.includes("cx");
                let itemEsCaja = item.nombreMostrar.toLowerCase().includes("caja");

                let tipoEmpaqueCoincide = (movEsBolsa && itemEsBolsa) || (movEsCaja && itemEsCaja);
                let prodNombre = normalizarNombreProducto(item.nombreMostrar).toLowerCase();
                let movNombre = normalizarNombreProducto(m.variedad).toLowerCase();

                let unidadesMovMatch = variedadMovRaw.match(/x\d+/);
                let unidadesItemMatch = item.nombreMostrar.toLowerCase().match(/x\d+/);
                let mismoContenido = !unidadesMovMatch || !unidadesItemMatch || unidadesMovMatch[0] === unidadesItemMatch[0];

                if (coincideLote && tipoEmpaqueCoincide && mismoContenido && (prodNombre === movNombre || k.toLowerCase().includes(movNombre))) {
                    item.cantidad += impacto;
                    aplicado = true;
                    break;
                }
            } else if (esDegustacionMov) {
                let prodNombre = normalizarNombreProducto(item.nombreMostrar).toLowerCase();
                let movNombre = normalizarNombreProducto(m.variedad).toLowerCase();
                if (coincideLote && (prodNombre === movNombre || k.toLowerCase().includes(movNombre))) {
                    item.cantidad += impacto;
                    aplicado = true;
                    break;
                }
            } else {
                let coincideId = m.produccionId && item.produccionId === m.produccionId;
                let itemLimpio = item.nombreMostrar.toLowerCase().replace(/[^a-z0-9]/g, '');
                let palabraClaveProd = item.nombreMostrar.toLowerCase().split(' ')[0];
                let mismoProducto = variedadMovRaw.includes(palabraClaveProd);

                if ((coincideLote && mismoProducto) || coincideId || (coincideLote && variedadLimpiaMov === itemLimpio)) {
                    item.cantidad += impacto;
                    aplicado = true;
                    break;
                }
            }
        }

        if (!aplicado && numLotePT !== "Sin Lote PT") {
            let nombreProd = normalizarNombreProducto(m.variedad);
            let empaqueTexto = esCustomMov ? m.variedad : (esDegustacionMov ? "Degustación" : (esBolsa15 ? "Bolsa x15 und." : "Caja x10 und."));
            let claveHistorial = `${numLotePT}__${nombreProd}__${empaqueTexto}`;
            
            if (!mapaObjetivo[claveHistorial]) {
                mapaObjetivo[claveHistorial] = {
                    produccionId: m.produccionId || "",
                    nombreMostrar: m.variedad.includes("(") ? m.variedad : `${nombreProd} (${empaqueTexto})`,
                    cantidad: 0,
                    unidadLabel: esCustomMov ? (m.variedad.toLowerCase().includes("caja") ? "cx" : "bl") : (esDegustacionMov ? "ud" : "cx"),
                    lotePT: numLotePT,
                    categoriaOriginal: esCustomMov ? "Cápsulas Personalizadas" : (m.categoria || "Cápsulas")
                };
            }
            mapaObjetivo[claveHistorial].cantidad += impacto;
        }
    });

    stockCalculadoGlobal = { "Cápsulas": {}, "Café en Grano": {} };
    [mapaBolsas, mapaCajas, mapaCajasx3, mapaCustom, mapaDegustacion].forEach(mapa => {
        for (let k in mapa) stockCalculadoGlobal["Cápsulas"][k] = mapa[k].cantidad;
    });
    for (let k in mapaGrano) stockCalculadoGlobal["Café en Grano"][k] = mapaGrano[k].cantidad;

    function generarCuadroHTML(titulo, mapaDatos, colorBorde, colorTexto, unidadPorDefecto, categoriaFiltradaFuerza = "") {
        let totalCategoria = 0;
        let desgloseActivos = "";
        let desgloseAgotados = "";

        for (let key in mapaDatos) {
            let item = mapaDatos[key];
            if (productosOcultos.includes(key) || productosOcultos.includes(item.nombreMostrar)) continue;

            if (categoriaFiltradaFuerza && item.categoriaOriginal !== categoriaFiltradaFuerza) continue;

            let unidad = item.unidadLabel || unidadPorDefecto;
            
            let badgeLotePT = `
            <div style="margin-top: 3px;">
                <span style="background-color: #0d6efd; color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: bold; display: inline-block;">
                    ${escapeHtml(item.lotePT)}
                </span>
            </div>`;

            let escCat = escapeHtml(item.categoriaOriginal).replace(/'/g, "\\'");
            let escNom = escapeHtml(item.nombreMostrar).replace(/'/g, "\\'");
            let escLote = escapeHtml(item.lotePT).replace(/'/g, "\\'");
            let escId = escapeHtml(item.produccionId || "").replace(/'/g, "\\'");
            let escKey = escapeHtml(key).replace(/'/g, "\\'");

            if (item.cantidad > 0) {
                totalCategoria += item.cantidad;
                desgloseActivos += `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px; padding: 6px 8px; background: #f8f9fa; border-radius: 4px;">
                    <div style="font-size:13px; color:#333;">
                        <b>• ${escapeHtml(item.nombreMostrar)}</b>
                        ${badgeLotePT}
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <b style="color:${colorTexto}; font-size: 16px;">${item.cantidad} ${escapeHtml(unidad)}</b>
                        <button onclick="ajusteRapidoStock('${escCat}', '${escNom}', 'Entrada', '${escLote}', '${escId}')" style="background:#198754; color:white; border:none; border-radius:3px; padding:2px 6px; cursor:pointer; font-weight:bold;">➕</button>
                        <button onclick="ajusteRapidoStock('${escCat}', '${escNom}', 'Salida', '${escLote}', '${escId}')" style="background:#dc3545; color:white; border:none; border-radius:3px; padding:2px 6px; cursor:pointer; font-weight:bold;">➖</button>
                    </div>
                </div>`;
            } else {
                desgloseAgotados += `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px; padding: 6px 8px; background: #ffffff; border-radius: 4px; border: 1px solid #ffc107;">
                    <div style="font-size:13px; color:#333;">
                        <b>• ${escapeHtml(item.nombreMostrar)}</b>
                        ${badgeLotePT}
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <b style="color:#dc3545;">0 ${escapeHtml(unidad)}</b>
                        <button onclick="ajusteRapidoStock('${escCat}', '${escNom}', 'Entrada', '${escLote}', '${escId}')" style="background:#198754; color:white; border:none; border-radius:3px; padding:2px 6px; cursor:pointer; font-weight:bold;">➕</button>
                        <button onclick="ajusteRapidoStock('${escCat}', '${escNom}', 'Salida', '${escLote}', '${escId}')" style="background:#dc3545; color:white; border:none; border-radius:3px; padding:2px 6px; cursor:pointer; font-weight:bold;">➖</button>
                        <button onclick="ocultarProductoAgotado('${escKey}')" title="Quitar de la lista" style="background:#e67e22; color:white; border:none; border-radius:3px; padding:2px 6px; cursor:pointer; font-weight:bold;">👁🗨 Quitar</button>
                    </div>
                </div>`;
            }
        }

        let bloqueAgotados = desgloseAgotados ? `
        <div style="margin-top: 15px; background: #fff8e1; border: 1px solid #ffe082; padding: 10px; border-radius: 6px;">
            <strong style="font-size: 12px; color: #b78103; display: block; margin-bottom: 5px;">⚠️ Productos Agotados / Por Agotar:</strong>
            ${desgloseAgotados}
        </div>` : '';

        return `
        <div style="background: #ffffff; color: black; border-left: 5px solid ${colorBorde}; padding: 15px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); border: 1px solid #ddd;">
            <strong style="font-size: 15px; display:block; text-align:center; margin-bottom:8px; color:#333;">${escapeHtml(titulo)}</strong>
            <div style="font-size: 26px; font-weight: bold; color: ${colorTexto}; text-align:center; margin-bottom: 10px;">${totalCategoria} <small style="font-size:14px; color:#666;">Total</small></div>
            ${desgloseActivos || '<div style="color:#999; font-size:12px; text-align:center;">Sin stock activo</div>'}
            ${bloqueAgotados}
        </div>`;
    }

    let html = `<h2 style="margin-top:0; text-align:center; color:#333;">📊 Inventario Real en Almacén</h2>
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 15px; margin-bottom: 20px;">`;

    html += generarCuadroHTML("🛍 Bolsas de Cápsulas de Café x15", mapaBolsas, "#0d6efd", "#0d6efd", "bl", "Cápsulas");
    html += generarCuadroHTML("📦 Cajas de Cápsulas de Café x10", mapaCajas, "#6f42c1", "#6f42c1", "cx", "Cápsulas");
    html += generarCuadroHTML("📦 Cajas de Cápsulas x3", mapaCajasx3, "#d63384", "#d63384", "cx", "Cápsulas");

    if (Object.keys(mapaCustom).length > 0) {
        html += generarCuadroHTML("⚙️ Cápsulas Personalizadas", mapaCustom, "#fd7e14", "#fd7e14", "ud", "Cápsulas Personalizadas");
    }

    html += generarCuadroHTML("☕ Cápsulas de Degustación", mapaDegustacion, "#20c997", "#20c997", "ud");
    html += generarCuadroHTML("☕ Café en Grano", mapaGrano, "#28a745", "#28a745", "und", "Café en Grano");

    html += `</div>`;
    contenedor.innerHTML = html;
}

function renderizarBuscadorHistorialUI() {
    let contenedorBuscador = document.getElementById("contenedorBuscadorHistorial");
    const tabla = document.getElementById("tablaInventario");

    if (!contenedorBuscador && tabla) {
        contenedorBuscador = document.createElement("div");
        contenedorBuscador.id = "contenedorBuscadorHistorial";
        tabla.parentNode.insertBefore(contenedorBuscador, tabla);
    }

    if (contenedorBuscador) {
        contenedorBuscador.innerHTML = `
            <div style="max-width: 450px; margin: 10px 0 15px 0;">
                <label for="inputBuscadorHistorial" style="font-weight: bold; font-size: 13px; display: block; margin-bottom: 4px; color: #333;">
                    🔍 Filtrar Historial (por producto, letra, motivo o n° de lote):
                </label>
                <div style="position: relative; display: flex; align-items: center;">
                    <input type="text" id="inputBuscadorHistorial" value="${escapeHtml(filtroHistorialGlobal)}" placeholder="Escribe para filtrar el historial..." 
                        oninput="filtrarHistorial(this.value)"
                        style="width: 100%; padding: 7px 30px 7px 10px; border: 2px solid #6c757d; border-radius: 5px; font-size: 13px; outline: none;">
                    <button id="btnLimpiarBuscador" onclick="limpiarBuscadorHistorial()" style="position: absolute; right: 8px; background: none; border: none; font-weight: bold; cursor: pointer; color: #888; display: ${filtroHistorialGlobal ? 'block' : 'none'};">❌</button>
                </div>
            </div>
        `;
    }
}

window.filtrarHistorial = function(texto) {
    filtroHistorialGlobal = texto.trim().toLowerCase();
    const btnLimpiar = document.getElementById("btnLimpiarBuscador");
    if (btnLimpiar) btnLimpiar.style.display = filtroHistorialGlobal ? 'block' : 'none';
    renderizarTablaHistorial();
};

window.limpiarBuscadorHistorial = function() {
    filtroHistorialGlobal = "";
    const input = document.getElementById("inputBuscadorHistorial");
    if (input) input.value = "";
    const btnLimpiar = document.getElementById("btnLimpiarBuscador");
    if (btnLimpiar) btnLimpiar.style.display = "none";
    renderizarTablaHistorial();
};

function renderizarTablaHistorial() {
    const tbody = document.getElementById("tbodyInventario");
    if (!tbody) return;
    tbody.innerHTML = "";

    let registrosFiltrados = movimientosAutomaticos.filter(d => {
        if (!filtroHistorialGlobal) return true;
        let textoLote = obtenerLotePT(d);
        let textoFila = `${d.fecha || ''} ${d.tipoMovimiento || ''} ${d.categoria || ''} ${d.variedad || ''} ${textoLote} ${d.observaciones || d.motivo || ''}`.toLowerCase();
        return textoFila.includes(filtroHistorialGlobal);
    });

    if (registrosFiltrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:#888; padding:15px;">No se encontraron registros que coincidan con "${escapeHtml(filtroHistorialGlobal)}".</td></tr>`;
        return;
    }

    registrosFiltrados.forEach(d => {
        let id = d.id;
        let colorBadge = d.tipoMovimiento === "Salida" ? "#dc3545" : "#198754";
        let loteMostrar = obtenerLotePT(d);

        tbody.innerHTML += `
        <tr id="fila-${id}" style="color: black;">
            <td style="padding: 10px;">${escapeHtml(d.fecha || "-")}</td>
            <td style="padding: 10px;"><span style="background:${colorBadge}; color:white; padding:3px 8px; border-radius:4px; font-size:12px; font-weight:bold;">${escapeHtml(d.tipoMovimiento)}</span></td>
            <td style="padding: 10px;">${escapeHtml(d.categoria)}</td>
            <td style="padding: 10px;"><b>${escapeHtml(d.variedad)}</b></td>
            <td style="padding: 10px;">
                <span style="background:#0d6efd; color:white; padding:3px 8px; border-radius:4px; font-size:11px; font-weight:bold; display:inline-block;">
                    ${escapeHtml(loteMostrar)}
                </span>
            </td>
            <td style="padding: 10px; font-weight:bold;">${Number(d.cantidad || 0)} ud</td>
            <td style="padding: 10px; font-style:italic; color:#555;">${escapeHtml(d.observaciones || d.motivo || '-')}</td>
            <td style="padding: 10px; white-space: nowrap;">
                <button onclick="activarEdicionEnLinea('${id}')" style="background:none; border:none; cursor:pointer; margin-right:8px;" title="Editar registro">✏️</button>
                <button onclick="eliminarMovimiento('${id}')" style="background:none; border:none; cursor:pointer;" title="Eliminar registro">🗑️</button>
            </td>
        </tr>`;
    });
}

window.ocultarProductoAgotado = function(nombreProducto) {
    if (confirm(`¿Está seguro de quitar este producto de la visualización?`)) {
        if (!productosOcultos.includes(nombreProducto)) {
            productosOcultos.push(nombreProducto);
            localStorage.setItem("productosOcultos_terminado", JSON.stringify(productosOcultos));
        }
        renderizarTarjetasDinamicas();
    }
};

window.revisarProductosOcultos = function() {
    if (productosOcultos.length === 0) {
        alert("No hay productos ocultos en este momento.");
        return;
    }
    if (confirm(`Hay ${productosOcultos.length} elementos ocultos. ¿Desea restablecer todos los productos?`)) {
        productosOcultos = [];
        localStorage.removeItem("productosOcultos_terminado");
        renderizarTarjetasDinamicas();
    }
};

window.ajusteRapidoStock = async function(categoria, variedad, tipoMovimiento, lotePTParam, produccionIdParam) {
    let cantidadPrompt = prompt(`¿Cuántas unidades deseas ${tipoMovimiento === "Entrada" ? "INGRESAR AL" : "SACAR DEL"} inventario?\n\nProducto: ${variedad}\nLote PT: ${lotePTParam}`);
    if (cantidadPrompt === null) return;
    let cantidad = Number(cantidadPrompt);

    if (isNaN(cantidad) || cantidad <= 0) {
        alert("❌ Cantidad inválida.");
        return;
    }

    let motivoPrompt = prompt(`Indique el MOTIVO / OBSERVACIÓN:`, tipoMovimiento === "Entrada" ? "Ingreso manual" : "Salida manual");
    if (motivoPrompt === null) return;
    let observaciones = motivoPrompt.trim() || "Sin observaciones";

    if (!confirm(`⚠️ ¿Confirmar ${tipoMovimiento}?\n\nProducto: ${variedad}\nLote PT: ${lotePTParam}\nCantidad: ${cantidad}\nMotivo: ${observaciones}`)) return;

    let ahora = new Date();
    let fechaHoy = ahora.getFullYear() + "-" + 
        String(ahora.getMonth() + 1).padStart(2, '0') + "-" + 
        String(ahora.getDate()).padStart(2, '0') + " " +
        String(ahora.getHours()).padStart(2, '0') + ":" +
        String(ahora.getMinutes()).padStart(2, '0');

    try {
        await addDoc(collection(db, "inventario_terminado"), {
            fecha: fechaHoy,
            tipoMovimiento: tipoMovimiento,
            categoria: categoria,
            variedad: variedad,
            lotePT: lotePTParam || "Sin Lote PT",
            produccionId: produccionIdParam || "",
            cantidad: cantidad,
            observaciones: observaciones
        });

        alert(`✅ Operación registrada.`);
        await cargarTodoElSistema();
    } catch (e) {
        console.error("Error al guardar: ", e);
    }
};

window.activarEdicionEnLinea = function(id) {
    const reg = movimientosAutomaticos.find(m => m.id === id);
    if (!reg) return;

    const fila = document.getElementById(`fila-${id}`);
    if (!fila) return;

    fila.innerHTML = `
        <td style="padding: 5px;"><input type="text" id="edit-fecha-${id}" value="${escapeHtml(reg.fecha || '')}" style="width: 100%; padding: 4px;"></td>
        <td style="padding: 5px;">
            <select id="edit-movimiento-${id}" style="width: 100%; padding: 4px;">
                <option value="Entrada" ${reg.tipoMovimiento === 'Entrada' ? 'selected' : ''}>Entrada</option>
                <option value="Salida" ${reg.tipoMovimiento === 'Salida' ? 'selected' : ''}>Salida</option>
            </select>
        </td>
        <td style="padding: 5px;">
            <select id="edit-categoria-${id}" style="width: 100%; padding: 4px;">
                <option value="Cápsulas" ${reg.categoria === 'Cápsulas' ? 'selected' : ''}>Cápsulas</option>
                <option value="Café en Grano" ${reg.categoria === 'Café en Grano' ? 'selected' : ''}>Café en Grano</option>
                <option value="Cápsulas Personalizadas" ${reg.categoria === 'Cápsulas Personalizadas' ? 'selected' : ''}>Cápsulas Personalizadas</option>
            </select>
        </td>
        <td style="padding: 5px;"><input type="text" id="edit-variedad-${id}" value="${escapeHtml(reg.variedad || '')}" style="width: 100%; padding: 4px;"></td>
        <td style="padding: 5px;"><input type="text" id="edit-lote-${id}" value="${escapeHtml(reg.lotePT || '')}" placeholder="Sin Lote PT" style="width: 100%; padding: 4px;"></td>
        <td style="padding: 5px;"><input type="number" id="edit-cantidad-${id}" value="${Number(reg.cantidad || 0)}" min="1" style="width: 70px; padding: 4px;"> ud</td>
        <td style="padding: 5px;"><input type="text" id="edit-observaciones-${id}" value="${escapeHtml(reg.observaciones || reg.motivo || '')}" style="width: 100%; padding: 4px;"></td>
        <td style="padding: 5px; white-space: nowrap;">
            <button onclick="guardarEdicionEnLinea('${id}')" style="background:#198754; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; margin-right:4px;" title="Guardar">💾</button>
            <button onclick="renderizarTablaHistorial()" style="background:#6c757d; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;" title="Cancelar">❌</button>
        </td>
    `;
};

window.guardarEdicionEnLinea = async function(id) {
    const nuevaFecha = document.getElementById(`edit-fecha-${id}`).value.trim();
    const nuevoMovimiento = document.getElementById(`edit-movimiento-${id}`).value;
    const nuevaCategoria = document.getElementById(`edit-categoria-${id}`).value;
    const nuevaVariedad = document.getElementById(`edit-variedad-${id}`).value.trim();
    let nuevoLote = document.getElementById(`edit-lote-${id}`).value.trim() || "Sin Lote PT";
    const nuevaCantidad = Number(document.getElementById(`edit-cantidad-${id}`).value);
    const nuevasObs = document.getElementById(`edit-observaciones-${id}`).value.trim();

    if (!nuevaFecha || !nuevaVariedad || isNaN(nuevaCantidad) || nuevaCantidad <= 0) {
        alert("❌ Revise los datos ingresados.");
        return;
    }

    try {
        await updateDoc(doc(db, "inventario_terminado", id), {
            fecha: nuevaFecha,
            tipoMovimiento: nuevoMovimiento,
            categoria: nuevaCategoria,
            variedad: nuevaVariedad,
            lotePT: nuevoLote,
            cantidad: nuevaCantidad,
            observaciones: nuevasObs
        });

        const regAntiguo = movimientosAutomaticos.find(m => m.id === id);
        if (regAntiguo && (regAntiguo.produccionId || regAntiguo.loteId)) {
            let docIdEmpaque = regAntiguo.produccionId || regAntiguo.loteId;
            let coleccionObjetivo = nuevaCategoria === "Café en Grano" ? "empaqueCafeGrano" : "empaque";
            
            try {
                await updateDoc(doc(db, coleccionObjetivo, docIdEmpaque), {
                    empaques: nuevaCantidad,
                    cantidad: nuevaCantidad,
                    bolsasDisponibles: nuevaCantidad,
                    empaquesDisponibles: nuevaCantidad
                });
            } catch (errEmp) {
                console.log("No se encontró documento directo en empaque para actualizar simultáneamente:", errEmp);
            }
        }

        alert("✅ Registro actualizado y stock sincronizado correctamente.");
        await cargarTodoElSistema();
    } catch (e) {
        console.error("Error al actualizar registro:", e);
        alert("Hubo un error al guardar los cambios.");
    }
};

window.eliminarMovimiento = async function(id) {
    if (confirm("¿Deseas eliminar este registro de forma definitiva?")) {
        try {
            await deleteDoc(doc(db, "inventario_terminado", id));
            alert("✅ Registro eliminado.");
            await cargarTodoElSistema();
        } catch (e) {
            console.error("Error al eliminar:", e);
            alert("Hubo un error al eliminar el registro.");
        }
    }
};

window.addEventListener("DOMContentLoaded", () => {
    cargarTodoElSistema();
});