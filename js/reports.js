// Reportes y métricas agregadas (ETAPA 2).
// Script clásico para compatibilidad file:// en macOS.

(function () {
  "use strict";

  const global = window;
  global.ISD = global.ISD || {};

  function toNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function normalizeTipo(tipo) {
    return String(tipo || "").toLowerCase();
  }

  function monthKeyFromDate(dateStr) {
    const s = String(dateStr || "");
    // Esperamos YYYY-MM-DD
    if (s.length >= 7) return s.slice(0, 7);
    return "";
  }

  function groupSumByKey(items, keyFn, valueFn) {
    const map = new Map();
    for (const it of items || []) {
      const k = String(keyFn(it) || "").trim();
      if (!k) continue;
      const v = valueFn(it);
      map.set(k, (map.get(k) || 0) + v);
    }
    return map;
  }

  function getTotalIngresos(movements) {
    return (movements || []).reduce((acc, m) => (normalizeTipo(m.tipo) === "ingreso" ? acc + toNumber(m.montoTotal) : acc), 0);
  }

  function getTotalGastos(movements) {
    return (movements || []).reduce((acc, m) => (normalizeTipo(m.tipo) === "gasto" ? acc + toNumber(m.montoTotal) : acc), 0);
  }

  function getCajaActual(movements) {
    return getTotalIngresos(movements) - getTotalGastos(movements);
  }

  function getAporteCapitalGabriel(movements) {
    return (movements || []).reduce((acc, m) => {
      if (normalizeTipo(m.tipo) !== "ingreso") return acc;
      return acc + toNumber(m.aporteGabriel);
    }, 0);
  }

  function getAporteCapitalVania(movements) {
    return (movements || []).reduce((acc, m) => {
      if (normalizeTipo(m.tipo) !== "ingreso") return acc;
      return acc + toNumber(m.aporteVania);
    }, 0);
  }

  function getGastoAsignadoGabriel(movements) {
    return (movements || []).reduce((acc, m) => {
      if (normalizeTipo(m.tipo) !== "gasto") return acc;
      return acc + toNumber(m.aporteGabriel);
    }, 0);
  }

  function getGastoAsignadoVania(movements) {
    return (movements || []).reduce((acc, m) => {
      if (normalizeTipo(m.tipo) !== "gasto") return acc;
      return acc + toNumber(m.aporteVania);
    }, 0);
  }

  function getDiferenciaAportesCapital(movements) {
    return getAporteCapitalGabriel(movements) - getAporteCapitalVania(movements);
  }

  function getGastoPorCategoria(movements) {
    const gastos = (movements || []).filter((m) => normalizeTipo(m.tipo) === "gasto");
    const map = groupSumByKey(gastos, (m) => m.categoria, (m) => toNumber(m.montoTotal));
    return Array.from(map.entries())
      .map(([categoria, total]) => ({ categoria, total }))
      .sort((a, b) => b.total - a.total);
  }

  function getGastoPorSubcategoria(movements) {
    const gastos = (movements || []).filter((m) => normalizeTipo(m.tipo) === "gasto");
    const map = groupSumByKey(gastos, (m) => m.subcategoria, (m) => toNumber(m.montoTotal));
    return Array.from(map.entries())
      .map(([subcategoria, total]) => ({ subcategoria, total }))
      .sort((a, b) => b.total - a.total);
  }

  function getGastoPorMes(movements) {
    const gastos = (movements || []).filter((m) => normalizeTipo(m.tipo) === "gasto");
    const map = groupSumByKey(gastos, (m) => monthKeyFromDate(m.fecha), (m) => toNumber(m.montoTotal));
    return Array.from(map.entries())
      .map(([mes, total]) => ({ mes, total }))
      .sort((a, b) => String(a.mes).localeCompare(String(b.mes)));
  }

  function getIngresosPorMes(movements) {
    const ingresos = (movements || []).filter((m) => normalizeTipo(m.tipo) === "ingreso");
    const map = groupSumByKey(ingresos, (m) => monthKeyFromDate(m.fecha), (m) => toNumber(m.montoTotal));
    return Array.from(map.entries())
      .map(([mes, total]) => ({ mes, total }))
      .sort((a, b) => String(a.mes).localeCompare(String(b.mes)));
  }

  function getFlujoCajaMensual(movements) {
    const ingresos = getIngresosPorMes(movements);
    const gastos = getGastoPorMes(movements);
    const mesesSet = new Set();
    for (const r of ingresos) mesesSet.add(r.mes);
    for (const r of gastos) mesesSet.add(r.mes);
    const meses = Array.from(mesesSet).sort((a, b) => String(a).localeCompare(String(b)));

    const ingresosMap = new Map(ingresos.map((r) => [r.mes, r.total]));
    const gastosMap = new Map(gastos.map((r) => [r.mes, r.total]));

    let saldoAcumulado = 0;
    const out = [];
    for (const mes of meses) {
      const ing = toNumber(ingresosMap.get(mes) || 0);
      const gas = toNumber(gastosMap.get(mes) || 0);
      const saldoMes = ing - gas;
      saldoAcumulado += saldoMes;
      out.push({ mes, ingresos: ing, gastos: gas, saldoMes, saldoAcumulado });
    }
    return out;
  }

  function getUltimosMovimientos(movements, limit = 5) {
    const sorted = [...(movements || [])].sort((a, b) => {
      const fa = String(a.fecha || "");
      const fb = String(b.fecha || "");
      if (fa === fb) return String(b.fechaCreacion || "").localeCompare(String(a.fechaCreacion || ""));
      return fb.localeCompare(fa);
    });
    return sorted.slice(0, Math.max(0, Number(limit) || 5));
  }

  function getTopCategorias(movements, limit = 5) {
    return getGastoPorCategoria(movements).slice(0, Math.max(0, Number(limit) || 5));
  }

  function getMovimientosSinComprobante(movements) {
    // ETAPA 3 completará adjuntos. Hoy el campo existe y puede ser null.
    return (movements || []).filter((m) => normalizeTipo(m.tipo) === "gasto" && !m.comprobante);
  }

  function getComprobantesStats(movements) {
    const list = movements || [];
    let conComprobante = 0;
    let sinComprobante = 0;
    for (const m of list) {
      if (m && m.comprobante) conComprobante += 1;
      else sinComprobante += 1;
    }
    return { conComprobante, sinComprobante };
  }

  function buildDashboardMetrics(movements) {
    const list = movements || [];
    return {
      cajaActual: getCajaActual(list),
      gastosTotalesProyecto: getTotalGastos(list),
      aporteCapitalGabriel: getAporteCapitalGabriel(list),
      aporteCapitalVania: getAporteCapitalVania(list),
      gastoAsignadoGabriel: getGastoAsignadoGabriel(list),
      gastoAsignadoVania: getGastoAsignadoVania(list),
      diferenciaAportesCapital: getDiferenciaAportesCapital(list),
      totalIngresos: getTotalIngresos(list),
      totalGastos: getTotalGastos(list),
    };
  }

  global.ISD.reports = {
    getTotalIngresos,
    getTotalGastos,
    getCajaActual,
    getAporteCapitalGabriel,
    getAporteCapitalVania,
    getGastoAsignadoGabriel,
    getGastoAsignadoVania,
    getDiferenciaAportesCapital,
    getGastoPorCategoria,
    getGastoPorSubcategoria,
    getGastoPorMes,
    getIngresosPorMes,
    getFlujoCajaMensual,
    getUltimosMovimientos,
    getTopCategorias,
    getMovimientosSinComprobante,
    getComprobantesStats,
    buildDashboardMetrics,
  };
})();
