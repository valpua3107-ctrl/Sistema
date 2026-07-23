const MAX_EQUIPOS = 15;
const MAX_PERIODOS = 31;
const UMBRAL_DIA = 50;
const FACTOR_ALTO = 1.2;
const FACTOR_CRITICO = 1.5;
const FACTOR_BAJO = 0.7;

// ---------- ESTADO GLOBAL DEL SISTEMA ----------
let numEquipos = 5;
let numPeriodos = 5;
let tarifa = 0.10;

let nombresEquipos = ["Iluminacion", "Aire acondicionado", "Laboratorios", "Oficinas", "Equipos de computo"];
let nombresPeriodos = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes"];

let estado = [];          // "Encendido" / "Apagado" por equipo
let consumo = [];         // consumo[equipo][periodo]
let totalEquipo = [];
let porcentaje = [];
let costoEquipo = [];
let clasificacion = [];
let tendencia = [];
let alerta = [];
let recomendacion = [];
let orden = [];            // índices ordenados de mayor a menor consumo

let totalGeneral = 0, promedioGeneral = 0, costoGeneral = 0;
let maxConsumo = 0, minConsumo = 0, posMax = 0, posMin = 0;
let contadorAlertas = 0, equiposEncendidos = 0;
let datosRegistrados = false;

// ---------- NAVEGACIÓN ENTRE SECCIONES (equivale al menú del Java) ----------
document.querySelectorAll(".opcion-menu").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".opcion-menu").forEach(b => b.classList.remove("activo"));
    document.querySelectorAll(".seccion").forEach(s => s.classList.remove("visible"));
    btn.classList.add("activo");
    document.getElementById(btn.dataset.seccion).classList.add("visible");
    ocultarMensaje();
  });
});

function mostrarMensaje(texto, tipo) {
  const caja = document.getElementById("mensaje");
  caja.textContent = texto;
  caja.className = "mensaje " + tipo; // tipo: "ok" o "error"
}
function ocultarMensaje() {
  document.getElementById("mensaje").className = "mensaje vacio";
}

// =========================================================================
// 1. CONFIGURACIÓN DEL SISTEMA (equivale a configurarSistema())
// =========================================================================
function generarCamposConfig() {
  const n = clamp(parseInt(document.getElementById("cfgNumEquipos").value) || 1, 1, MAX_EQUIPOS);
  const p = clamp(parseInt(document.getElementById("cfgNumPeriodos").value) || 1, 1, MAX_PERIODOS);
  let html = "<h3>Nombres de equipos/áreas</h3>";
  for (let i = 0; i < n; i++) {
    const valor = nombresEquipos[i] || ("Equipo " + (i + 1));
    html += `<label>Equipo ${i + 1}: <input type="text" class="cfgNombreEquipo" value="${valor}"></label>`;
  }
  html += "<h3>Etiquetas de los periodos</h3>";
  for (let j = 0; j < p; j++) {
    const valor = nombresPeriodos[j] || ("Periodo " + (j + 1));
    html += `<label>Periodo ${j + 1}: <input type="text" class="cfgNombrePeriodo" value="${valor}"></label>`;
  }
  document.getElementById("cfgNombres").innerHTML = html;
}

function aplicarConfig() {
  numEquipos = clamp(parseInt(document.getElementById("cfgNumEquipos").value) || 1, 1, MAX_EQUIPOS);
  numPeriodos = clamp(parseInt(document.getElementById("cfgNumPeriodos").value) || 1, 1, MAX_PERIODOS);
  const t = parseFloat(document.getElementById("cfgTarifa").value);
  tarifa = (isNaN(t) || t < 0) ? 0 : t;

  const camposEquipo = document.querySelectorAll(".cfgNombreEquipo");
  const camposPeriodo = document.querySelectorAll(".cfgNombrePeriodo");
  nombresEquipos = [];
  for (let i = 0; i < numEquipos; i++) {
    const v = camposEquipo[i] ? camposEquipo[i].value.trim() : "";
    nombresEquipos.push(v || ("Equipo " + (i + 1)));
  }
  nombresPeriodos = [];
  for (let j = 0; j < numPeriodos; j++) {
    const v = camposPeriodo[j] ? camposPeriodo[j].value.trim() : "";
    nombresPeriodos.push(v || ("Periodo " + (j + 1)));
  }

  datosRegistrados = false;
  llenarSelectEquipos();
  mostrarMensaje("Configuración actualizada. Ahora registre los datos en la opción 2.", "ok");
}

