/**
 * Capa determinística: fechas relativas (zona horaria del cliente), montos coloquiales CLP,
 * normalización de cuentas/métodos alineada al formulario.
 */

const { addDays } = require("date-fns");
const { toZonedTime, formatInTimeZone } = require("date-fns-tz");

const CANON_CUENTAS = [
  "Caja del proyecto",
  "Cuenta Gabriel",
  "Cuenta Vania",
  "Efectivo Gabriel",
  "Efectivo Vania",
  "Otro",
];

const SPANISH_WEEKDAY_TO_ISO = {
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
  domingo: 7,
};

function foldAccents(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function addDaysInZone(ref, timeZone, deltaDays) {
  const z = toZonedTime(ref, timeZone);
  const moved = addDays(z, deltaDays);
  return formatInTimeZone(moved, timeZone, "yyyy-MM-dd");
}

function lastIsoWeekdayBefore(ref, timeZone, targetIsoDow) {
  let cur = addDays(toZonedTime(ref, timeZone), -1);
  for (let i = 0; i < 14; i++) {
    const isoD = Number(formatInTimeZone(cur, timeZone, "i"));
    if (isoD === targetIsoDow) {
      return formatInTimeZone(cur, timeZone, "yyyy-MM-dd");
    }
    cur = addDays(cur, -1);
  }
  return addDaysInZone(ref, timeZone, -7);
}

function parseWeekdayPasado(n) {
  const rx =
    /(?:el\s+)?(lunes|martes|miercoles|jueves|viernes|sabado|domingo)\s+pasado\b/;
  const m = foldAccents(n).match(rx);
  if (!m) return null;
  const w = foldAccents(m[1]);
  const iso = SPANISH_WEEKDAY_TO_ISO[w];
  if (!iso) return null;
  return { phrase: m[0].trim(), iso };
}

function monthYearWithoutDay(n) {
  const months =
    "enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre";
  const rx = new RegExp(`\\b(?:en\\s+)?(${months})\\s+(\\d{4})\\b`, "gi");
  let m;
  while ((m = rx.exec(n)) !== null) {
    const mes = m[1];
    const anio = m[2];
    const conDia = new RegExp(`\\b\\d{1,2}\\s+de\\s+${mes}\\s+${anio}\\b`, "i");
    if (conDia.test(n)) continue;
    return true;
  }
  return false;
}

/**
 * @returns {{
 *   resolvedYmd: string | null,
 *   matchedPhrase: string | null,
 *   ambiguous: boolean,
 *   kind?: string,
 *   needsExactDay?: boolean
 * }}
 */
function resolveRelativeDateFromText(message, currentDate, timeZone) {
  const tzRaw = String(timeZone || "").trim();
  const tz = tzRaw || "America/Santiago";
  const ref = currentDate ? new Date(currentDate) : new Date();
  if (Number.isNaN(ref.getTime())) {
    return { resolvedYmd: null, matchedPhrase: null, ambiguous: false };
  }

  const n = foldAccents(String(message || "").toLowerCase());

  const wd = parseWeekdayPasado(n);
  if (wd) {
    return {
      resolvedYmd: lastIsoWeekdayBefore(ref, tz, wd.iso),
      matchedPhrase: wd.phrase,
      ambiguous: false,
      kind: "weekday_pasado",
    };
  }

  if (/\banteayer\b/.test(n)) {
    return {
      resolvedYmd: addDaysInZone(ref, tz, -2),
      matchedPhrase: "anteayer",
      ambiguous: false,
      kind: "anteayer",
    };
  }
  if (/\bayer\b/.test(n)) {
    return {
      resolvedYmd: addDaysInZone(ref, tz, -1),
      matchedPhrase: "ayer",
      ambiguous: false,
      kind: "ayer",
    };
  }
  if (/\bhoy\b/.test(n)) {
    return {
      resolvedYmd: addDaysInZone(ref, tz, 0),
      matchedPhrase: "hoy",
      ambiguous: false,
      kind: "hoy",
    };
  }
  if (/\bmañana\b/.test(n) || /\bmanana\b/.test(n)) {
    return {
      resolvedYmd: addDaysInZone(ref, tz, 1),
      matchedPhrase: "mañana",
      ambiguous: false,
      kind: "manana",
    };
  }

  if (/\b(la\s+)?semana\s+pasada\b/.test(n)) {
    return {
      resolvedYmd: null,
      matchedPhrase: null,
      ambiguous: true,
      kind: "semana_pasada",
      needsExactDay: true,
    };
  }
  if (/\beste\s+mes\b/.test(n)) {
    return {
      resolvedYmd: null,
      matchedPhrase: null,
      ambiguous: true,
      kind: "este_mes",
      needsExactDay: true,
    };
  }
  if (monthYearWithoutDay(n)) {
    return {
      resolvedYmd: null,
      matchedPhrase: null,
      ambiguous: true,
      kind: "mes_sin_dia",
      needsExactDay: true,
    };
  }

  return { resolvedYmd: null, matchedPhrase: null, ambiguous: false };
}

function parseChileanDotsInteger(chunk) {
  const s = String(chunk || "").trim();
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    return parseInt(s.replace(/\./g, ""), 10);
  }
  return null;
}

