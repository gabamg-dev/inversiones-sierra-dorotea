// ETAPA 2.5: Filtros de movimientos (solo tabla).
// Script clásico para compatibilidad file:// en macOS.
(function () {
  "use strict";

  const global = window;
  global.ISD = global.ISD || {};

  function normalizeStr(v) {
    return String(v || "").trim();
  }

  function normalizeLower(v) {
    return normalizeStr(v).toLowerCase();
  }

  function getDefaultFilters() {
    return {
      dateFrom: "", // YYYY-MM-DD
      dateTo: "", // YYYY-MM-DD
      tipo: "all", // all | ingreso | gasto | ajuste
      categoria: "all",
      subcategoria: "all",
      reparto: "all", // all | gabriel | vania | ambos
      estado: "all", // all | pendiente | pagado | reembolsado | anulado
      metodoPago: "all", // all | Transferencia | Pago con tarjeta | Efectivo
      searchText: "",
    };
  }

  function movementMatchesSearchText(movement, text) {
    const q = normalizeLower(text);
    if (!q) return true;

    const hay = [
      movement.descripcion,
      movement.proveedor,
      movement.origen,
      movement.destino,
      movement.numeroDocumento,
      movement.notas,
      movement.categoria,
      movement.subcategoria,
      movement.metodoPago,
      movement.cuentaMedioSalida,
      movement.pagadoPor,
    ]
      .map((x) => normalizeLower(x))
      .join(" | ");

    return hay.includes(q);
  }

  function inDateRange(dateStr, fromStr, toStr) {
    const d = normalizeStr(dateStr);
    if (!d) return false;

    const from = normalizeStr(fromStr);
    const to = normalizeStr(toStr);
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  }

  function matchesReparto(movement, repartoKey) {
    const key = normalizeStr(repartoKey);
    if (!key || key === "all") return true;
    if (!global.ISD || !global.ISD.movements || !global.ISD.movements.inferRepartoFromMovement) return true;
    const inferred = global.ISD.movements.inferRepartoFromMovement(movement);
    return inferred === key;
  }

  function applyMovementFilters(movements, filters) {
    const f = { ...getDefaultFilters(), ...(filters || {}) };

    const tipo = normalizeLower(f.tipo);
    const categoria = normalizeStr(f.categoria);
    const subcategoria = normalizeStr(f.subcategoria);
    const estado = normalizeLower(f.estado);
    const metodoPago = normalizeStr(f.metodoPago);
    const reparto = normalizeLower(f.reparto);

    return (movements || []).filter((m) => {
      // Rango fechas
      if (!inDateRange(m.fecha, f.dateFrom, f.dateTo)) return false;

      // Tipo
      const t = normalizeLower(m.tipo);
      if (tipo !== "all" && t !== tipo) return false;

      // Categoría / subcategoría
      if (categoria !== "all" && normalizeStr(m.categoria) !== categoria) return false;
      if (subcategoria !== "all" && normalizeStr(m.subcategoria) !== subcategoria) return false;

      // Reparto (socio)
      if (!matchesReparto(m, reparto)) return false;

      // Estado
      const e = normalizeLower(m.estado);
      if (estado !== "all" && e !== estado) return false;

      // Método de pago
      const mp = normalizeStr(m.metodoPago);
      if (metodoPago !== "all" && mp !== metodoPago) return false;

      // Texto libre
      if (!movementMatchesSearchText(m, f.searchText)) return false;

      return true;
    });
  }

  global.ISD.filters = {
    getDefaultFilters,
    applyMovementFilters,
    movementMatchesSearchText,
  };
})();