function llenarSelectEquipos() {
  const sel = document.getElementById("selEquipoActualizar");
  sel.innerHTML = "";
  for (let i = 0; i < numEquipos; i++) {
    const op = document.createElement("option");
    op.value = i;
    op.textContent = nombresEquipos[i];
    sel.appendChild(op);
  }
}

// =========================================================================
// 2. REGISTRAR CONSUMO SEMANAL (equivale a la opción 1 del menú Java)
// =========================================================================
function generarFormularioRegistro() {
  let html = "";
  for (let i = 0; i < numEquipos; i++) {
    html += `<div class="bloque-equipo" data-eq="${i}">
      <h4>${nombresEquipos[i]}</h4>
      <label>Estado:
        <select class="regEstado">
          <option value="Encendido">Encendido</option>
          <option value="Apagado">Apagado</option>
        </select>
      </label>
      <div class="regPeriodos">`;
    for (let j = 0; j < numPeriodos; j++) {
      html += `<label>${nombresPeriodos[j]} (kWh): <input type="number" class="regConsumo" min="0" step="0.01" value="0"></label>`;
    }
    html += `</div></div>`;
  }
  document.getElementById("registroForm").innerHTML = html;
  document.getElementById("btnGuardarRegistro").classList.remove("oculto");
}

function guardarRegistro() {
  estado = [];
  consumo = [];
  const avisos = [];

  const bloques = document.querySelectorAll("#registroForm .bloque-equipo");
  bloques.forEach((bloque, i) => {
    const est = bloque.querySelector(".regEstado").value;
    estado.push(est);
    const filaConsumo = [];
    const inputs = bloque.querySelectorAll(".regConsumo");

    if (est === "Apagado") {
      // Un equipo apagado no consume energía (igual que en el Java)
      for (let j = 0; j < numPeriodos; j++) filaConsumo.push(0);
    } else {
      inputs.forEach((inp, j) => {
        let val = parseFloat(inp.value);
        if (isNaN(val) || val < 0) val = 0;
        filaConsumo.push(val);
        if (val > UMBRAL_DIA) {
          avisos.push(`${nombresEquipos[i]} - ${nombresPeriodos[j]}: ${val} kWh supera el umbral de ${UMBRAL_DIA} kWh`);
        }
      });
    }
    consumo.push(filaConsumo);
  });

  datosRegistrados = true;
  recalcular();
  llenarSelectEquipos();

  let texto = "Registro completo. Estadísticas recalculadas.";
  if (avisos.length > 0) texto += "\nAvisos de umbral:\n" + avisos.join("\n");
  mostrarMensaje(texto, "ok");
}

// =========================================================================
// 3. ACTUALIZAR UN EQUIPO ESPECÍFICO (equivale a la opción 2)
// =========================================================================
function generarFormularioActualizar() {
  if (!datosRegistrados) {
    document.getElementById("actualizarForm").innerHTML = "";
    document.getElementById("btnGuardarActualizacion").classList.add("oculto");
    mostrarMensaje("Debe registrar los datos primero (opción 2).", "error");
    return;
  }
  const i = parseInt(document.getElementById("selEquipoActualizar").value);
  let html = `<label>Estado:
      <select id="actEstado">
        <option value="Encendido" ${estado[i] === "Encendido" ? "selected" : ""}>Encendido</option>
        <option value="Apagado" ${estado[i] === "Apagado" ? "selected" : ""}>Apagado</option>
      </select>
    </label><div>`;
  for (let j = 0; j < numPeriodos; j++) {
    html += `<label>${nombresPeriodos[j]} (kWh): <input type="number" class="actConsumo" min="0" step="0.01" value="${consumo[i][j]}"></label>`;
  }
  html += "</div>";
  document.getElementById("actualizarForm").innerHTML = html;
  document.getElementById("btnGuardarActualizacion").classList.remove("oculto");
}

