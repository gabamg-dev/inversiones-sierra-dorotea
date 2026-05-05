/* global ISD */

/** Sincronización: Firestore vs localStorage */
let currentMovements = [];
let dataMode = "local";
let currentFirebaseUser = null;
let currentProjectMember = null;
let remoteAuditLogs = [];
/** @type {null | (() => void)} */
let firebaseMovementsUnsub = null;
/** @type {null | (() => void)} */
let firebaseAuditUnsub = null;

function $(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`No se encontró el elemento #${id}`);
  return el;
}

function formatMoneyCLP(value) {
  // Compatibilidad: reusa helper único si existe
  if (window.ISD && window.ISD.format && window.ISD.format.formatCurrency) return window.ISD.format.formatCurrency(value);
  const n = Number(value);
  const safe = Number.isFinite(n) ? n : 0;
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(safe);
}

/** CLP miles con puntos en el input; el valor persistido es number sin separadores. */
function parseCLPInput(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits === "") return NaN;
  const n = Number(digits);
  return Number.isFinite(n) ? n : NaN;
}

function formatCLPInput(value) {
  const n = typeof value === "number" && Number.isFinite(value) ? value : parseCLPInput(value);
  if (!Number.isFinite(n) || n < 0) return "";
  return String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function wireMontoCLPInput(inputEl) {
  if (!inputEl) return;
  inputEl.addEventListener("input", () => {
    const n = parseCLPInput(inputEl.value);
    if (!Number.isFinite(n)) {
      inputEl.value = "";
      return;
    }
    inputEl.value = formatCLPInput(n);
  });
}

function setVisible(el, visible) {
  el.style.display = visible ? "" : "none";
}

function setText(el, text) {
  el.textContent = String(text);
}

function todayISODate() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function openOverlay(el) {
  el.classList.add("is-open");
  el.setAttribute("aria-hidden", "false");
}

function closeOverlay(el) {
  el.classList.remove("is-open");
  el.setAttribute("aria-hidden", "true");
}

/**
 * Construye el borrador desde un <form>.
 * @param {HTMLFormElement} formEl
 * @param {string} montoInputId id del input de monto formateado (ej. "montoTotal" o "edit_montoTotal")
 */
function buildDraftFromForm(formEl, montoInputId) {
  const data = new FormData(formEl);
  const montoEl = document.getElementById(montoInputId);
  const montoParsed = parseCLPInput(montoEl ? montoEl.value : "");
  const cuentaMedio = String(data.get("cuentaMedioSalida") || "").trim();
  return {
    tipo: String(data.get("tipo") || ""),
    fecha: String(data.get("fecha") || ""),
    categoria: String(data.get("categoria") || ""),
    subcategoria: String(data.get("subcategoria") || ""),
    descripcion: String(data.get("descripcion") || ""),
    montoTotal: montoParsed,
    reparto: String(data.get("reparto") || ""),
    cuentaMedioSalida: cuentaMedio,
    pagadoPor: cuentaMedio,
    origen: String(data.get("origen") || ""),
    destino: String(data.get("destino") || ""),
    proveedor: String(data.get("proveedor") || ""),
    numeroDocumento: String(data.get("numeroDocumento") || ""),
    estado: String(data.get("estado") || ""),
    metodoPago: String(data.get("metodoPago") || ""),
    bancoOrigen: "",
    notas: String(data.get("notas") || ""),
  };
}

function getSelectedFile(inputId) {
  const el = document.getElementById(inputId);
  const file = el && el.files && el.files[0] ? el.files[0] : null;
  return file || null;
}

async function openAttachmentInNewTab(attachmentId, fileType, fallbackName) {
  if (!window.ISD || !window.ISD.attachments || !window.ISD.attachments.getAttachment) throw new Error("Adjuntos no disponibles.");
  const blob = await window.ISD.attachments.getAttachment(attachmentId);
  if (!blob) throw new Error("No se encontró el archivo en IndexedDB.");
  const typed = fileType ? new Blob([blob], { type: fileType }) : blob;
  const url = URL.createObjectURL(typed);
  window.open(url, "_blank", "noopener,noreferrer");
  // revoca después de un tiempo (no hay evento fiable cuando la pestaña cierra)
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

async function downloadAttachment(attachmentId, fileType, fileName) {
  if (!window.ISD || !window.ISD.attachments || !window.ISD.attachments.getAttachment) throw new Error("Adjuntos no disponibles.");
  const blob = await window.ISD.attachments.getAttachment(attachmentId);
  if (!blob) throw new Error("No se encontró el archivo en IndexedDB.");
  const typed = fileType ? new Blob([blob], { type: fileType }) : blob;
  const url = URL.createObjectURL(typed);
  const a = document.createElement("a");
  a.href = url;
  a.download = String(fileName || "comprobante");
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function renderMovementsTable(tbody, movements) {
  tbody.innerHTML = "";

  if (!movements.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 11;
    td.className = "tag muted";
    td.style.border = "none";
    td.textContent = "Aún no hay movimientos. Registra el primero desde el formulario.";
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  for (const m of movements) {
    const tr = document.createElement("tr");
    const categoria = (m.categoria && String(m.categoria).trim()) || "Sin categoría";
    const subcategoria = (m.subcategoria && String(m.subcategoria).trim()) || "Sin subcategoría";
    const tipo = String(m.tipo || "").toLowerCase();
    const tipoClass = tipo === "ingreso" ? "positive" : tipo === "gasto" ? "negative" : "muted";
    const medioSalida = String(m.cuentaMedioSalida || m.pagadoPor || "").trim() || "—";
    const mid = escapeHtml(m.id || "");
    const editedInfo = m.editadoPor && m.fechaEdicion
      ? `<div style="margin-top:6px;color: rgba(167, 177, 214, 0.95); font-size: 12px;">Editado por ${escapeHtml(m.editadoPor)} — ${escapeHtml(new Date(m.fechaEdicion).toLocaleString("es-CL"))}</div>`
      : "";
    const comp = m.comprobante;
    const compHtml = comp
      ? `<div class="att-cell">
           <div><span class="tag ok">Con comprobante</span></div>
           <div class="att-name mono" title="${escapeHtml(comp.fileName || "")}">${escapeHtml(comp.fileName || "")}</div>
           <div class="att-size">${escapeHtml(ISD.attachments.formatFileSize(comp.fileSize || 0))}</div>
           <div class="att-actions">
             <button type="button" class="btn" data-action="view-attachment" data-att-id="${escapeHtml(comp.id)}" data-att-type="${escapeHtml(comp.fileType || "")}" data-att-name="${escapeHtml(comp.fileName || "")}">Ver</button>
             <button type="button" class="btn" data-action="download-attachment" data-att-id="${escapeHtml(comp.id)}" data-att-type="${escapeHtml(comp.fileType || "")}" data-att-name="${escapeHtml(comp.fileName || "")}">Descargar</button>
           </div>
         </div>`
      : `<span class="tag muted att-badge-missing">Sin comprobante</span>`;

    tr.innerHTML = `
      <td>${m.fecha || ""}</td>
      <td><span class="tag ${tipoClass}">${escapeHtml(m.tipo || "")}</span></td>
      <td>
        <div><strong>${escapeHtml(categoria)}</strong></div>
        <div class="mono" style="color: rgba(167, 177, 214, 0.95); font-size: 12px;">${escapeHtml(subcategoria)}</div>
      </td>
      <td>${escapeHtml(m.descripcion || "")}${editedInfo}</td>
      <td class="mono">${formatMoneyCLP(m.montoTotal)}</td>
      <td class="mono">${formatMoneyCLP(m.aporteGabriel)}</td>
      <td class="mono">${formatMoneyCLP(m.aporteVania)}</td>
      <td><span class="tag muted">${escapeHtml(medioSalida)}</span></td>
      <td>${renderEstadoTag(m.estado)}</td>
      <td>${compHtml}</td>
      <td class="table-actions">
        <button type="button" class="btn primary" data-action="edit-movement" data-id="${mid}">Editar</button>
        <button type="button" class="btn danger" data-action="delete-movement" data-id="${mid}">Eliminar</button>
      </td>
    `;
    tbody.appendChild(tr);
  }
}

function renderEstadoTag(estado) {
  const safe = String(estado || "pendiente");
  if (safe === "pagado") return `<span class="tag ok">Pagado</span>`;
  if (safe === "anulado") return `<span class="tag" style="border-color: rgba(255,107,107,0.35); background: rgba(255,107,107,0.08);">Anulado</span>`;
  return `<span class="tag muted">Pendiente</span>`;
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function populateCategorias(categoriaSelect) {
  categoriaSelect.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Selecciona categoría";
  placeholder.selected = true;
  categoriaSelect.appendChild(placeholder);

  const api = window.ISD && window.ISD.categories ? window.ISD.categories : null;
  const groups = api && api.getCategoryGroups ? api.getCategoryGroups() : [];
  for (const groupName of groups) {
    const opt = document.createElement("option");
    opt.value = groupName;
    opt.textContent = groupName;
    categoriaSelect.appendChild(opt);
  }
}

function populateSubcategorias(subcategoriaSelect, categoriaSeleccionada) {
  subcategoriaSelect.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Selecciona subcategoría";
  placeholder.selected = true;
  subcategoriaSelect.appendChild(placeholder);

  const categoria = String(categoriaSeleccionada || "");
  if (!categoria) {
    subcategoriaSelect.disabled = true;
    return;
  }

  subcategoriaSelect.disabled = false;
  const subs =
    window.ISD && window.ISD.categories && window.ISD.categories.getSubcategoriesForGroup
      ? window.ISD.categories.getSubcategoriesForGroup(categoria)
      : [];
  for (const sub of subs) {
    const opt = document.createElement("option");
    opt.value = sub;
    opt.textContent = sub;
    subcategoriaSelect.appendChild(opt);
  }
}

function initCategoriasUI({ categoriaSelect, subcategoriaSelect }) {
  populateCategorias(categoriaSelect);
  populateSubcategorias(subcategoriaSelect, "");

  categoriaSelect.addEventListener("change", () => {
    populateSubcategorias(subcategoriaSelect, categoriaSelect.value);
  });
}

function updateHeaderTags({ movementsCountTag, lastSavedTag }, movements) {
  const count = movements.length;
  setText(movementsCountTag, `${count} movimiento${count === 1 ? "" : "s"}`);
  if (!count) setText(lastSavedTag, "Sin cambios");
}

function renderDashboardMetrics(movements) {
  if (!window.ISD || !window.ISD.reports || !window.ISD.reports.buildDashboardMetrics) {
    console.error("No se encontró ISD.reports. ¿Se cargó reports.js antes que app.js?");
    return;
  }

  const metrics = window.ISD.reports.buildDashboardMetrics(movements);
  setText($("metricCajaActual"), formatMoneyCLP(metrics.cajaActual));
  setText($("metricIngresosCapitalTotal"), formatMoneyCLP(metrics.totalIngresos));
  setText($("metricGastosTotales"), formatMoneyCLP(metrics.gastosTotalesProyecto));
  setText($("metricAporteCapitalGabriel"), formatMoneyCLP(metrics.aporteCapitalGabriel));
  setText($("metricAporteCapitalVania"), formatMoneyCLP(metrics.aporteCapitalVania));
  setText($("metricGastoAsignadoGabriel"), formatMoneyCLP(metrics.gastoAsignadoGabriel));
  setText($("metricGastoAsignadoVania"), formatMoneyCLP(metrics.gastoAsignadoVania));
}

function renderQuickSummary(movements) {
  const wrap = document.getElementById("quickSummary");
  const empty = document.getElementById("quickSummaryEmpty");
  if (!wrap || !empty) return;
  if (!window.ISD || !window.ISD.reports) return;

  const count = (movements || []).length;
  const ult = window.ISD.reports.getUltimosMovimientos(movements, 1)[0];
  const topCat = window.ISD.reports.getTopCategorias(movements, 1)[0];
  const gastoMes = window.ISD.reports.getGastoPorMes(movements);
  const maxMes = [...gastoMes].sort((a, b) => b.total - a.total)[0];

  const chips = [];
  if (topCat) chips.push(`Categoría con mayor gasto: <strong>${escapeHtml(topCat.categoria)}</strong> — ${escapeHtml(formatMoneyCLP(topCat.total))}`);
  if (maxMes && window.ISD && window.ISD.format && window.ISD.format.formatMonthLabel) {
    chips.push(`Mes con mayor gasto: <strong>${escapeHtml(window.ISD.format.formatMonthLabel(maxMes.mes))}</strong> — ${escapeHtml(formatMoneyCLP(maxMes.total))}`);
  }
  if (ult) chips.push(`Último movimiento: <strong>${escapeHtml(String(ult.tipo || ""))}</strong> — ${escapeHtml(String(ult.categoria || ""))} / ${escapeHtml(String(ult.subcategoria || ""))} — ${escapeHtml(formatMoneyCLP(ult.montoTotal || 0))}`);
  chips.push(`Movimientos registrados: <strong>${count}</strong>`);
  const stats = window.ISD.reports.getComprobantesStats ? window.ISD.reports.getComprobantesStats(movements) : null;
  if (stats) chips.push(`Comprobantes: <strong>${stats.conComprobante}</strong> con / <strong>${stats.sinComprobante}</strong> sin`);

  wrap.innerHTML = chips.map((c) => `<span class="quick-chip">${c}</span>`).join("");
  setVisible(empty, chips.length === 0);
}

function renderCharts(movements) {
  if (!window.ISD || !window.ISD.charts || !window.ISD.reports) return;
  const gastoMes = window.ISD.reports.getGastoPorMes(movements).map((r) => ({
    label: window.ISD.format && window.ISD.format.formatMonthLabel ? window.ISD.format.formatMonthLabel(r.mes) : r.mes,
    total: r.total,
  }));
  const gastoCat = window.ISD.reports.getTopCategorias(movements, 10).map((r) => ({ label: r.categoria, total: r.total }));
  const flujo = window.ISD.reports.getFlujoCajaMensual(movements).map((r) => ({
    label: window.ISD.format && window.ISD.format.formatMonthLabel ? window.ISD.format.formatMonthLabel(r.mes) : r.mes,
    ingresos: r.ingresos,
    gastos: r.gastos,
    saldoAcumulado: r.saldoAcumulado,
  }));

  // Re-render seguro
  window.ISD.charts.destroyCharts();
  const okMes = window.ISD.charts.renderGastoMensualChart("chartGastoMensual", gastoMes);
  const okCat = window.ISD.charts.renderGastoCategoriaChart("chartGastoCategoria", gastoCat);
  const okFlujo = window.ISD.charts.renderFlujoCajaChart("chartFlujoCaja", flujo);

  const emptyMes = document.getElementById("chartGastoMensualEmpty");
  const emptyCat = document.getElementById("chartGastoCategoriaEmpty");
  const emptyFlujo = document.getElementById("chartFlujoCajaEmpty");
  if (emptyMes) setVisible(emptyMes, !okMes);
  if (emptyCat) setVisible(emptyCat, !okCat);
  if (emptyFlujo) setVisible(emptyFlujo, !okFlujo);
}

function renderAuditLogs(tbody) {
  let logs;
  if (dataMode === "firebase") {
    logs = Array.isArray(remoteAuditLogs) ? remoteAuditLogs : [];
  } else {
    if (!window.ISD || !window.ISD.audit || !window.ISD.audit.getAuditLogs) return;
    logs = window.ISD.audit.getAuditLogs();
  }
  const sorted = [...logs].sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  const limited = sorted.slice(0, 20);

  tbody.innerHTML = "";
  if (!limited.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 5;
    td.className = "tag muted";
    td.style.border = "none";
    td.textContent = "No hay acciones registradas.";
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  for (const l of limited) {
    const tr = document.createElement("tr");
    const action = String(l.actionType || "");
    const actionLabel = action === "CREATE" ? "CREAR" : action === "UPDATE" ? "EDITAR" : action === "DELETE" ? "ELIMINAR" : action;
    const d = l.details || {};
    const detalle = `${d.categoria || ""} / ${d.subcategoria || ""} / ${formatMoneyCLP(d.montoTotal || 0)}`.trim();
    const createdRaw = l.createdAt;
    const createdDt = createdRaw ? new Date(createdRaw) : null;
    const ts =
      createdDt && !isNaN(createdDt.getTime()) ? createdDt.toLocaleString("es-CL") : "—";
    tr.innerHTML = `
      <td>${escapeHtml(ts)}</td>
      <td><span class="tag muted">${escapeHtml(actionLabel)}</span></td>
      <td>${escapeHtml(l.user || "")}</td>
      <td>${escapeHtml(`${l.summary || ""}${detalle ? `: ${detalle}` : ""}`)}</td>
      <td class="mono">${escapeHtml(l.movementId || "")}</td>
    `;
    tbody.appendChild(tr);
  }
}

function ensureSelectHasValue(selectEl, value) {
  const v = String(value || "");
  if (!v) {
    selectEl.value = "";
    return;
  }
  const exists = Array.from(selectEl.options).some((o) => o.value === v);
  if (!exists) {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = v + " (histórico)";
    selectEl.appendChild(o);
  }
  selectEl.value = v;
}

function initApp() {
  // Logs de debug removidos (ETAPA 3C)

  if (!window.ISD || !window.ISD.categories) {
    console.error("No se encontró ISD.categories.");
    return;
  }
  if (!window.ISD.storage) {
    console.error("No se encontró ISD.storage.");
    return;
  }
  if (!window.ISD.movements) {
    console.error("No se encontró ISD.movements.");
    return;
  }
  if (!window.ISD.reports) {
    console.error("No se encontró ISD.reports.");
    return;
  }
  if (!window.ISD.charts) {
    console.error("No se encontró ISD.charts. ¿Se cargó charts.js y Chart.js CDN?");
    return;
  }
  if (!window.ISD.filters || typeof window.ISD.filters.applyMovementFilters !== "function") {
    console.error("No se encontró ISD.filters. ¿Se cargó filters.js?");
    return;
  }
  if (!window.ISD.attachments || typeof window.ISD.attachments.saveAttachment !== "function") {
    console.error("No se encontró ISD.attachments. ¿Se cargó attachments.js?");
    return;
  }
  if (!window.ISD.uiSections || typeof window.ISD.uiSections.initCollapsibleSections !== "function") {
    console.error("No se encontró ISD.uiSections. ¿Se cargó ui-sections.js?");
    return;
  }
  if (!window.ISD.security || typeof window.ISD.security.validatePin !== "function") {
    console.error("No se encontró ISD.security.validatePin. ¿Se cargó security.js?");
    return;
  }
  if (!window.ISD.audit || typeof window.ISD.audit.addAuditLog !== "function") {
    console.error("No se encontró ISD.audit. ¿Se cargó audit.js?");
    return;
  }
  if (!window.ISD.aiAssistant || typeof window.ISD.aiAssistant.analyzeUserMessage !== "function") {
    console.error("No se encontró ISD.aiAssistant. ¿Se cargó ai-assistant.js?");
    return;
  }
  if (!window.ISD.exportExcel || typeof window.ISD.exportExcel.exportWorkbook !== "function") {
    console.error("No se encontró ISD.exportExcel. ¿Se cargó export-excel.js y SheetJS (XLSX CDN)?");
    return;
  }

  const form = document.getElementById("movementForm");
  const formError = document.getElementById("formError");
  const movementsTbody = document.getElementById("movementsTbody");
  const auditModalTbody = document.getElementById("auditModalTbody");
  const categoria = document.getElementById("categoria");
  const subcategoria = document.getElementById("subcategoria");
  const movementsCountTag = document.getElementById("movementsCountTag");
  const lastSavedTag = document.getElementById("lastSavedTag");
  const btnClearForm = document.getElementById("btnClearForm");
  const btnResetDemo = document.getElementById("btnResetDemo");
  const btnOpenAudit = document.getElementById("btnOpenAudit");
  const btnExportExcel = document.getElementById("btnExportExcel");
  const modalAudit = document.getElementById("modalAudit");
  const btnCloseAudit = document.getElementById("btnCloseAudit");
  const movementsFilteredCount = document.getElementById("movementsFilteredCount");

  const filtersForm = document.getElementById("filtersForm");
  const btnApplyFilters = document.getElementById("btnApplyFilters");
  const btnClearFilters = document.getElementById("btnClearFilters");

  const modalPin = document.getElementById("modalPin");
  const modalPinInput = document.getElementById("modalPinInput");
  const modalPinError = document.getElementById("modalPinError");
  const modalPinTitle = document.getElementById("modalPinTitle");
  const modalPinSubtitle = document.getElementById("modalPinSubtitle");
  const modalPinConfirm = document.getElementById("modalPinConfirm");
  const modalPinCancel = document.getElementById("modalPinCancel");

  const modalConfirmDelete = document.getElementById("modalConfirmDelete");
  const modalConfirmDeleteYes = document.getElementById("modalConfirmDeleteYes");
  const modalConfirmDeleteNo = document.getElementById("modalConfirmDeleteNo");

  const modalEditMovement = document.getElementById("modalEditMovement");
  const editMovementForm = document.getElementById("editMovementForm");
  const editFormError = document.getElementById("editFormError");
  const btnEditCancel = document.getElementById("btnEditCancel");
  const btnEditSave = document.getElementById("btnEditSave");
  const editAttachmentStatus = document.getElementById("edit_attachmentStatus");
  const editAttachmentError = document.getElementById("edit_attachmentError");

  // Asistente IA (Fase IA 1)
  const aiInput = document.getElementById("aiInput");
  const btnAiAnalyze = document.getElementById("btnAiAnalyze");
  const btnAiLoadDraft = document.getElementById("btnAiLoadDraft");
  const aiResponse = document.getElementById("aiResponse");
  const aiMissingRequired = document.getElementById("aiMissingRequired");
  const aiMissingOptional = document.getElementById("aiMissingOptional");
  const aiPreview = document.getElementById("aiPreview");
  const aiIntentTag = document.getElementById("aiIntentTag");

  if (!form || !formError || !movementsTbody || !auditModalTbody || !categoria || !subcategoria || !movementsCountTag || !lastSavedTag || !btnClearForm || !btnResetDemo || !btnOpenAudit || !btnExportExcel || !modalAudit || !btnCloseAudit || !movementsFilteredCount || !filtersForm || !btnApplyFilters || !btnClearFilters) {
    console.error("Elementos base faltantes.");
    return;
  }

  /** @type {{ action: string, draft?: object, id?: string } | null} */
  let pendingPinContext = null;
  let pendingDeleteId = null;
  let pendingDeleteSnapshot = null;
  let currentEditId = null;
  let editCategoriesWired = false;

  /** @type {object|null} */
  let lastAiDraft = null;

  currentMovements = ISD.movements.sortMovementsDesc(ISD.storage.loadMovements());
  let currentFilters = ISD.filters.getDefaultFilters();

  function populateFilterCategorias() {
    const sel = document.getElementById("filterCategoria");
    if (!sel) return;
    sel.innerHTML = "";
    const o0 = document.createElement("option");
    o0.value = "all";
    o0.textContent = "Todas";
    o0.selected = true;
    sel.appendChild(o0);
    const groups = ISD.categories.getCategoryGroups();
    for (const g of groups) {
      const o = document.createElement("option");
      o.value = g;
      o.textContent = g;
      sel.appendChild(o);
    }
  }

  function populateFilterSubcategorias(categoriaValue) {
    const sel = document.getElementById("filterSubcategoria");
    if (!sel) return;
    sel.innerHTML = "";
    const o0 = document.createElement("option");
    o0.value = "all";
    o0.textContent = "Todas";
    o0.selected = true;
    sel.appendChild(o0);
    if (!categoriaValue || categoriaValue === "all") {
      sel.disabled = true;
      return;
    }
    sel.disabled = false;
    const subs = ISD.categories.getSubcategoriesForGroup(categoriaValue);
    for (const s of subs) {
      const o = document.createElement("option");
      o.value = s;
      o.textContent = s;
      sel.appendChild(o);
    }
  }

  function readFiltersFromUI() {
    function v(id, fb) {
      const el = document.getElementById(id);
      return el && typeof el.value !== "undefined" ? String(el.value || "") : String(fb || "");
    }
    return {
      dateFrom: v("filterDateFrom", ""),
      dateTo: v("filterDateTo", ""),
      tipo: v("filterTipo", "all"),
      categoria: v("filterCategoria", "all"),
      subcategoria: v("filterSubcategoria", "all"),
      reparto: v("filterReparto", "all"),
      estado: v("filterEstado", "all"),
      metodoPago: v("filterMetodoPago", "all"),
      searchText: v("filterSearchText", ""),
    };
  }

  function writeFiltersToUI(f) {
    document.getElementById("filterDateFrom").value = f.dateFrom || "";
    document.getElementById("filterDateTo").value = f.dateTo || "";
    document.getElementById("filterTipo").value = f.tipo || "all";
    document.getElementById("filterReparto").value = f.reparto || "all";
    document.getElementById("filterEstado").value = f.estado || "all";
    document.getElementById("filterMetodoPago").value = f.metodoPago || "all";
    document.getElementById("filterSearchText").value = f.searchText || "";
    document.getElementById("filterCategoria").value = f.categoria || "all";
    populateFilterSubcategorias(document.getElementById("filterCategoria").value);
    document.getElementById("filterSubcategoria").value = f.subcategoria || "all";
  }

  function updateFilteredCount(x, y) {
    movementsFilteredCount.textContent = `Mostrando ${x} de ${y} movimientos`;
  }

  function renderMovementsTableWithFilters(allMovements) {
    const filtered = ISD.filters.applyMovementFilters(allMovements, currentFilters);
    renderMovementsTable(movementsTbody, filtered);
    updateFilteredCount(filtered.length, allMovements.length);
  }

  function refreshAllUI() {
    if (dataMode !== "firebase") {
      currentMovements = ISD.movements.sortMovementsDesc(ISD.storage.loadMovements());
    }
    renderMovementsTableWithFilters(currentMovements);
    updateHeaderTags({ movementsCountTag, lastSavedTag }, currentMovements);
    renderDashboardMetrics(currentMovements);
    renderQuickSummary(currentMovements);
    renderCharts(currentMovements);
    renderAuditLogs(auditModalTbody);
  }

  const shellEl = document.getElementById("isdProjectShell");
  const firebaseUnauthEl = document.getElementById("firebaseUnauthorized");

  function setUnauthorizedVisible(show, user) {
    if (!shellEl || !firebaseUnauthEl) return;
    if (show) {
      shellEl.style.display = "none";
      firebaseUnauthEl.style.display = "";
      const em = document.getElementById("firebaseUnauthEmail");
      const uid = document.getElementById("firebaseUnauthUid");
      if (em) em.textContent = user && user.email ? user.email : "";
      if (uid) uid.textContent = user && user.uid ? user.uid : "";
    } else {
      shellEl.style.display = "";
      firebaseUnauthEl.style.display = "none";
    }
  }

  function updateFirebaseChrome() {
    const tag = document.getElementById("firebaseModeTag");
    const svc = ISD.firebaseService;
    const loggedOut = document.getElementById("firebaseLoggedOut");
    const loggedIn = document.getElementById("firebaseLoggedIn");
    if (!svc || typeof svc.isAvailable !== "function" || !svc.isAvailable()) {
      if (tag) tag.textContent = "Modo: local (Firebase no cargado)";
      return;
    }
    const u = svc.getCurrentUser && svc.getCurrentUser();
    if (loggedOut && loggedIn) {
      if (u) {
        loggedOut.style.display = "none";
        loggedIn.style.display = "";
        const line = document.getElementById("firebaseUserLine");
        const uidEl = document.getElementById("firebaseUserUid");
        if (line) line.textContent = `Conectado: ${u.email || u.uid}`;
        if (uidEl) uidEl.textContent = u.uid || "";
      } else {
        loggedOut.style.display = "";
        loggedIn.style.display = "none";
      }
    }
    if (tag) {
      if (dataMode === "firebase") tag.textContent = "Modo: Firestore (online)";
      else if (u) tag.textContent = "Modo: local (sin membresía)";
      else tag.textContent = "Modo: local";
    }
  }

  function teardownFirebaseListeners() {
    if (typeof firebaseMovementsUnsub === "function") {
      firebaseMovementsUnsub();
      firebaseMovementsUnsub = null;
    }
    if (typeof firebaseAuditUnsub === "function") {
      firebaseAuditUnsub();
      firebaseAuditUnsub = null;
    }
  }

  function wireFirebaseAuth() {
    const svc = ISD.firebaseService;
    if (!svc || typeof svc.isAvailable !== "function" || !svc.isAvailable()) return;

    svc.onAuthStateChanged(async (user) => {
      currentFirebaseUser = user;
      teardownFirebaseListeners();
      if (!user) {
        dataMode = "local";
        currentProjectMember = null;
        setUnauthorizedVisible(false, null);
        currentMovements = ISD.movements.sortMovementsDesc(ISD.storage.loadMovements());
        remoteAuditLogs = [];
        updateFirebaseChrome();
        refreshAllUI();
        return;
      }

      const mem = await svc.checkProjectMembership(user.uid);
      if (!mem.authorized) {
        dataMode = "local";
        currentProjectMember = null;
        currentMovements = ISD.movements.sortMovementsDesc(ISD.storage.loadMovements());
        remoteAuditLogs = [];
        setUnauthorizedVisible(true, user);
        updateFirebaseChrome();
        refreshAllUI();
        return;
      }

      currentProjectMember = mem.member;
      dataMode = "firebase";
      setUnauthorizedVisible(false, null);
      firebaseMovementsUnsub = svc.watchMovements((list) => {
        currentMovements = Array.isArray(list) ? list : [];
        refreshAllUI();
      });
      firebaseAuditUnsub = svc.watchAuditLogs((logs) => {
        remoteAuditLogs = Array.isArray(logs) ? logs : [];
        renderAuditLogs(auditModalTbody);
      });
      updateFirebaseChrome();
      refreshAllUI();
    });

    const btnIn = document.getElementById("btnFirebaseSignIn");
    const btnOut = document.getElementById("btnFirebaseSignOut");
    const errEl = document.getElementById("firebaseLoginError");
    const emailEl = document.getElementById("firebaseEmail");
    const passEl = document.getElementById("firebasePassword");
    if (btnIn && emailEl && passEl) {
      btnIn.addEventListener("click", async () => {
        if (errEl) {
          setVisible(errEl, false);
          setText(errEl, "");
        }
        try {
          await svc.signIn(emailEl.value, passEl.value);
        } catch (e) {
          if (errEl) {
            setText(errEl, String((e && e.message) || e || "Error de inicio de sesión."));
            setVisible(errEl, true);
          }
        }
      });
    }
    if (btnOut) {
      btnOut.addEventListener("click", () => {
        svc.signOut().catch(() => {});
      });
    }
  }

  function resetMainFormAfterCreate() {
    form.reset();
    $("fecha").value = todayISODate();
    $("montoTotal").value = "";
    categoria.value = "";
    populateSubcategorias(subcategoria, "");
  }

  function openPinModal(context) {
    pendingPinContext = context;
    let title = "Confirmar con PIN";
    let subtitle = "Introduce el PIN del sistema para continuar.";
    if (context.action === "create") {
      title = "Registrar movimiento";
      subtitle = "Introduce el PIN para guardar el nuevo movimiento.";
    } else if (context.action === "update") {
      title = "Guardar cambios";
      subtitle = "Introduce el PIN para aplicar la edición.";
    } else if (context.action === "delete") {
      title = "Eliminar movimiento";
      subtitle = "Introduce el PIN para eliminar definitivamente.";
    }
    setText(modalPinTitle, title);
    setText(modalPinSubtitle, subtitle);
    modalPinInput.value = "";
    setVisible(modalPinError, false);
    setText(modalPinError, "");
    openOverlay(modalPin);
    modalPinInput.focus();
  }

  function closePinModal() {
    closeOverlay(modalPin);
    pendingPinContext = null;
    modalPinInput.value = "";
    setVisible(modalPinError, false);
  }

  async function runConfirmedAction(ctx) {
    const auditUser =
      dataMode === "firebase" && currentFirebaseUser && currentFirebaseUser.email
        ? currentFirebaseUser.email
        : ISD.audit.CURRENT_USER;

    if (ctx.action === "create") {
      if (dataMode === "firebase") {
        const movement = ISD.movements.createMovementFromDraft(ctx.draft);
        movement.comprobante = null;
        const docId = await ISD.firebaseService.createMovement(movement);
        let attachmentMeta = null;
        if (ctx.attachmentFile) {
          attachmentMeta = await ISD.attachments.saveAttachment(ctx.attachmentFile);
          await ISD.firebaseService.updateMovement(docId, { comprobante: attachmentMeta });
        }
        const finalMovement = { ...movement, id: docId, comprobante: attachmentMeta };
        await ISD.firebaseService.createAuditLog({
          actionType: "CREATE",
          movementId: docId,
          user: auditUser,
          summary: "Movimiento creado",
          details: ISD.audit.pickMovementDetails(finalMovement),
        });
      } else {
        let attachmentMeta = null;
        if (ctx.attachmentFile) {
          attachmentMeta = await ISD.attachments.saveAttachment(ctx.attachmentFile);
        }
        const movement = ISD.movements.createMovementFromDraft(ctx.draft);
        movement.comprobante = attachmentMeta;
        currentMovements = ISD.movements.sortMovementsDesc([movement, ...currentMovements]);
        ISD.storage.saveMovements(currentMovements);
        ISD.audit.addAuditLog({
          actionType: "CREATE",
          movementId: movement.id,
          user: auditUser,
          summary: "Movimiento creado",
          details: ISD.audit.pickMovementDetails(movement),
        });
      }
    } else if (ctx.action === "update") {
      const existing = currentMovements.find((m) => String(m.id) === String(ctx.id));
      if (existing) {
        const wantsDelete = Boolean(ctx.deleteAttachment);
        const newFile = ctx.attachmentFile || null;

        let nextComprobante = existing.comprobante || null;
        let oldAttachmentId = existing.comprobante && existing.comprobante.id ? existing.comprobante.id : null;

        if (wantsDelete) {
          nextComprobante = null;
        } else if (newFile) {
          nextComprobante = await ISD.attachments.saveAttachment(newFile);
        }

        const updated = ISD.movements.applyDraftToMovement(existing, ctx.draft);
        updated.comprobante = nextComprobante;
        updated.editadoPor = auditUser;
        updated.fechaEdicion = new Date().toISOString();

        const newAttachmentId = nextComprobante && nextComprobante.id ? nextComprobante.id : null;
        if (oldAttachmentId && oldAttachmentId !== newAttachmentId && (wantsDelete || newFile)) {
          try {
            await ISD.attachments.deleteAttachment(oldAttachmentId);
          } catch {
            /* noop */
          }
        }

        if (dataMode === "firebase") {
          await ISD.firebaseService.updateMovement(ctx.id, updated);
          await ISD.firebaseService.createAuditLog({
            actionType: "UPDATE",
            movementId: String(updated.id),
            user: auditUser,
            summary: "Movimiento editado",
            details: ISD.audit.pickMovementDetails(updated),
          });
        } else {
          ISD.storage.updateMovement(ctx.id, updated);
          ISD.audit.addAuditLog({
            actionType: "UPDATE",
            movementId: updated.id,
            user: auditUser,
            summary: "Movimiento editado",
            details: ISD.audit.pickMovementDetails(updated),
          });
        }
      }
      if (dataMode !== "firebase") {
        currentMovements = ISD.movements.sortMovementsDesc(ISD.storage.loadMovements());
      }
    } else if (ctx.action === "delete") {
      const snapshot = ctx.snapshot || pendingDeleteSnapshot || currentMovements.find((m) => String(m.id) === String(ctx.id));

      if (dataMode === "firebase") {
        if (snapshot) {
          await ISD.firebaseService.createAuditLog({
            actionType: "DELETE",
            movementId: String(snapshot.id),
            user: auditUser,
            summary: "Movimiento eliminado",
            details: ISD.audit.pickMovementDetails(snapshot),
          });
        }
        const attId = snapshot && snapshot.comprobante && snapshot.comprobante.id ? snapshot.comprobante.id : null;
        if (attId) {
          try {
            await ISD.attachments.deleteAttachment(attId);
          } catch {
            /* noop */
          }
        }
        await ISD.firebaseService.deleteMovement(ctx.id);
      } else {
        if (snapshot) {
          ISD.audit.addAuditLog({
            actionType: "DELETE",
            movementId: snapshot.id,
            user: auditUser,
            summary: "Movimiento eliminado",
            details: ISD.audit.pickMovementDetails(snapshot),
          });
        }
        const attId = snapshot && snapshot.comprobante && snapshot.comprobante.id ? snapshot.comprobante.id : null;
        if (attId) {
          try {
            await ISD.attachments.deleteAttachment(attId);
          } catch {
            /* noop */
          }
        }
        ISD.storage.deleteMovement(ctx.id);
        currentMovements = ISD.movements.sortMovementsDesc(ISD.storage.loadMovements());
      }
    }
    refreshAllUI();
    setText(lastSavedTag, `Actualizado ${new Date().toLocaleString("es-CL")}`);
  }

  async function handlePinConfirm() {
    const ctx = pendingPinContext;
    if (!ctx) return;
    const pinVal = modalPinInput.value;
    if (!ISD.security.validatePin(pinVal)) {
      setText(modalPinError, "PIN incorrecto. No se realizó ningún cambio.");
      setVisible(modalPinError, true);
      return;
    }
    // Evita doble click
    modalPinConfirm.disabled = true;
    try {
      const action = ctx.action;
      await runConfirmedAction(ctx);
      closePinModal();
      if (action === "create") {
        resetMainFormAfterCreate();
        setVisible(formError, false);
        // limpia input file
        const c = document.getElementById("comprobante");
        if (c) c.value = "";
      }
      if (action === "update") {
        closeEditModal();
      }
    } catch (err) {
      setText(modalPinError, String((err && err.message) || err || "Error guardando la acción."));
      setVisible(modalPinError, true);
    } finally {
      modalPinConfirm.disabled = false;
    }
  }

  function ensureEditCategoriesOnce() {
    if (editCategoriesWired) return;
    populateCategorias($("edit_categoria"));
    populateSubcategorias($("edit_subcategoria"), "");
    $("edit_categoria").addEventListener("change", () => {
      populateSubcategorias($("edit_subcategoria"), $("edit_categoria").value);
    });
    editCategoriesWired = true;
  }

  function openEditModal(movement) {
    currentEditId = movement.id;
    ensureEditCategoriesOnce();
    setText($("modalEditHint"), `Editando movimiento: ${movement.id}`);
    $("edit_tipo").value = movement.tipo || "gasto";
    $("edit_fecha").value = movement.fecha || "";
    $("edit_categoria").value = movement.categoria || "";
    populateSubcategorias($("edit_subcategoria"), $("edit_categoria").value);
    $("edit_subcategoria").value = movement.subcategoria || "";
    $("edit_descripcion").value = movement.descripcion || "";
    $("edit_montoTotal").value = formatCLPInput(movement.montoTotal);
    $("edit_reparto").value = ISD.movements.inferRepartoFromMovement(movement);
    ensureSelectHasValue($("edit_cuentaMedioSalida"), movement.cuentaMedioSalida || movement.pagadoPor || "Caja del proyecto");
    $("edit_origen").value = movement.origen || "";
    $("edit_destino").value = movement.destino || "";
    $("edit_proveedor").value = movement.proveedor || "";
    $("edit_numeroDocumento").value = movement.numeroDocumento || "";
    $("edit_estado").value = movement.estado || "pagado";
    ensureSelectHasValue($("edit_metodoPago"), movement.metodoPago || "");
    $("edit_notas").value = movement.notas || "";
    // Estado comprobante
    if (editAttachmentStatus) {
      if (movement.comprobante) {
        editAttachmentStatus.textContent = `Actual: ${movement.comprobante.fileName} (${ISD.attachments.formatFileSize(movement.comprobante.fileSize)})`;
      } else {
        editAttachmentStatus.textContent = "Sin comprobante.";
      }
    }
    const delCb = document.getElementById("edit_deleteComprobante");
    if (delCb) delCb.checked = false;
    const fileEl = document.getElementById("edit_comprobante");
    if (fileEl) fileEl.value = "";
    if (editAttachmentError) { setVisible(editAttachmentError, false); setText(editAttachmentError, ""); }
    setVisible(editFormError, false);
    setText(editFormError, "");
    openOverlay(modalEditMovement);
  }

  function closeEditModal() {
    currentEditId = null;
    closeOverlay(modalEditMovement);
    setVisible(editFormError, false);
    setText(editFormError, "");
  }

  /** Crear: validación de formulario (sin PIN); abre modal PIN. */
  function handleCreateMovement() {
    setVisible(formError, false);
    setText(formError, "");
    const draft = buildDraftFromForm(form, "montoTotal");
    const errors = ISD.movements.validateMovementDraft(draft);
    if (errors.length) {
      setText(formError, errors.join(" "));
      setVisible(formError, true);
      return;
    }
    const file = getSelectedFile("comprobante");
    const v = ISD.attachments.validateAttachment(file);
    if (file && !v.ok) {
      setText(formError, v.error);
      setVisible(formError, true);
      return;
    }
    openPinModal({ action: "create", draft, attachmentFile: file });
  }

  /** Editar: abre modal de edición con datos cargados. */
  function handleEditMovement(id) {
    const movement = currentMovements.find((m) => String(m.id) === String(id));
    if (!movement) return;
    openEditModal(movement);
  }

  /** Eliminar: confirmación textual y luego PIN. */
  function handleDeleteMovement(id) {
    pendingDeleteId = id;
    pendingDeleteSnapshot = currentMovements.find((m) => String(m.id) === String(id)) || null;
    openOverlay(modalConfirmDelete);
  }

  wireFirebaseAuth();
  updateFirebaseChrome();

  initCategoriasUI({ categoriaSelect: categoria, subcategoriaSelect: subcategoria });
  categoria.disabled = false;

  // console.info(`Categorías cargadas: ${ISD.categories.getCategoryGroups().length}`); // opcional si se requiere diagnóstico

  populateFilterCategorias();
  populateFilterSubcategorias("all");
  writeFiltersToUI(currentFilters);
  document.getElementById("filterCategoria").addEventListener("change", () => {
    const v = document.getElementById("filterCategoria").value;
    populateFilterSubcategorias(v);
  });

  $("fecha").value = todayISODate();
  wireMontoCLPInput(document.getElementById("montoTotal"));
  wireMontoCLPInput(document.getElementById("edit_montoTotal"));

  refreshAllUI();

  // Secciones colapsables (persistidas en localStorage)
  ISD.uiSections.initCollapsibleSections({
    onToggle: function (sectionId, isOpen) {
      if (sectionId === "charts" && isOpen) {
        // Chart.js puede requerir recalcular tamaños tras mostrar el canvas.
        window.dispatchEvent(new Event("resize"));
        requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
        // Re-render de charts para asegurar layout correcto (sin tocar métricas globales).
        try {
          renderCharts(currentMovements);
        } catch {
          // noop
        }
      }
    },
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    handleCreateMovement();
  });

  // -----------------------------
  // Asistente IA (Fase IA 1 local)
  // -----------------------------

  function setAiVisible(el, visible) {
    if (!el) return;
    el.style.display = visible ? "" : "none";
  }

  function setAiText(el, text) {
    if (!el) return;
    el.textContent = String(text || "");
  }

  function aiFieldLabel(key) {
    const map = {
      tipo: "tipo",
      fecha: "fecha",
      categoria: "categoría",
      subcategoria: "subcategoría",
      montoTotal: "monto total",
      reparto: "reparto",
      cuentaMedioSalida: "cuenta / medio de salida",
      origen: "origen",
      destino: "destino",
      estado: "estado",
      metodoPago: "método de pago",
      descripcion: "descripción",
      proveedor: "proveedor",
      numeroDocumento: "nº documento",
      notas: "notas",
      comprobante: "comprobante",
    };
    return map[key] || key;
  }

  function formatAiDraftPreview(draft) {
    const d = draft || {};
    const tipoVal = mapTipoToValue(d.tipo) || String(d.tipo || "");
    const estadoVal = mapEstadoToValue(d.estado) || String(d.estado || "");
    const repartoVal = mapRepartoToValue(d.reparto) || String(d.reparto || "");

    const tipoTxt = tipoVal ? tipoVal.charAt(0).toUpperCase() + tipoVal.slice(1) : "";
    const estadoTxt = estadoVal ? estadoVal.charAt(0).toUpperCase() + estadoVal.slice(1) : "";
    const repartoTxt = repartoVal === "gabriel" ? "Gabriel" : repartoVal === "vania" ? "Vania" : repartoVal === "ambos" ? "50/50" : String(d.reparto || "");
    const mp = String(d.metodoPago || "");
    const monto = Number(d.montoTotal);
    const montoTxt = Number.isFinite(monto) ? formatMoneyCLP(monto) : String(d.montoTotal || "");

    return [
      `Tipo: ${tipoTxt}`,
      `Fecha: ${String(d.fecha || "")}`,
      `Categoría: ${String(d.categoria || "")}`,
      `Subcategoría: ${String(d.subcategoria || "")}`,
      `Monto: ${montoTxt}`,
      `Reparto: ${repartoTxt}`,
      `Cuenta / medio de salida: ${String(d.cuentaMedioSalida || "")}`,
      `Origen: ${String(d.origen || "")}`,
      `Destino: ${String(d.destino || "")}`,
      `Estado: ${estadoTxt}`,
      `Método de pago: ${mp}`,
      `Descripción: ${String(d.descripcion || "")}`,
    ].join("\n");
  }

  function selectHasOptionValue(selectEl, value) {
    if (!selectEl) return false;
    const v = String(value || "");
    if (!v) return false;
    return Array.from(selectEl.options).some((o) => o.value === v);
  }

  function mapRepartoToValue(rawValue) {
    const v = String(rawValue || "").trim().toLowerCase();
    if (!v) return "";
    if (v === "gabriel" || v === "100% gabriel") return "gabriel";
    if (v === "vania" || v === "100% vania") return "vania";
    if (v === "ambos" || v === "50/50" || v.includes("50")) return "ambos";
    return v; // fallback
  }

  function mapTipoToValue(rawValue) {
    const v = String(rawValue || "").trim().toLowerCase();
    if (v === "gasto" || v === "ingreso" || v === "ajuste") return v;
    return "";
  }

  function mapEstadoToValue(rawValue) {
    const v = String(rawValue || "").trim().toLowerCase();
    if (v === "pagado" || v === "pendiente" || v === "anulado" || v === "reembolsado") return v;
    // Si viene "Pagado" con mayúscula u otras variantes
    if (v.includes("pag")) return "pagado";
    if (v.includes("pend")) return "pendiente";
    if (v.includes("anul")) return "anulado";
    if (v.includes("reemb")) return "reembolsado";
    return "";
  }

  function mapCuentaToValue(selectEl, rawValue) {
    const wanted = String(rawValue || "").trim();
    if (!wanted) return "";
    if (selectHasOptionValue(selectEl, wanted)) return wanted;

    // Fallbacks seguros (según HTML actual)
    if (wanted === "Efectivo Gabriel" && selectHasOptionValue(selectEl, "Cuenta Gabriel")) return "Cuenta Gabriel";
    if (wanted === "Efectivo Vania" && selectHasOptionValue(selectEl, "Cuenta Vania")) return "Cuenta Vania";
    if ((wanted === "Cuenta del proyecto" || wanted === "Cuenta proyecto") && selectHasOptionValue(selectEl, "Caja del proyecto")) return "Caja del proyecto";
    return wanted; // se intentará cargar como histórico si no existe
  }

  function loadAIDraftToMainForm(draft) {
    if (!draft) return;

    // Tipo
    const tipoEl = document.getElementById("tipo");
    if (tipoEl) {
      const tipoVal = mapTipoToValue(draft.tipo);
      if (tipoVal) tipoEl.value = tipoVal;
    }

    // Fecha
    const fechaEl = document.getElementById("fecha");
    if (fechaEl && draft.fecha) fechaEl.value = String(draft.fecha);

    // Categoría / subcategoría
    if (draft.categoria) {
      categoria.value = String(draft.categoria);
      // Orden obligatorio: set categoría -> poblar subs -> set subcategoría
      populateSubcategorias(subcategoria, categoria.value);
      if (draft.subcategoria) {
        subcategoria.value = String(draft.subcategoria);
      }
    }

    // Monto
    const montoEl = document.getElementById("montoTotal");
    if (montoEl) {
      const n = Number(draft.montoTotal);
      montoEl.value = Number.isFinite(n) ? formatCLPInput(n) : "";
    }

    // Reparto
    const repartoEl = document.getElementById("reparto");
    if (repartoEl && draft.reparto) {
      const rv = mapRepartoToValue(draft.reparto);
      if (rv) repartoEl.value = rv;
    }

    // Cuenta / medio salida
    const cuentaEl = document.getElementById("cuentaMedioSalida");
    if (cuentaEl) {
      const mapped = mapCuentaToValue(cuentaEl, draft.cuentaMedioSalida);
      ensureSelectHasValue(cuentaEl, mapped);
    }

    // Origen/destino
    const origenEl = document.getElementById("origen");
    const destinoEl = document.getElementById("destino");
    if (origenEl && draft.origen) origenEl.value = String(draft.origen);
    if (destinoEl && draft.destino) destinoEl.value = String(draft.destino);

    // Estado
    const estadoEl = document.getElementById("estado");
    if (estadoEl && draft.estado) {
      const ev = mapEstadoToValue(draft.estado);
      ensureSelectHasValue(estadoEl, ev || draft.estado);
    }

    // Método de pago
    const mpEl = document.getElementById("metodoPago");
    if (mpEl && draft.metodoPago) ensureSelectHasValue(mpEl, draft.metodoPago);

    // Opcionales
    const descEl = document.getElementById("descripcion");
    const provEl = document.getElementById("proveedor");
    const numDocEl = document.getElementById("numeroDocumento");
    const notasEl = document.getElementById("notas");
    if (descEl && draft.descripcion) descEl.value = String(draft.descripcion);
    if (provEl && draft.proveedor) provEl.value = String(draft.proveedor);
    if (numDocEl && draft.numeroDocumento) numDocEl.value = String(draft.numeroDocumento);
    if (notasEl && draft.notas) notasEl.value = String(draft.notas);

    // No toca comprobante: debe adjuntarse manualmente.
  }

  function resetAiUI() {
    lastAiDraft = null;
    if (btnAiLoadDraft) btnAiLoadDraft.disabled = true;
    setAiText(aiMissingRequired, "—");
    setAiText(aiMissingOptional, "—");
    setAiText(aiPreview, "—");
    setAiText(aiResponse, "");
    setAiVisible(aiResponse, false);
    if (aiIntentTag) aiIntentTag.textContent = "Listo";
  }

  function normalizeRemoteDraft(d) {
    if (!d || typeof d !== "object") return null;
    const out = { ...d };
    if (out.montoTotal != null) {
      const n = Number(out.montoTotal);
      out.montoTotal = Number.isFinite(n) ? n : out.montoTotal;
    }
    const r = String(out.reparto || "").toLowerCase();
    if (r.includes("gabriel")) out.reparto = "gabriel";
    else if (r.includes("vania")) out.reparto = "vania";
    else if (r.includes("ambos") || r.includes("50") || r === "50/50") out.reparto = "ambos";
    const t = String(out.tipo || "").toLowerCase();
    if (t.includes("ingreso")) out.tipo = "ingreso";
    else if (t.includes("gasto")) out.tipo = "gasto";
    else if (t.includes("ajuste")) out.tipo = "ajuste";
    return out;
  }

  function applyRemoteAiResponse(json) {
    const mode = json.mode || "answer";
    if (aiIntentTag) aiIntentTag.textContent = `REMOTE_${String(mode).toUpperCase()}`;

    setAiText(aiResponse, json.message || "");
    setVisible(aiResponse, true);

    const mr = json.missingRequired || [];
    const mo = json.missingOptional || [];
    setAiText(aiMissingRequired, mr.length ? `Faltan: ${mr.map(aiFieldLabel).join(", ")}` : "OK (obligatorios)");
    setAiText(aiMissingOptional, mo.length ? `Opcionales: ${mo.map(aiFieldLabel).join(", ")}` : "OK");

    if (json.warnings && json.warnings.length) {
      /* opcional: podríamos mostrar warnings en aiResponse; el mensaje principal ya viene en json.message */
    }

    const normalized = json.draft ? normalizeRemoteDraft(json.draft) : null;
    if (normalized && Object.keys(normalized).length) {
      lastAiDraft = normalized;
      setAiText(aiPreview, formatAiDraftPreview(lastAiDraft));
      const canLoad = mr.length === 0;
      if (btnAiLoadDraft) btnAiLoadDraft.disabled = !canLoad;
    } else {
      lastAiDraft = null;
      setAiText(aiPreview, "—");
      if (btnAiLoadDraft) btnAiLoadDraft.disabled = true;
    }
  }

  function applyLocalAiResult(result, prefixMessage) {
    const intent = result && result.intent ? String(result.intent) : "UNKNOWN";
    if (aiIntentTag) aiIntentTag.textContent = intent;

    const prefix = prefixMessage ? `${prefixMessage}\n\n` : "";

    if (intent === "QUERY_DATA") {
      setAiText(aiResponse, prefix + (result.answer || ""));
      setAiVisible(aiResponse, true);
      return;
    }

    if (intent === "CREATE_MOVEMENT") {
      const missingReq = (result.missingRequired || []).map(aiFieldLabel);
      const missingOpt = (result.missingOptional || []).map(aiFieldLabel);

      if (missingReq.length) {
        setAiText(aiMissingRequired, `Faltan: ${missingReq.join(", ")}`);
        setAiText(
          aiResponse,
          prefix +
            "Me faltan datos obligatorios. Puedes responder en el mismo texto agregando lo faltante (ej: fecha, categoría/subcategoría, estado, método de pago...)."
        );
        setAiVisible(aiResponse, true);
      } else {
        setAiText(aiMissingRequired, "OK (completo)");
      }

      if (missingOpt.length) {
        setAiText(aiMissingOptional, `Opcionales faltantes: ${missingOpt.join(", ")}`);
      } else {
        setAiText(aiMissingOptional, "OK");
      }

      setAiText(aiPreview, formatAiDraftPreview(result.draft || {}));

      if (result.isValid) {
        lastAiDraft = result.draft || null;
        if (btnAiLoadDraft) btnAiLoadDraft.disabled = false;
        if (!missingOpt.length) {
          setAiText(
            aiResponse,
            prefix + "El borrador está completo. Si quieres, cárgalo al formulario para revisarlo y guardarlo (con PIN)."
          );
          setAiVisible(aiResponse, true);
        } else {
          setAiText(
            aiResponse,
            prefix +
              "El movimiento puede guardarse. Si quieres, cárgalo al formulario; los campos opcionales puedes completarlos después."
          );
          setAiVisible(aiResponse, true);
        }
      }
      return;
    }

    setAiText(
      aiResponse,
      prefix + (result.answer || "No pude entender la intención. Prueba con una instrucción de registro o una consulta (ej: “caja actual”).")
    );
    setAiVisible(aiResponse, true);
  }

  async function handleAiAnalyze() {
    if (!aiInput) return;
    const text = String(aiInput.value || "").trim();
    resetAiUI();
    if (!text) {
      setAiText(aiResponse, "Escribe una instrucción o pregunta para analizar.");
      setAiVisible(aiResponse, true);
      return;
    }

    const tryRemote =
      dataMode === "firebase" &&
      ISD.firebaseService &&
      ISD.firebaseService.isAvailable &&
      ISD.firebaseService.isAvailable() &&
      typeof ISD.firebaseService.getIdToken === "function";

    let remoteFailed = false;

    if (tryRemote) {
      try {
        const token = await ISD.firebaseService.getIdToken(false);
        const res = await fetch("/api/ai-assistant", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            message: text,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            currentDate: new Date().toISOString(),
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (json && json.ok) {
          applyRemoteAiResponse(json);
          return;
        }
        throw new Error(json.message || json.error || "Respuesta inválida del servidor.");
      } catch (e) {
        remoteFailed = true;
        console.warn("IA remota:", e);
      }
    }

    const result = ISD.aiAssistant.analyzeUserMessage(text, currentMovements);
    applyLocalAiResult(
      result,
      remoteFailed ? "No se pudo usar IA real. Se usó asistente local." : ""
    );
  }

  if (btnAiAnalyze) btnAiAnalyze.addEventListener("click", handleAiAnalyze);
  if (btnAiLoadDraft) {
    btnAiLoadDraft.addEventListener("click", () => {
      if (!lastAiDraft) return;
      try {
        loadAIDraftToMainForm(lastAiDraft);
        if (aiResponse) {
          aiResponse.textContent = "Borrador cargado al formulario. Revísalo y presiona Guardar movimiento para confirmar con PIN.";
          aiResponse.style.display = "";
        }
        setText(lastSavedTag, "Borrador IA cargado (no guardado)");
      } catch (e) {
        if (aiResponse) {
          aiResponse.textContent = `No se pudo cargar el borrador al formulario: ${String(e && e.message ? e.message : e)}`;
          aiResponse.style.display = "";
        }
      }
    });
  }
  resetAiUI();

  filtersForm.addEventListener("submit", (e) => {
    e.preventDefault();
    currentFilters = readFiltersFromUI();
    renderMovementsTableWithFilters(currentMovements);
  });

  btnClearFilters.addEventListener("click", () => {
    currentFilters = ISD.filters.getDefaultFilters();
    writeFiltersToUI(currentFilters);
    renderMovementsTableWithFilters(currentMovements);
  });

  btnClearForm.addEventListener("click", () => {
    form.reset();
    $("fecha").value = todayISODate();
    $("montoTotal").value = "";
    setVisible(formError, false);
    setText(formError, "");
    categoria.value = "";
    populateSubcategorias(subcategoria, "");
  });

  btnResetDemo.addEventListener("click", () => {
    if (dataMode === "firebase") {
      alert(
        "Estás en modo Firestore: los movimientos están en la nube. Este botón solo borra datos locales cuando trabajas sin Firebase activo como fuente."
      );
      return;
    }
    ISD.storage.resetAll();
    currentMovements = [];
    refreshAllUI();
    setText(lastSavedTag, "Local reseteado");
  });

  btnOpenAudit.addEventListener("click", () => {
    renderAuditLogs(auditModalTbody);
    openOverlay(modalAudit);
  });

  btnExportExcel.addEventListener("click", () => {
    try {
      const allMovements =
        dataMode === "firebase"
          ? ISD.movements.sortMovementsDesc(currentMovements)
          : ISD.movements.sortMovementsDesc(ISD.storage.loadMovements());
      const auditLogs = dataMode === "firebase" ? remoteAuditLogs : ISD.audit.getAuditLogs();
      const fileName = ISD.exportExcel.exportWorkbook({
        movements: allMovements,
        auditLogs,
        reports: ISD.reports,
      });
      setText(lastSavedTag, `Exportado: ${fileName}`);
    } catch (e) {
      console.error(e);
      setText(lastSavedTag, "Error exportando Excel");
      alert(`Error al exportar Excel: ${String(e && e.message ? e.message : e)}`);
    }
  });

  btnCloseAudit.addEventListener("click", () => {
    closeOverlay(modalAudit);
  });

  modalPinConfirm.addEventListener("click", handlePinConfirm);
  modalPinCancel.addEventListener("click", closePinModal);
  modalPinInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handlePinConfirm();
    }
  });

  modalConfirmDeleteNo.addEventListener("click", () => {
    closeOverlay(modalConfirmDelete);
    pendingDeleteId = null;
  });
  modalConfirmDeleteYes.addEventListener("click", () => {
    const id = pendingDeleteId;
    const snapshot = pendingDeleteSnapshot;
    closeOverlay(modalConfirmDelete);
    pendingDeleteId = null;
    pendingDeleteSnapshot = null;
    if (id == null) return;
    openPinModal({ action: "delete", id, snapshot });
  });

  btnEditCancel.addEventListener("click", closeEditModal);
  btnEditSave.addEventListener("click", () => {
    if (!currentEditId) return;
    setVisible(editFormError, false);
    setText(editFormError, "");
    const draft = buildDraftFromForm(editMovementForm, "edit_montoTotal");
    const errors = ISD.movements.validateMovementDraft(draft);
    if (errors.length) {
      setText(editFormError, errors.join(" "));
      setVisible(editFormError, true);
      return;
    }
    const newFile = getSelectedFile("edit_comprobante");
    const delCb = document.getElementById("edit_deleteComprobante");
    const wantsDelete = Boolean(delCb && delCb.checked);

    if (wantsDelete && newFile) {
      if (editAttachmentError) {
        setText(editAttachmentError, "No puedes eliminar y subir un comprobante al mismo tiempo.");
        setVisible(editAttachmentError, true);
      }
      return;
    }

    const v = ISD.attachments.validateAttachment(newFile);
    if (newFile && !v.ok) {
      if (editAttachmentError) {
        setText(editAttachmentError, v.error);
        setVisible(editAttachmentError, true);
      }
      return;
    }

    openPinModal({ action: "update", id: currentEditId, draft, attachmentFile: newFile, deleteAttachment: wantsDelete });
  });

  movementsTbody.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const action = btn.getAttribute("data-action");
    if (action === "view-attachment") {
      const attId = btn.getAttribute("data-att-id");
      const attType = btn.getAttribute("data-att-type");
      const attName = btn.getAttribute("data-att-name");
      openAttachmentInNewTab(attId, attType, attName).catch((err) => {
        console.error(err);
      });
      return;
    }
    if (action === "download-attachment") {
      const attId = btn.getAttribute("data-att-id");
      const attType = btn.getAttribute("data-att-type");
      const attName = btn.getAttribute("data-att-name");
      downloadAttachment(attId, attType, attName).catch((err) => console.error(err));
      return;
    }
    const id = btn.getAttribute("data-id");
    if (!id) return;
    if (action === "edit-movement") handleEditMovement(id);
    if (action === "delete-movement") handleDeleteMovement(id);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  try {
    if (window.ISD && window.ISD.accessGate && typeof window.ISD.accessGate.initAccessGate === "function") {
      window.ISD.accessGate.initAccessGate();
      const btnLock = document.getElementById("btnLockAccess");
      if (btnLock) {
        btnLock.addEventListener("click", () => {
          window.ISD.accessGate.lockAccess();
        });
      }
    }
    initApp();
  } catch (err) {
    console.error("Error inicializando la app:", err);
  }
});
