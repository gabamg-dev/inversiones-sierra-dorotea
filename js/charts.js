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

  function chartColors() {
    return {
      gold: "rgba(201, 162, 39, 0.55)",
      goldBorder: "rgba(232, 212, 139, 0.55)",
      doughnut: [
        "rgba(201, 162, 39, 0.65)",
        "rgba(232, 212, 139, 0.45)",
        "rgba(139, 105, 20, 0.5)",
        "rgba(110, 184, 154, 0.45)",
        "rgba(224, 112, 112, 0.4)",
        "rgba(139, 149, 168, 0.35)",
      ],
      ingreso: "rgba(110, 184, 154, 0.35)",
      gasto: "rgba(224, 112, 112, 0.28)",
      saldoLine: "rgba(232, 212, 139, 0.85)",
    };
  }

  function renderGastoMensualChart(canvasId, rows) {
    ensureChartJs();
    const canvas = getCanvas(canvasId);
    const labels = (rows || []).map((r) => r.label);
    const data = (rows || []).map((r) => r.total);
    const C = chartColors();

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
            backgroundColor: C.gold,
            borderColor: C.goldBorder,
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: {
            ticks: { color: "rgba(200, 204, 214, 0.85)" },
            grid: { color: "rgba(255,255,255,0.04)" },
          },
          y: {
            ticks: { color: "rgba(200, 204, 214, 0.85)", callback: (v) => String(v) },
            grid: { color: "rgba(255,255,255,0.06)" },
          },
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

    const C = chartColors();
    const colors = C.doughnut;

    const chart = new global.Chart(canvas, {
      type: "doughnut",
      data: {
        labels,
        datasets: [
          {
            label: "Gasto por categoría",
            data,
            backgroundColor: labels.map((_, i) => colors[i % colors.length]),
            borderColor: "rgba(242, 240, 232, 0.12)",
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: { color: "rgba(200, 204, 214, 0.92)", padding: 14 },
          },
        },
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

    const C = chartColors();

    const chart = new global.Chart(canvas, {
      data: {
        labels,
        datasets: [
          { type: "bar", label: "Ingresos", data: ingresos, backgroundColor: C.ingreso },
          { type: "bar", label: "Gastos", data: gastos, backgroundColor: C.gasto },
          {
            type: "line",
            label: "Saldo acumulado",
            data: saldo,
            borderColor: C.saldoLine,
            backgroundColor: "rgba(232, 212, 139, 0.06)",
            tension: 0.25,
            fill: false,
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: "rgba(200, 204, 214, 0.92)" },
          },
        },
        scales: {
          x: {
            ticks: { color: "rgba(200, 204, 214, 0.85)" },
            grid: { color: "rgba(255,255,255,0.04)" },
          },
          y: {
            ticks: { color: "rgba(200, 204, 214, 0.85)" },
            grid: { color: "rgba(255,255,255,0.06)" },
          },
        },
      },
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