function guardarActualizacion() {
  const i = parseInt(document.getElementById("selEquipoActualizar").value);
  const est = document.getElementById("actEstado").value;
  estado[i] = est;

  if (est === "Apagado") {
    for (let j = 0; j < numPeriodos; j++) consumo[i][j] = 0;
  } else {
    const inputs = document.querySelectorAll(".actConsumo");
    inputs.forEach((inp, j) => {
      let val = parseFloat(inp.value);
      if (isNaN(val) || val < 0) val = 0;
      consumo[i][j] = val;
    });
  }
  recalcular();
  mostrarMensaje(`${nombresEquipos[i]} actualizado. Sistema recalculado.`, "ok");
}

// =========================================================================
// RECÁLCULO GENERAL (equivale al bloque "requiereRecalculo" del Java)
// =========================================================================
function recalcular() {
  totalGeneral = 0;
  contadorAlertas = 0;
  equiposEncendidos = 0;
  totalEquipo = [];
  porcentaje = [];
  costoEquipo = [];
  clasificacion = [];
  tendencia = [];
  alerta = [];
  recomendacion = [];

  for (let i = 0; i < numEquipos; i++) {
    let total = 0;
    for (let j = 0; j < numPeriodos; j++) total += consumo[i][j];
    totalEquipo.push(total);
    totalGeneral += total;
  }

  promedioGeneral = totalGeneral / numEquipos;

  maxConsumo = totalEquipo[0]; minConsumo = totalEquipo[0];
  posMax = 0; posMin = 0;
  for (let i = 1; i < numEquipos; i++) {
    if (totalEquipo[i] > maxConsumo) { maxConsumo = totalEquipo[i]; posMax = i; }
    if (totalEquipo[i] < minConsumo) { minConsumo = totalEquipo[i]; posMin = i; }
  }

  for (let i = 0; i < numEquipos; i++) {
    porcentaje.push(totalGeneral > 0 ? (totalEquipo[i] / totalGeneral) * 100 : 0);
    tendencia.push(calcularTendencia(consumo[i][0], consumo[i][numPeriodos - 1]));
    costoEquipo.push(totalEquipo[i] * tarifa);
  }

  costoGeneral = totalGeneral * tarifa;

  // Igual que en Java: evita división por cero al clasificar
  const promedioParaClasificar = promedioGeneral === 0 ? 0.0001 : promedioGeneral;
  for (let i = 0; i < numEquipos; i++) {
    clasificacion.push(clasificarConsumo(totalEquipo[i], promedioParaClasificar));
  }

  for (let i = 0; i < numEquipos; i++) {
    alerta.push(false);
    if (estado[i] === "Encendido") equiposEncendidos++;
    if ((clasificacion[i] === "ALTO" || clasificacion[i] === "CRITICO") && estado[i] === "Encendido") {
      alerta[i] = true;
      contadorAlertas++;
    }
  }

  for (let i = 0; i < numEquipos; i++) {
    recomendacion.push(generarRecomendacion(nombresEquipos[i], porcentaje[i], clasificacion[i], estado[i]));
  }

  ordenarRanking();
}

// ---------- FUNCIONES AUXILIARES (idénticas en propósito a las del Java) ----------
function clasificarConsumo(consumoEquipo, promedio) {
  const ratio = consumoEquipo / promedio;
  if (ratio >= FACTOR_CRITICO) return "CRITICO";
  if (ratio >= FACTOR_ALTO) return "ALTO";
  if (ratio >= FACTOR_BAJO) return "NORMAL";
  return "BAJO";
}

function calcularTendencia(valorInicial, valorFinal) {
  if (valorFinal > valorInicial) return "AUMENTO";
  if (valorFinal < valorInicial) return "DISMINUCION";
  return "ESTABLE";
}

function generarRecomendacion(nombre, porcentajeEquipo, clase, estadoEquipo) {
  let mensaje;
  const pct = redondear(porcentajeEquipo);
  if (clase === "CRITICO") {
    mensaje = `Revisar de inmediato ${nombre}: representa el ${pct}% del consumo total y está en nivel CRITICO.`;
  } else if (clase === "ALTO") {
    mensaje = `Se recomienda reducir el tiempo de uso de ${nombre}, ya que su consumo representa el ${pct}% del total, por encima del promedio.`;
  } else if (clase === "BAJO") {
    mensaje = `${nombre} tiene un consumo BAJO (${pct}% del total); no requiere acciones.`;
  } else {
    mensaje = `${nombre} funciona en nivel NORMAL (${pct}% del total).`;
  }
  if (estadoEquipo === "Apagado") mensaje += " (Actualmente apagado).";
  return mensaje;
}

