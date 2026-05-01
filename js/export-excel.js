// ETAPA 4: exportación Excel mediante SheetJS (xlsx) vía CDN.
// Script clásico para compatibilidad file:// en macOS.
(function () {
  "use strict";

  const global = window;
  global.ISD = global.ISD || {};

  function todayISODate() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function fmtMoneyNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function safeStr(v) {
    return String(v || "").trim();
  }

  function yesNo(v) {
    return v ? "Sí" : "No";
  }

  function getRepartoInferido(m) {
    if (global.ISD && global.ISD.movements && typeof global.ISD.movements.inferRepartoFromMovement === "function") {
      return global.ISD.movements.inferRepartoFromMovement(m);
    }
    // Fallback simple
    const g = Number(m && m.aporteGabriel) || 0;
    const v = Number(m && m.aporteVania) || 0;
    if (g > 0 && v > 0) return "ambos";
    if (g > 0) return "gabriel";
    if (v > 0) return "vania";
    return "";
  }

  function setSheetColumns(ws, widths) {
    if (!ws || !Array.isArray(widths)) return;
    ws["!cols"] = widths.map((wch) => ({ wch }));
  }

  function setAutoFilter(ws, ref) {
    if (!ws || !ref) return;
    ws["!autofilter"] = { ref };
  }

  function makeSheetFromRows(XLSX, rows, opts) {
    const ws = XLSX.utils.aoa_to_sheet(rows || []);
    const o = opts || {};
    if (o.cols) setSheetColumns(ws, o.cols);
    if (o.autofilter) setAutoFilter(ws, o.autofilter);
    return ws;
  }

  function makeSheetFromJson(XLSX, jsonRows, opts) {
    const ws = XLSX.utils.json_to_sheet(jsonRows || [], { skipHeader: false });
    const o = opts || {};
    if (o.cols) setSheetColumns(ws, o.cols);
    if (o.autofilter) setAutoFilter(ws, o.autofilter);
    return ws;
  }

  function buildResumenGeneral({ movements, reports }) {
    const list = movements || [];
    const rep = reports;
    const stats = rep && rep.getComprobantesStats ? rep.getComprobantesStats(list) : { conComprobante: 0, sinComprobante: 0 };
    const metrics = rep && rep.buildDashboardMetrics ? rep.buildDashboardMetrics(list) : {};

    return [
      ["Resumen General", ""],
      ["Fecha de exportación", todayISODate()],
      ["Total ingresos / capital", fmtMoneyNumber(metrics.totalIngresos)],
      ["Gastos totales del proyecto", fmtMoneyNumber(metrics.gastosTotalesProyecto)],
      ["Caja actual", fmtMoneyNumber(metrics.cajaActual)],
      ["Aporte capital Gabriel", fmtMoneyNumber(metrics.aporteCapitalGabriel)],
      ["Aporte capital Vania", fmtMoneyNumber(metrics.aporteCapitalVania)],
      ["Gasto asignado Gabriel", fmtMoneyNumber(metrics.gastoAsignadoGabriel)],
      ["Gasto asignado Vania", fmtMoneyNumber(metrics.gastoAsignadoVania)],
      ["Total movimientos", list.length],
      ["Movimientos con comprobante", Number(stats.conComprobante) || 0],
      ["Movimientos sin comprobante", Number(stats.sinComprobante) || 0],
    ];
  }

  function buildMovimientosRows(movements) {
    const list = movements || [];
    return list.map((m) => {
      const comp = m && m.comprobante ? m.comprobante : null;
      const hasComp = Boolean(comp);
      return {
        ID: safeStr(m.id),
        Fecha: safeStr(m.fecha),
        Tipo: safeStr(m.tipo),
        Categoría: safeStr(m.categoria),
        Subcategoría: safeStr(m.subcategoria),
        Descripción: safeStr(m.descripcion),
        "Monto total": fmtMoneyNumber(m.montoTotal),
        "Aporte / asignación Gabriel": fmtMoneyNumber(m.aporteGabriel),
        "Aporte / asignación Vania": fmtMoneyNumber(m.aporteVania),
        "Reparto inferido": getRepartoInferido(m),
        "Cuenta / medio de salida": safeStr(m.cuentaMedioSalida || m.pagadoPor),
        Origen: safeStr(m.origen),
        Destino: safeStr(m.destino),
        "Método de pago": safeStr(m.metodoPago),
        Estado: safeStr(m.estado),
        Proveedor: safeStr(m.proveedor),
        "Número documento": safeStr(m.numeroDocumento),
        Notas: safeStr(m.notas),
        "Tiene comprobante": yesNo(hasComp),
        "Comprobante nombre": hasComp ? safeStr(comp.fileName) : "",
        "Comprobante tipo": hasComp ? safeStr(comp.fileType) : "",
        "Comprobante tamaño": hasComp ? fmtMoneyNumber(comp.fileSize) : 0,
        "Comprobante ID local": hasComp ? safeStr(comp.id) : "",
        Creado: safeStr(m.fechaCreacion),
        "Editado por": safeStr(m.editadoPor),
        "Fecha edición": safeStr(m.fechaEdicion),
      };
    });
  }

  function buildGastosPorCategoria(reports, movements) {
    const rep = reports;
    const rows = rep && rep.getGastoPorCategoria ? rep.getGastoPorCategoria(movements || []) : [];
    return (rows || []).map((r) => ({
      Categoría: safeStr(r.categoria),
      "Total gasto": fmtMoneyNumber(r.total),
    }));
  }

  function buildGastosPorMes(reports, movements) {
    const rep = reports;
    const rows = rep && rep.getGastoPorMes ? rep.getGastoPorMes(movements || []) : [];
    return (rows || []).map((r) => ({
      Mes: safeStr(r.mes),
      "Total gasto": fmtMoneyNumber(r.total),
    }));
  }

  function buildFlujoCaja(reports, movements) {
    const rep = reports;
    const rows = rep && rep.getFlujoCajaMensual ? rep.getFlujoCajaMensual(movements || []) : [];
    return (rows || []).map((r) => ({
      Mes: safeStr(r.mes),
      Ingresos: fmtMoneyNumber(r.ingresos),
      Gastos: fmtMoneyNumber(r.gastos),
      "Saldo del mes": fmtMoneyNumber(r.saldoMes),
      "Saldo acumulado": fmtMoneyNumber(r.saldoAcumulado),
    }));
  }

  function buildAportesPorSocio(reports, movements) {
    const rep = reports;
    const metrics = rep && rep.buildDashboardMetrics ? rep.buildDashboardMetrics(movements || []) : {};
    const dif = typeof metrics.diferenciaAportesCapital === "number" ? metrics.diferenciaAportesCapital : null;
    return [
      {
        Socio: "Gabriel",
        "Aporte capital": fmtMoneyNumber(metrics.aporteCapitalGabriel),
        "Gasto asignado": fmtMoneyNumber(metrics.gastoAsignadoGabriel),
        "Diferencia capital vs otro socio": dif === null ? "" : fmtMoneyNumber(dif),
        Observación: "Cálculos desde movimientos locales (reports.js).",
      },
      {
        Socio: "Vania",
        "Aporte capital": fmtMoneyNumber(metrics.aporteCapitalVania),
        "Gasto asignado": fmtMoneyNumber(metrics.gastoAsignadoVania),
        "Diferencia capital vs otro socio": dif === null ? "" : fmtMoneyNumber(-dif),
        Observación: "Cálculos desde movimientos locales (reports.js).",
      },
    ];
  }

  function buildComprobantesSheetRows(movements) {
    const list = movements || [];
    return list.map((m) => {
      const comp = m && m.comprobante ? m.comprobante : null;
      const has = Boolean(comp);
      return {
        "Movimiento ID": safeStr(m.id),
        "Fecha movimiento": safeStr(m.fecha),
        "Tipo movimiento": safeStr(m.tipo),
        Categoría: safeStr(m.categoria),
        Subcategoría: safeStr(m.subcategoria),
        Monto: fmtMoneyNumber(m.montoTotal),
        "Tiene comprobante": yesNo(has),
        "Nombre archivo": has ? safeStr(comp.fileName) : "",
        "Tipo archivo": has ? safeStr(comp.fileType) : "",
        "Tamaño": has ? fmtMoneyNumber(comp.fileSize) : 0,
        "ID local IndexedDB": has ? safeStr(comp.id) : "",
        Observación: has ? "Comprobante almacenado localmente en IndexedDB" : "Sin comprobante",
      };
    });
  }

  function buildAuditoriaRows(auditLogs) {
    const logs = auditLogs || [];
    return logs.map((l) => {
      const d = (l && l.details) || {};
      const compTxt = d && typeof d.hasComprobante !== "undefined" ? yesNo(Boolean(d.hasComprobante)) : "";
      return {
        Fecha: safeStr(l.createdAt),
        Acción: safeStr(l.actionType),
        Usuario: safeStr(l.user),
        "Movimiento ID": safeStr(l.movementId),
        Resumen: safeStr(l.summary),
        "Tipo movimiento": safeStr(d.tipo),
        Categoría: safeStr(d.categoria),
        Subcategoría: safeStr(d.subcategoria),
        Monto: fmtMoneyNumber(d.montoTotal),
        Comprobante: compTxt || (d.comprobanteFileName ? safeStr(d.comprobanteFileName) : ""),
      };
    });
  }

  function exportWorkbook({ movements, auditLogs, reports }) {
    if (!global.XLSX || !global.XLSX.utils) throw new Error("SheetJS (XLSX) no está disponible. Revisa el CDN en index.html.");
    const XLSX = global.XLSX;
    const list = Array.isArray(movements) ? movements : [];
    const logs = Array.isArray(auditLogs) ? auditLogs : [];
    const rep = reports || (global.ISD ? global.ISD.reports : null);

    const wb = XLSX.utils.book_new();

    // 1) Resumen General
    const resumenRows = buildResumenGeneral({ movements: list, reports: rep });
    const wsResumen = makeSheetFromRows(XLSX, resumenRows, { cols: [30, 22] });
    XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen General");

    // 2) Movimientos
    const movRows = buildMovimientosRows(list);
    const wsMov = makeSheetFromJson(XLSX, movRows, {
      cols: [18, 12, 10, 26, 22, 34, 14, 18, 18, 14, 22, 18, 26, 18, 12, 18, 18, 30, 24, 28, 20, 16, 22, 22, 26, 18, 22],
      autofilter: "A1:AA1",
    });
    XLSX.utils.book_append_sheet(wb, wsMov, "Movimientos");

    // 3) Gastos por Categoría
    const gpcRows = buildGastosPorCategoria(rep, list);
    const wsGpc = makeSheetFromJson(XLSX, gpcRows, { cols: [34, 18], autofilter: "A1:B1" });
    XLSX.utils.book_append_sheet(wb, wsGpc, "Gastos x Cat");

    // 4) Gastos por Mes
    const gpmRows = buildGastosPorMes(rep, list);
    const wsGpm = makeSheetFromJson(XLSX, gpmRows, { cols: [12, 18], autofilter: "A1:B1" });
    XLSX.utils.book_append_sheet(wb, wsGpm, "Gastos x Mes");

    // 5) Flujo de Caja
    const flujoRows = buildFlujoCaja(rep, list);
    const wsFlujo = makeSheetFromJson(XLSX, flujoRows, { cols: [12, 18, 18, 18, 18], autofilter: "A1:E1" });
    XLSX.utils.book_append_sheet(wb, wsFlujo, "Flujo de Caja");

    // 6) Aportes por Socio
    const apsRows = buildAportesPorSocio(rep, list);
    const wsAps = makeSheetFromJson(XLSX, apsRows, { cols: [14, 18, 18, 26, 40], autofilter: "A1:E1" });
    XLSX.utils.book_append_sheet(wb, wsAps, "Aportes Socio");

    // 7) Comprobantes (metadata, sin blobs)
    const compRows = buildComprobantesSheetRows(list);
    const wsComp = makeSheetFromJson(XLSX, compRows, { cols: [18, 14, 14, 26, 22, 14, 16, 28, 20, 12, 22, 40], autofilter: "A1:L1" });
    XLSX.utils.book_append_sheet(wb, wsComp, "Comprobantes");

    // 8) Auditoría
    const audRows = buildAuditoriaRows(logs);
    const wsAud = makeSheetFromJson(XLSX, audRows, { cols: [26, 10, 18, 18, 34, 14, 26, 22, 14, 22], autofilter: "A1:J1" });
    XLSX.utils.book_append_sheet(wb, wsAud, "Auditoría");

    const fileName = `Inversiones_Sierra_Dorotea_${todayISODate()}.xlsx`;
    XLSX.writeFile(wb, fileName, { compression: true });
    return fileName;
  }

  global.ISD.exportExcel = {
    exportWorkbook,
  };
})();

