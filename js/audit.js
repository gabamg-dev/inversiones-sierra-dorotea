/**
 * Auditoría local (trazabilidad) para acciones CRUD.
 * Persistencia separada en localStorage para no mezclar con movimientos.
 *
 * Exposición (scripts clásicos):
 *   window.ISD.audit = { CURRENT_USER, getAuditLogs, saveAuditLogs, addAuditLog }
 */
(function () {
  "use strict";

  const global = window;
  global.ISD = global.ISD || {};

  const STORAGE_KEY = "isd.audit.logs.v1";
  const CURRENT_USER = "Usuario local";

  function safeJsonParse(value, fallback) {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function generateId() {
    return `audit_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
  }

  function getAuditLogs() {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = safeJsonParse(raw, []);
    return Array.isArray(parsed) ? parsed : [];
  }

  function saveAuditLogs(logs) {
    if (!Array.isArray(logs)) throw new Error("saveAuditLogs espera un array");
    localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
  }

  function pickMovementDetails(m) {
    if (!m) return {};
    return {
      tipo: m.tipo ?? "",
      montoTotal: m.montoTotal ?? 0,
      categoria: m.categoria ?? "",
      subcategoria: m.subcategoria ?? "",
      descripcion: m.descripcion ?? "",
      hasComprobante: Boolean(m.comprobante),
      comprobanteFileName: m.comprobante?.fileName ?? null,
    };
  }

  /**
   * action: { actionType, movementId, summary, details? , user? }
   */
  function addAuditLog(action) {
    const logs = getAuditLogs();
    const entry = {
      id: generateId(),
      actionType: action?.actionType,
      movementId: action?.movementId ?? "",
      user: action?.user ?? CURRENT_USER,
      createdAt: nowIso(),
      summary: action?.summary ?? "",
      details: action?.details ?? {},
    };
    logs.push(entry);
    saveAuditLogs(logs);
    return entry;
  }

  global.ISD.audit = {
    STORAGE_KEY,
    CURRENT_USER,
    getAuditLogs,
    saveAuditLogs,
    addAuditLog,
    pickMovementDetails,
  };
})();