function convertirABinario(numero) {
  return numero === 0 ? "0" : numero.toString(2);
}

function ordenarRanking() {
  orden = [...Array(numEquipos).keys()];
  orden.sort((a, b) => totalEquipo[b] - totalEquipo[a]);
}

// ---------- UTILIDADES ----------
function clamp(valor, min, max) { return Math.max(min, Math.min(max, valor)); }
function redondear(n) { return Math.round(n * 100) / 100; }
function money(n) { return redondear(n).toFixed(2); }
function claseHtml(clase) { return `<span class="clase-${clase}">${clase}</span>`; }

function verificarDatos(destinoId) {
  if (!datosRegistrados) {
    document.getElementById(destinoId).innerHTML = "";
    mostrarMensaje("Debe registrar los datos primero (opción 2).", "error");
    return false;
  }
  return true;
}

// =========================================================================
// 4. HISTORIAL POR PERIODO (equivale a la opción 3)
// =========================================================================
function mostrarHistorial() {
  if (!verificarDatos("historialResultado")) return;
  let html = `<table><tr><th>ID (bin)</th><th>Equipo</th><th>Estado</th>`;
  for (let j = 0; j < numPeriodos; j++) html += `<th>${nombresPeriodos[j]}</th>`;
  html += `<th>Total</th></tr>`;
  for (let i = 0; i < numEquipos; i++) {
    html += `<tr><td>${convertirABinario(i + 1)}</td><td>${nombresEquipos[i]}</td><td>${estado[i]}</td>`;
    for (let j = 0; j < numPeriodos; j++) html += `<td>${consumo[i][j]} kWh</td>`;
    html += `<td>${redondear(totalEquipo[i])} kWh</td></tr>`;
  }
  html += "</table>";
  document.getElementById("historialResultado").innerHTML = html;
  ocultarMensaje();
}

// =========================================================================
// 5. ESTADÍSTICA GENERAL (equivale a la opción 4)
// =========================================================================
function mostrarEstadistica() {
  if (!verificarDatos("estadisticaResultado")) return;
  const html = `
    <table>
      <tr><td>Consumo total del sistema</td><td>${redondear(totalGeneral)} kWh</td></tr>
      <tr><td>Consumo promedio por equipo</td><td>${redondear(promedioGeneral)} kWh</td></tr>
      <tr><td>Consumo máximo</td><td>${nombresEquipos[posMax]} (${redondear(maxConsumo)} kWh)</td></tr>
      <tr><td>Consumo mínimo</td><td>${nombresEquipos[posMin]} (${redondear(minConsumo)} kWh)</td></tr>
      <tr><td>Costo total estimado</td><td>$${money(costoGeneral)} (tarifa $${money(tarifa)}/kWh)</td></tr>
    </table>`;
  document.getElementById("estadisticaResultado").innerHTML = html;
  ocultarMensaje();
}

// =========================================================================
// 6. PROCEDIMIENTO MATEMÁTICO (equivale a la opción 5)
// =========================================================================
function mostrarProcedimiento() {
  if (!verificarDatos("procedimientoResultado")) return;
  let html = `<p><strong>Promedio = ConsumoTotal / CantidadEquipos</strong></p>
    <p>Promedio = ${redondear(totalGeneral)} / ${numEquipos} = ${redondear(promedioGeneral)} kWh</p>
    <table><tr><th>Equipo</th><th>Cálculo del porcentaje</th></tr>`;
  for (let i = 0; i < numEquipos; i++) {
    html += `<tr><td>${nombresEquipos[i]}</td><td>(${redondear(totalEquipo[i])} / ${redondear(totalGeneral)}) * 100 = ${redondear(porcentaje[i])}%</td></tr>`;
  }
  html += `</table>
    <p>${redondear(totalGeneral)} kWh = ${redondear(totalGeneral * 1000)} Wh = ${redondear(totalGeneral / 1000)} MWh</p>
    <p><strong>Costo = ConsumoTotal(kWh) * Tarifa($/kWh)</strong></p>
    <table><tr><th>Equipo</th><th>Cálculo del costo</th></tr>`;
  for (let i = 0; i < numEquipos; i++) {
    html += `<tr><td>${nombresEquipos[i]}</td><td>${redondear(totalEquipo[i])} * ${tarifa} = $${money(costoEquipo[i])}</td></tr>`;
  }
  html += `</table><p>Costo total = ${redondear(totalGeneral)} * ${tarifa} = $${money(costoGeneral)}</p>`;
  document.getElementById("procedimientoResultado").innerHTML = html;
  ocultarMensaje();
}

