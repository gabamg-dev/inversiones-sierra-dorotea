// Helpers de formato (único lugar para moneda/fechas).
// Script clásico para compatibilidad file:// en macOS.
(function () {
  "use strict";

  const global = window;
  global.ISD = global.ISD || {};

  function formatCurrencyCLP(value) {
    const n = Number(value);
    const safe = Number.isFinite(n) ? n : 0;
    return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(safe);
  }

  function formatDateTimeCL(dateIso) {
    try {
      return new Date(dateIso).toLocaleString("es-CL");
    } catch {
      return String(dateIso || "");
    }
  }

  function formatMonthLabel(yyyyMm) {
    const raw = String(yyyyMm || "");
    const [y, m] = raw.split("-");
    const year = Number(y);
    const month = Number(m);
    if (!Number.isFinite(year) || !Number.isFinite(month)) return raw;
    const d = new Date(year, month - 1, 1);
    const name = d.toLocaleDateString("es-CL", { month: "long" });
    const cap = name.charAt(0).toUpperCase() + name.slice(1);
    return `${cap} ${year}`;
  }

  global.ISD.format = {
    formatCurrency: formatCurrencyCLP,
    formatDateTime: formatDateTimeCL,
    formatMonthLabel,
  };
})();