function formatMoneyCLP(n) {
  return "$" + Math.round(Number(n)).toLocaleString("es-CL");
}

/**
 * @returns {{ amount: number | null, matched: string | null }}
 */
function resolveAmountFromText(message) {
  const raw = String(message || "");
  const t = foldAccents(raw.toLowerCase());

  let m;

  m = t.match(/(\d+(?:[.,]\d+)?)\s*mill[oó]n(?:es)?\s+(\d{1,3})\b/);
  if (m) {
    const millions = parseFloat(m[1].replace(",", "."));
    const tail = parseInt(m[2], 10);
    const amount = Math.round(millions * 1e6 + tail * 1e3);
    return { amount, matched: m[0].trim() };
  }

  m = t.match(/(\d+(?:[.,]\d+)?)\s*mill[oó]n(?:es)?\b/);
  if (m) {
    const millions = parseFloat(m[1].replace(",", "."));
    return { amount: Math.round(millions * 1e6), matched: m[0].trim() };
  }

  m = t.match(/(\d+(?:[.,]\d+)?)\s*palos?\b/);
  if (m) {
    const nump = parseFloat(m[1].replace(",", "."));
    return { amount: Math.round(nump * 1e6), matched: m[0].trim() };
  }

  m = t.match(/(\d+(?:[.,]\d+)?)\s*lucas?\b/);
  if (m) {
    const nump = parseFloat(m[1].replace(",", "."));
    return { amount: Math.round(nump * 1e3), matched: m[0].trim() };
  }

  m = t.match(/(\d+(?:[.,]\d+)?)\s*mil(?:es)?\b/) || t.match(/\b(\d+)mil\b/);
  if (m) {
    const nump = parseFloat(String(m[1]).replace(",", "."));
    return { amount: Math.round(nump * 1e3), matched: m[0].trim() };
  }

  m = raw.match(/\b\d{1,3}(\.\d{3})+\b/);
  if (m) {
    const num = parseChileanDotsInteger(m[0]);
    if (num != null) return { amount: num, matched: m[0].trim() };
  }

  m = t.match(/\b(\d{6,})\b/);
  if (m) {
    return { amount: parseInt(m[1], 10), matched: m[0].trim() };
  }

  return { amount: null, matched: null };
}

function matchCanonCuenta(text) {
  const f = foldAccents(String(text || "").toLowerCase());
  if (
    /\bgabriel\b/.test(f) &&
    (/cuenta\s+personal|desde\s+su\s+cuenta\s+personal|cuenta\s+de\s+gabriel|^dinero\s+de\s+gabriel/.test(f) ||
      /cuenta\s+personal\s+gabriel/.test(f))
  ) {
    return "Cuenta Gabriel";
  }
  if (
    /cuenta\s+personal\s+vania|cuenta\s+de\s+vania|^dinero\s+de\s+vania/.test(f) ||
    (/\bvania\b/.test(f) && /cuenta\s+personal/.test(f))
  ) {
    return "Cuenta Vania";
  }
  if (
    /\bcaja\s+del\s+proyecto\b|\bcuenta\s+del\s+proyecto\b|\bcc\s+del\s+proyecto\b/.test(f) &&
    !/\bcuenta\s+corriente\b/.test(f) &&
    !/cuenta\s+gabriel|cuenta\s+vania/.test(f)
  ) {
    return "Caja del proyecto";
  }
  if (/^efectivo\s+gabriel\b|\befectivo\s+de\s+gabriel\b/.test(f)) return "Efectivo Gabriel";
  if (/^efectivo\s+vania\b|\befectivo\s+de\s+vania\b/.test(f)) return "Efectivo Vania";
  for (const c of CANON_CUENTAS) {
    if (f === foldAccents(c.toLowerCase())) return c;
  }
  return null;
}

function normalizeCuentaMedioField(val) {
  const canon = matchCanonCuenta(val);
  if (canon) return canon;
  const v = String(val || "").trim();
  if (!v) return v;
  const low = foldAccents(v.toLowerCase());
  if (low.includes("gabriel") && (low.includes("cuenta") || low.includes("personal")))
    return "Cuenta Gabriel";
  if (low.includes("vania") && (low.includes("cuenta") || low.includes("personal")))
    return "Cuenta Vania";
  return v;
}