// =========================================================================
// 7. CLASIFICACIÓN Y TENDENCIA (equivale a la opción 6)
// =========================================================================
function mostrarClasificacion() {
  if (!verificarDatos("clasificacionResultado")) return;
  let html = `<table><tr><th>Equipo</th><th>Nivel</th><th>Tendencia (${nombresPeriodos[0]} → ${nombresPeriodos[numPeriodos - 1]})</th></tr>`;
  for (let i = 0; i < numEquipos; i++) {
    html += `<tr><td>${nombresEquipos[i]}</td><td>${claseHtml(clasificacion[i])}</td><td>${tendencia[i]}</td></tr>`;
  }
  html += "</table>";
  document.getElementById("clasificacionResultado").innerHTML = html;
  ocultarMensaje();
}

// =========================================================================
// 8. RANKING (equivale a la opción 7)
// =========================================================================
function mostrarRanking() {
  if (!verificarDatos("rankingResultado")) return;
  let html = `<table><tr><th>#</th><th>Equipo</th><th>Consumo</th><th>%</th><th>Costo</th></tr>`;
  orden.forEach((idx, pos) => {
    html += `<tr><td>${pos + 1}</td><td>${nombresEquipos[idx]}</td><td>${redondear(totalEquipo[idx])} kWh</td><td>${redondear(porcentaje[idx])}%</td><td>$${money(costoEquipo[idx])}</td></tr>`;
  });
  html += "</table>";
  document.getElementById("rankingResultado").innerHTML = html;
  ocultarMensaje();
}

// =========================================================================
// 9. RECOMENDACIONES (equivale a la opción 8)
// =========================================================================
function mostrarRecomendaciones() {
  if (!verificarDatos("recomendacionesResultado")) return;
  let html = "<ul>";
  for (let i = 0; i < numEquipos; i++) html += `<li>${recomendacion[i]}</li>`;
  if (equiposEncendidos > 1 && contadorAlertas > 1) {
    html += `<li>Se recomienda redistribuir los horarios de funcionamiento, ya que existen ${contadorAlertas} equipos con consumo elevado encendidos simultáneamente.</li>`;
  }
  html += "</ul>";
  document.getElementById("recomendacionesResultado").innerHTML = html;
  ocultarMensaje();
}

// =========================================================================
// 10. ALERTAS (equivale a la opción 9)
// =========================================================================
function mostrarAlertas() {
  if (!verificarDatos("alertasResultado")) return;
  let html = "";
  for (let i = 0; i < numEquipos; i++) {
    if (alerta[i]) {
      html += `<p><strong>[ALERTA]</strong> ${nombresEquipos[i]}: nivel ${claseHtml(clasificacion[i])} y está Encendido.</p>`;
    }
  }
  if (contadorAlertas === 0) {
    html = "<p>No se generaron alertas. Ningún equipo encendido supera el nivel Alto/Crítico.</p>";
  }
  document.getElementById("alertasResultado").innerHTML = html;
  ocultarMensaje();
}

// =========================================================================
// 11. SIMULACIÓN (equivale a la opción 10)
// =========================================================================
function simular() {
  estado = [];
  consumo = [];
  let html = "<ul>";
  for (let i = 0; i < numEquipos; i++) {
    const est = Math.random() < 0.5 ? "Encendido" : "Apagado";
    estado.push(est);
    const fila = [];
    for (let j = 0; j < numPeriodos; j++) {
      fila.push(est === "Apagado" ? 0 : Math.floor(Math.random() * 71));
    }
    consumo.push(fila);
    html += `<li>${nombresEquipos[i]} → Estado: ${est}</li>`;
  }
  html += "</ul>";
  datosRegistrados = true;
  recalcular();
  llenarSelectEquipos();
  document.getElementById("simulacionResultado").innerHTML = html;
  mostrarMensaje("Datos simulados generados. Estadísticas recalculadas.", "ok");
}

