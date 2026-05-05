/**
 * Agregaciones y texto de contexto para OpenAI (sin lógica de HTTP).
 */

function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normTipo(t) {
  return String(t || "").toLowerCase();
}

function monthKeyFromDate(dateStr) {
  const s = String(dateStr || "");
  if (s.length >= 7) return s.slice(0, 7);
  return "";
}

function tsToIso(v) {
  if (v == null) return null;
  if (typeof v === "string") return v;
  if (typeof v.toDate === "function") {
    try {
      const d = v.toDate();
      return d instanceof Date && !isNaN(d.getTime()) ? d.toISOString() : null;
    } catch {
      return null;
    }
  }
  if (v._seconds != null) {
    return new Date(v._seconds * 1000).toISOString();
  }
  return null;
}

/** Normaliza documento Firestore movement → objeto plano para el modelo */
function normalizeMovementDoc(doc) {
  const d = doc.data() || {};
  const hasComp =
    d.comprobante &&
    (typeof d.comprobante === "object"
      ? Boolean(d.comprobante.fileName || d.comprobante.id)
      : Boolean(d.comprobante));

  return {
    id: doc.id,
    fecha: d.fecha != null ? String(d.fecha) : "",
    tipo: d.tipo != null ? String(d.tipo) : "",
    categoria: d.categoria != null ? String(d.categoria) : "",
    subcategoria: d.subcategoria != null ? String(d.subcategoria) : "",
    descripcion: d.descripcion != null ? String(d.descripcion) : "",
    montoTotal: toNumber(d.montoTotal),
    aporteGabriel: toNumber(d.aporteGabriel),
    aporteVania: toNumber(d.aporteVania),
    reparto: d.reparto != null ? String(d.reparto) : "",
    cuentaMedioSalida: d.cuentaMedioSalida != null ? String(d.cuentaMedioSalida) : String(d.pagadoPor || ""),
    origen: d.origen != null ? String(d.origen) : "",
    destino: d.destino != null ? String(d.destino) : "",
    metodoPago: d.metodoPago != null ? String(d.metodoPago) : "",
    estado: d.estado != null ? String(d.estado) : "",
    proveedor: d.proveedor != null ? String(d.proveedor) : "",
    numeroDocumento: d.numeroDocumento != null ? String(d.numeroDocumento) : "",
    notas: d.notas != null ? String(d.notas) : "",
    hasComprobante: Boolean(hasComp),
    createdByEmail: d.createdByEmail != null ? String(d.createdByEmail) : "",
    editadoPor: d.editadoPor != null ? String(d.editadoPor) : "",
    createdAt: tsToIso(d.createdAt),
    updatedAt: tsToIso(d.updatedAt),
    fechaEdicion: d.fechaEdicion != null ? String(d.fechaEdicion) : "",
  };
}

function normalizeAuditDoc(doc) {
  const d = doc.data() || {};
  return {
    id: doc.id,
    actionType: d.actionType != null ? String(d.actionType) : "",
    movementId: d.movementId != null ? String(d.movementId) : "",
    userEmail: d.user != null ? String(d.user) : String(d.userEmail || ""),
    userId: d.uid != null ? String(d.uid) : String(d.userId || ""),
    summary: d.summary != null ? String(d.summary) : "",
    details: d.details && typeof d.details === "object" ? d.details : {},
    createdAt: tsToIso(d.createdAt),
  };
}

function normalizeMemberDoc(doc) {
  const d = doc.data() || {};
  return {
    id: doc.id,
    email: d.email != null ? String(d.email) : "",
    displayName: d.displayName != null ? String(d.displayName) : "",
    role: d.role != null ? String(d.role) : "",
    active: d.active === true,
  };
}

