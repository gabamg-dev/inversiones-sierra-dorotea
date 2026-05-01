// ETAPA 2: integración Chart.js (mensual y por categoría).
// Script clásico para compatibilidad file:// en macOS.

(function () {
  "use strict";

  const global = window;
  global.ISD = global.ISD || {};

  const _charts = new Map();

  function destroyCharts() {
    for (const c of _charts.values()) {
      try {
        c.destroy();
      } catch {
        // noop
      }
    }
    _charts.clear();
  }

  function ensureChartJs() {
    if (!global.Chart) throw new Error("Chart.js no está disponible. Verifica el script CDN en index.html.");
  }

  function getCanvas(canvasId) {
    const el = document.getElementById(canvasId);
    if (!el) throw new Error(`No se encontró canvas #${canvasId}`);
    return el;
  }

  function renderGastoMensualChart(canvasId, rows) {
    ensureChartJs();
    const canvas = getCanvas(canvasId);
    const labels = (rows || []).map((r) => r.label);
    const data = (rows || []).map((r) => r.total);

    if (!labels.length) {
      if (_charts.has(canvasId)) {
        _charts.get(canvasId).destroy();
        _charts.delete(canvasId);
      }
      return false;
    }

    if (_charts.has(canvasId)) {
      _charts.get(canvasId).destroy();
      _charts.delete(canvasId);
    }

    const chart = new global.Chart(canvas, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Gasto mensual",
            data,
            backgroundColor: "rgba(110, 231, 255, 0.22)",
            borderColor: "rgba(110, 231, 255, 0.6)",
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { ticks: { callback: (v) => String(v) } },
        },
      },
    });

    _charts.set(canvasId, chart);
    return true;
  }

  function renderGastoCategoriaChart(canvasId, rows) {
    ensureChartJs();
    const canvas = getCanvas(canvasId);
    const labels = (rows || []).map((r) => r.label);
    const data = (rows || []).map((r) => r.total);

    if (!labels.length) {
      if (_charts.has(canvasId)) {
        _charts.get(canvasId).destroy();
        _charts.delete(canvasId);
      }
      return false;
    }

    if (_charts.has(canvasId)) {
      _charts.get(canvasId).destroy();
      _charts.delete(canvasId);
    }

    const colors = [
      "rgba(167, 139, 250, 0.55)",
      "rgba(110, 231, 255, 0.55)",
      "rgba(94, 234, 212, 0.55)",
      "rgba(255, 107, 107, 0.55)",
      "rgba(231, 236, 255, 0.35)",
    ];

    const chart = new global.Chart(canvas, {
      type: "doughnut",
      data: {
        labels,
        datasets: [
          {
            label: "Gasto por categoría",
            data,
            backgroundColor: labels.map((_, i) => colors[i % colors.length]),
            borderColor: "rgba(231, 236, 255, 0.14)",
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "bottom" } },
      },
    });

    _charts.set(canvasId, chart);
    return true;
  }

  function renderFlujoCajaChart(canvasId, rows) {
    // Preparado (ETAPA 2) — se puede activar con un panel/canvas adicional.
    ensureChartJs();
    const canvas = getCanvas(canvasId);
    const labels = (rows || []).map((r) => r.label);
    const ingresos = (rows || []).map((r) => r.ingresos);
    const gastos = (rows || []).map((r) => r.gastos);
    const saldo = (rows || []).map((r) => r.saldoAcumulado);

    if (!labels.length) {
      if (_charts.has(canvasId)) {
        _charts.get(canvasId).destroy();
        _charts.delete(canvasId);
      }
      return false;
    }

    if (_charts.has(canvasId)) {
      _charts.get(canvasId).destroy();
      _charts.delete(canvasId);
    }

    const chart = new global.Chart(canvas, {
      data: {
        labels,
        datasets: [
          { type: "bar", label: "Ingresos", data: ingresos, backgroundColor: "rgba(94, 234, 212, 0.25)" },
          { type: "bar", label: "Gastos", data: gastos, backgroundColor: "rgba(255, 107, 107, 0.18)" },
          { type: "line", label: "Saldo acumulado", data: saldo, borderColor: "rgba(110, 231, 255, 0.8)", tension: 0.25 },
        ],
      },
      options: { responsive: true, maintainAspectRatio: false },
    });

    _charts.set(canvasId, chart);
    return true;
  }

  global.ISD.charts = {
    destroyCharts,
    renderGastoMensualChart,
    renderGastoCategoriaChart,
    renderFlujoCajaChart,
  };
})();