function normalizeOrigenDestinoText(field) {
  let s = String(field || "").trim();
  if (!s) return s;
  const fromVal = matchCanonCuenta(s);
  if (fromVal) return fromVal === "Caja del proyecto" ? "Caja del proyecto" : fromVal;

  const low = foldAccents(s.toLowerCase());
  if (
    /cuenta\s+corriente\s+del\s+proyecto|cuenta\s+corriente\s+proyecto|banco\s+del\s+proyecto/.test(
      low
    )
  ) {
    return "Cuenta corriente del proyecto";
  }
  if (/caja\s+de\s+la\s+obra|caja\s+obra/.test(low)) return "Caja de la obra";

  return s;
}

function normalizeMetodoPago(val, message) {
  const blob = foldAccents(`${String(val || "")} ${String(message || "")}`.toLowerCase());
  if (/transferencia|transfer\s/.test(blob)) return "Transferencia";
  if (/tarjeta/.test(blob)) return "Pago con tarjeta";
  if (/efectivo/.test(blob) && !/transfer/.test(blob)) return "Efectivo";
  const v = String(val || "").trim();
  if (!v) return v;
  const l = v.toLowerCase();
  if (l.includes("transfer")) return "Transferencia";
  if (l.includes("tarjeta")) return "Pago con tarjeta";
  if (l.includes("efectivo")) return "Efectivo";
  return v;
}

function normalizeDraftAccountsAndMethods(draft, message) {
  if (!draft || typeof draft !== "object") return draft;
  const out = { ...draft };
  const msg = String(message || "");

  out.cuentaMedioSalida = normalizeCuentaMedioField(out.cuentaMedioSalida);
  out.origen = normalizeOrigenDestinoText(out.origen) || normalizeCuentaMedioField(out.origen);
  out.destino = normalizeOrigenDestinoText(out.destino);

  const mc = matchCanonCuenta(msg);
  if (mc === "Cuenta Gabriel") {
    out.cuentaMedioSalida = "Cuenta Gabriel";
    out.origen = "Cuenta Gabriel";
  } else if (mc === "Cuenta Vania") {
    out.cuentaMedioSalida = "Cuenta Vania";
    out.origen = "Cuenta Vania";
  }

  if (
    /cuenta\s+corriente\s+del\s+proyecto|cuenta\s+corriente/.test(foldAccents(msg.toLowerCase())) &&
    String(out.destino || "").toLowerCase().includes("proyecto")
  ) {
    out.destino = "Cuenta corriente del proyecto";
  }

  out.metodoPago = normalizeMetodoPago(out.metodoPago, msg);
  return out;
}

function uniqPush(arr, item) {
  if (!arr.includes(item)) arr.push(item);
}

function postProcessRemoteAiPayload(payload, userMessage, currentDateIso, timeZone) {
  const mode = payload.mode;
  const warnings = Array.isArray(payload.warnings) ? [...payload.warnings] : [];
  let missingRequired = Array.isArray(payload.missingRequired) ? [...payload.missingRequired] : [];
  let draft = payload.draft && typeof payload.draft === "object" ? { ...payload.draft } : null;

  const dateRes = resolveRelativeDateFromText(userMessage, currentDateIso, timeZone);
  const amtRes = resolveAmountFromText(userMessage);

  if ((mode === "draft" || mode === "needs_more_info") && draft) {
    if (dateRes.resolvedYmd && dateRes.matchedPhrase) {
      draft.fecha = dateRes.resolvedYmd;
      missingRequired = missingRequired.filter((x) => x !== "fecha");
      warnings.push(
        `Fecha relativa resuelta automáticamente: '${dateRes.matchedPhrase}' → ${dateRes.resolvedYmd}`
      );
    }

    if (dateRes.needsExactDay && dateRes.ambiguous) {
      uniqPush(missingRequired, "fecha");
      if (dateRes.kind === "semana_pasada") {
        warnings.push("Se mencionó «la semana pasada» sin día exacto; indica la fecha del movimiento.");
      } else if (dateRes.kind === "este_mes") {
        warnings.push('«Este mes» no fija un día; indica la fecha exacta del movimiento.');
      } else if (dateRes.kind === "mes_sin_dia") {
        warnings.push("Hay un mes/año sin día; indica la fecha exacta del movimiento.");
      }
    }

    if (amtRes.amount != null) {
      const prev = Number(draft.montoTotal);
      if (!Number.isFinite(prev) || prev !== amtRes.amount) {
        draft.montoTotal = amtRes.amount;
        warnings.push(
          `Monto interpretado automáticamente: '${amtRes.matched}' → ${formatMoneyCLP(amtRes.amount)}`
        );
      }
    }

    draft = normalizeDraftAccountsAndMethods(draft, userMessage);
  }

  return {
    ...payload,
    draft,
    missingRequired,
    warnings,
  };
}

module.exports = {
  resolveRelativeDateFromText,
  resolveAmountFromText,
  postProcessRemoteAiPayload,
  formatMoneyCLP,
  foldAccents,
  CANON_CUENTAS,
};