function computeStats(movements) {
  const list = movements || [];
  let totalIngresos = 0;
  let totalGastos = 0;
  let aporteCapitalGabriel = 0;
  let aporteCapitalVania = 0;
  let gastoAsignadoGabriel = 0;
  let gastoAsignadoVania = 0;
  const gastoPorCategoria = new Map();
  const gastoPorMes = new Map();
  const pagosPorProveedor = new Map();
  let sinComprobante = 0;

  for (const m of list) {
    const tipo = normTipo(m.tipo);
    const monto = toNumber(m.montoTotal);
    if (tipo === "ingreso") {
      totalIngresos += monto;
      aporteCapitalGabriel += toNumber(m.aporteGabriel);
      aporteCapitalVania += toNumber(m.aporteVania);
    } else if (tipo === "gasto") {
      totalGastos += monto;
      gastoAsignadoGabriel += toNumber(m.aporteGabriel);
      gastoAsignadoVania += toNumber(m.aporteVania);
      const cat = String(m.categoria || "Sin categoría").trim() || "Sin categoría";
      gastoPorCategoria.set(cat, (gastoPorCategoria.get(cat) || 0) + monto);
      const mk = monthKeyFromDate(m.fecha);
      if (mk) gastoPorMes.set(mk, (gastoPorMes.get(mk) || 0) + monto);
      const prov = String(m.proveedor || "").trim();
      if (prov) pagosPorProveedor.set(prov, (pagosPorProveedor.get(prov) || 0) + monto);
      if (!m.hasComprobante) sinComprobante += 1;
    }
  }

  const topCat = [...gastoPorCategoria.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
  const topMes = [...gastoPorMes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 24);
  const topProv = [...pagosPorProveedor.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);

  let mesMayorGasto = null;
  let maxG = 0;
  for (const [mes, tot] of gastoPorMes) {
    if (tot > maxG) {
      maxG = tot;
      mesMayorGasto = mes;
    }
  }

  let catMayorGasto = null;
  maxG = 0;
  for (const [c, tot] of gastoPorCategoria) {
    if (tot > maxG) {
      maxG = tot;
      catMayorGasto = c;
    }
  }

  return {
    count: list.length,
    totalIngresos,
    totalGastos,
    cajaActual: totalIngresos - totalGastos,
    aporteCapitalGabriel,
    aporteCapitalVania,
    gastoAsignadoGabriel,
    gastoAsignadoVania,
    sinComprobanteCount: sinComprobante,
    topGastoPorCategoria: topCat.map(([categoria, total]) => ({ categoria, total })),
    topGastoPorMes: topMes.map(([mes, total]) => ({ mes, total })),
    topProveedores: topProv.map(([proveedor, total]) => ({ proveedor, total })),
    mesConMayorGasto: mesMayorGasto,
    categoriaConMayorGasto: catMayorGasto,
  };
}

function compactMovementLine(m) {
  return [
    m.fecha,
    m.tipo,
    m.categoria,
    m.subcategoria,
    m.montoTotal,
    m.reparto,
    m.estado,
    m.metodoPago,
    m.proveedor || "—",
    m.hasComprobante ? "comp:SI" : "comp:NO",
    m.id,
  ].join("|");
}

function buildContextBlock({
  stats,
  movementsCompactLines,
  auditCompactLines,
  members,
  timezone,
  currentDateIso,
}) {
  return [
    `Zona horaria cliente: ${timezone || "unknown"}`,
    `Fecha/hora referencia (ISO): ${currentDateIso || new Date().toISOString()}`,
    "",
    "=== Resumen numérico (movimientos cargados) ===",
    JSON.stringify(stats, null, 0),
    "",
    "=== Miembros proyecto (projectMembers) ===",
    JSON.stringify(members || [], null, 0),
    "",
    "=== Últimos movimientos (formato compacto: fecha|tipo|categoria|subcategoria|monto|reparto|estado|metodoPago|proveedor|comp|id) ===",
    (movementsCompactLines || []).join("\n"),
    "",
    "=== Auditoría reciente (actionType|userEmail|movementId|createdAt|summary) ===",
    (auditCompactLines || []).join("\n"),
  ].join("\n");
}

const CATEGORY_GROUPS_HINT = [
  "Profesionales y Proyectos",
  "Permisos y Legal",
  "Impuestos y Administración",
  "Terreno y Obras Previas",
  "Construcción Obra Gruesa",
  "Construcción Terminaciones",
  "Instalaciones",
  "Mano de Obra",
  "Herramientas y Maquinaria",
  "Logística y Transporte",
  "Servicios Básicos",
  "Reembolsos y Ajustes",
  "Otros",
];

module.exports = {
  normalizeMovementDoc,
  normalizeAuditDoc,
  normalizeMemberDoc,
  computeStats,
  compactMovementLine,
  buildContextBlock,
  CATEGORY_GROUPS_HINT,
  tsToIso,
};
