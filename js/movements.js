(function () {
  "use strict";

  const global = window;
  global.ISD = global.ISD || {};

  function nowIso() {
    return new Date().toISOString();
  }

  function generateId() {
    // Suficiente para modo local-first sin backend (ETAPA 1).
    return `mov_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
  }

  function toNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : NaN;
  }

  /**
   * Reparto contable Gabriel/Vania (ingresos = aporte capital; gastos = gasto asignado).
   * Claves nuevas: gabriel | vania | ambos
   * Compatibilidad con borradores/formularios antiguos: gabriel_100 | vania_100 | mitad_mitad
   */
  function normalizeRepartoKey(reparto) {
    const r = String(reparto || "");
    if (r === "gabriel_100") return "gabriel";
    if (r === "vania_100") return "vania";
    if (r === "mitad_mitad") return "ambos";
    return r;
  }

  function computeSplit(montoTotal, reparto) {
    const monto = toNumber(montoTotal);
    if (!Number.isFinite(monto) || monto < 0) {
      return { aporteGabriel: NaN, aporteVania: NaN };
    }

    switch (normalizeRepartoKey(reparto)) {
      case "gabriel":
        return { aporteGabriel: monto, aporteVania: 0 };
      case "vania":
        return { aporteGabriel: 0, aporteVania: monto };
      case "ambos": {
        const half = Math.round(monto / 2);
        return { aporteGabriel: half, aporteVania: monto - half };
      }
      default:
        return { aporteGabriel: NaN, aporteVania: NaN };
    }
  }

  function validateMovementDraft(draft) {
    const errors = [];

    if (!draft) {
      errors.push("Movimiento vacío.");
      return errors;
    }

    const tipo = String(draft.tipo || "").trim();
    if (!tipo || !["gasto", "ingreso", "ajuste"].includes(tipo)) {
      errors.push("Debes seleccionar un tipo.");
    }

    const fecha = String(draft.fecha || "").trim();
    if (!fecha) errors.push("Debes ingresar una fecha.");

    const categoria = String(draft.categoria || "").trim();
    if (!categoria) errors.push("Debes seleccionar una categoría.");

    const subcategoria = String(draft.subcategoria || "").trim();
    if (!subcategoria) errors.push("Debes seleccionar una subcategoría.");

    const monto = toNumber(draft.montoTotal);
    if (!Number.isFinite(monto) || monto <= 0) errors.push("Debes ingresar un monto válido.");

    const repartoRaw = String(draft.reparto || "").trim();
    if (!repartoRaw) errors.push("Debes seleccionar un reparto.");
    const repartoNorm = normalizeRepartoKey(repartoRaw);
    if (repartoRaw && !["gabriel", "vania", "ambos"].includes(repartoNorm)) {
      errors.push("Debes seleccionar un reparto.");
    }

    const medio = String(draft.cuentaMedioSalida || draft.pagadoPor || "").trim();
    if (!medio) errors.push("Debes seleccionar una cuenta o medio de salida.");

    const origen = String(draft.origen || "").trim();
    if (!origen) errors.push("Debes ingresar el origen.");

    const destino = String(draft.destino || "").trim();
    if (!destino) errors.push("Debes ingresar el destino.");

    const estado = String(draft.estado || "").trim();
    if (!estado || !["pendiente", "pagado", "anulado"].includes(estado)) {
      errors.push("Debes seleccionar un estado.");
    }

    const metodoPago = String(draft.metodoPago || "").trim();
    if (!metodoPago) errors.push("Debes seleccionar un método de pago.");

    const { aporteGabriel, aporteVania } = computeSplit(draft.montoTotal, draft.reparto);
    const splitOk = Number.isFinite(aporteGabriel) && Number.isFinite(aporteVania);
    if (!splitOk) {
      const yaHayMsgReparto = errors.some((e) => e.indexOf("reparto") !== -1);
      if (!yaHayMsgReparto) errors.push("Debes seleccionar un reparto.");
    } else if (Number.isFinite(monto) && aporteGabriel + aporteVania !== monto) {
      errors.push("El reparto no suma el monto total.");
    }

    return errors;
  }

  /**
   * Deduce la clave de reparto UI desde montos persistidos (para cargar formulario de edición).
   */
  function inferRepartoFromMovement(m) {
    const total = toNumber(m.montoTotal);
    const g = toNumber(m.aporteGabriel);
    const v = toNumber(m.aporteVania);
    if (!Number.isFinite(total) || total <= 0) return "ambos";
    if (g === total && v === 0) return "gabriel";
    if (v === total && g === 0) return "vania";
    const half = Math.round(total / 2);
    if (g === half && v === total - half) return "ambos";
    return "ambos";
  }

  /** Actualiza un movimiento existente manteniendo id, fechaCreacion y comprobante. */
  function applyDraftToMovement(existing, draft) {
    if (!existing || !existing.id) throw new Error("Movimiento existente inválido.");
    const montoTotal = toNumber(draft.montoTotal);
    const { aporteGabriel, aporteVania } = computeSplit(montoTotal, draft.reparto);
    const cuentaMedioSalida = String(draft.cuentaMedioSalida || draft.pagadoPor || "").trim();

    return {
      ...existing,
      id: existing.id,
      fechaCreacion: existing.fechaCreacion,
      comprobante: existing.comprobante != null ? existing.comprobante : null,
      fecha: draft.fecha,
      tipo: draft.tipo,
      categoria: draft.categoria,
      subcategoria: draft.subcategoria,
      descripcion: String(draft.descripcion ?? "").trim(),
      montoTotal,
      aporteGabriel,
      aporteVania,
      cuentaMedioSalida,
      pagadoPor: cuentaMedioSalida,
      origen: String(draft.origen ?? "").trim(),
      destino: String(draft.destino ?? "").trim(),
      metodoPago: String(draft.metodoPago ?? "").trim(),
      bancoOrigen: String(existing.bancoOrigen ?? "").trim(),
      proveedor: String(draft.proveedor ?? "").trim(),
      numeroDocumento: String(draft.numeroDocumento ?? "").trim(),
      estado: draft.estado,
      notas: String(draft.notas ?? "").trim(),
      fechaModificacion: nowIso(),
    };
  }

  function createMovementFromDraft(draft) {
    const montoTotal = toNumber(draft.montoTotal);
    const { aporteGabriel, aporteVania } = computeSplit(montoTotal, draft.reparto);
    const ts = nowIso();
    const cuentaMedioSalida = String(draft.cuentaMedioSalida || draft.pagadoPor || "").trim();
    // Compatibilidad: movimientos antiguos usan pagadoPor; nuevos guardan cuentaMedioSalida + duplicado en pagadoPor.
    const pagadoPorLegacy = cuentaMedioSalida;

    return {
      id: generateId(),
      fecha: draft.fecha,
      tipo: draft.tipo,
      categoria: draft.categoria,
      subcategoria: draft.subcategoria,
      descripcion: String(draft.descripcion ?? "").trim(),
      montoTotal,
      aporteGabriel,
      aporteVania,
      cuentaMedioSalida,
      pagadoPor: pagadoPorLegacy,
      origen: draft.origen?.trim() ?? "",
      destino: draft.destino?.trim() ?? "",
      metodoPago: draft.metodoPago?.trim() ?? "",
      bancoOrigen: draft.bancoOrigen?.trim() ?? "",
      proveedor: draft.proveedor?.trim() ?? "",
      numeroDocumento: draft.numeroDocumento?.trim() ?? "",
      estado: draft.estado,
      comprobante: null,
      notas: draft.notas?.trim() ?? "",
      fechaCreacion: ts,
      fechaModificacion: ts,
    };
  }

  function sortMovementsDesc(movements) {
    return [...movements].sort((a, b) => {
      const fa = String(a.fecha || "");
      const fb = String(b.fecha || "");
      if (fa === fb) return String(b.fechaCreacion || "").localeCompare(String(a.fechaCreacion || ""));
      return fb.localeCompare(fa);
    });
  }

  global.ISD.movements = {
    computeSplit,
    validateMovementDraft,
    createMovementFromDraft,
    sortMovementsDesc,
    inferRepartoFromMovement,
    applyDraftToMovement,
  };
})();