// =========================================================================
// 12. COSTO ECONÓMICO (equivale a la opción 11)
// =========================================================================
function mostrarCosto() {
  if (!verificarDatos("costoResultado")) return;
  let html = `<table><tr><th>Equipo</th><th>Consumo</th><th>Costo</th></tr>`;
  for (let i = 0; i < numEquipos; i++) {
    html += `<tr><td>${nombresEquipos[i]}</td><td>${redondear(totalEquipo[i])} kWh</td><td>$${money(costoEquipo[i])}</td></tr>`;
  }
  html += `</table><p><strong>Costo total estimado: $${money(costoGeneral)}</strong></p>`;
  document.getElementById("costoResultado").innerHTML = html;
  ocultarMensaje();
}

// =========================================================================
// 13. EXPORTAR REPORTE (equivale a la opción 12, descarga en el navegador)
// =========================================================================
function exportarReporte() {
  if (!datosRegistrados) {
    mostrarMensaje("Debe registrar los datos primero (opción 2).", "error");
    return;
  }
  const formato = document.getElementById("expFormato").value;
  let nombreArchivo = document.getElementById("expNombre").value.trim() || "reporte_energetico";
  let contenido = "";

  if (formato === "txt") {
    contenido += "REPORTE DE MONITOREO Y CONTROL DE CONSUMO ENERGETICO\n";
    contenido += "Universidad Tecnica de Machala - Grupo 5\n\n";
    contenido += `Tarifa aplicada: $${money(tarifa)} /kWh\n\n`;
    for (let i = 0; i < numEquipos; i++) {
      contenido += `Equipo: ${nombresEquipos[i]} (ID bin: ${convertirABinario(i + 1)})  Estado: ${estado[i]}\n`;
      for (let j = 0; j < numPeriodos; j++) contenido += `   ${nombresPeriodos[j]}: ${consumo[i][j]} kWh\n`;
      contenido += `   Total: ${redondear(totalEquipo[i])} kWh | ${redondear(porcentaje[i])}% del total | Costo: $${money(costoEquipo[i])}\n`;
      contenido += `   Clasificacion: ${clasificacion[i]} | Tendencia: ${tendencia[i]}\n`;
      contenido += `   Recomendacion: ${recomendacion[i]}\n\n`;
    }
    contenido += `Consumo total del sistema: ${redondear(totalGeneral)} kWh\n`;
    contenido += `Promedio por equipo: ${redondear(promedioGeneral)} kWh\n`;
    contenido += `Costo total estimado: $${money(costoGeneral)}\n`;
    contenido += `Alertas activas: ${contadorAlertas}\n`;
    nombreArchivo += ".txt";
  } else {
    contenido += "Equipo,Estado,Total_kWh,Porcentaje,Clasificacion,Tendencia,Costo_USD,Alerta\n";
    for (let i = 0; i < numEquipos; i++) {
      contenido += `${nombresEquipos[i]},${estado[i]},${redondear(totalEquipo[i])},${redondear(porcentaje[i])},${clasificacion[i]},${tendencia[i]},${money(costoEquipo[i])},${alerta[i] ? "SI" : "NO"}\n`;
    }
    contenido += `\nTOTAL_GENERAL,${redondear(totalGeneral)}\nPROMEDIO_GENERAL,${redondear(promedioGeneral)}\nCOSTO_TOTAL,${money(costoGeneral)}\n`;
    nombreArchivo += ".csv";
  }

  const blob = new Blob([contenido], { type: "text/plain;charset=utf-8" });
  const enlace = document.createElement("a");
  enlace.href = URL.createObjectURL(blob);
  enlace.download = nombreArchivo;
  enlace.click();
  mostrarMensaje("Reporte exportado: " + nombreArchivo, "ok");
}

// ---------- INICIALIZACIÓN AL CARGAR LA PÁGINA ----------
llenarSelectEquipos();