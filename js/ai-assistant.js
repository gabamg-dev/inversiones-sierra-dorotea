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

  function stripAccents(s) {
    try {
      return String(s || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
    } catch (e) {
      return String(s || "");
    }
  }

  function normForMatch(v) {
    return stripAccents(normalizeLower(v));
  }

  function safeNumber(n) {
    const x = Number(n);
    return Number.isFinite(x) ? x : NaN;
  }

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function monthNameToNumber(name) {
    const m = normForMatch(name);
    const map = {
      enero: 1,
      febrero: 2,
      marzo: 3,
      abril: 4,
      mayo: 5,
      junio: 6,
      julio: 7,
      agosto: 8,
      septiembre: 9,
      setiembre: 9,
      octubre: 10,
      noviembre: 11,
      diciembre: 12,
    };
    return map[m] || null;
  }

  function parseAmountCLP(text) {
    const t = String(text || "");
    // Captura números con separadores . o , y opcional $
    const re = /(\$?\s*\d[\d\.\,]{0,20}\d)/g;
    const matches = t.match(re) || [];
    let best = NaN;
    for (const raw of matches) {
      const digits = String(raw).replace(/[^\d]/g, "");
      if (!digits) continue;
      const n = safeNumber(digits);
      if (!Number.isFinite(n)) continue;
      if (!Number.isFinite(best) || n > best) best = n;
    }
    return Number.isFinite(best) ? best : NaN;
  }

  function parseDateISO(text) {
    const t = normForMatch(text);

    // dd/mm/yyyy o dd-mm-yyyy
    {
      const m = t.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/);
      if (m) {
        const dd = safeNumber(m[1]);
        const mm = safeNumber(m[2]);
        const yyyy = safeNumber(m[3]);
        if (Number.isFinite(dd) && Number.isFinite(mm) && Number.isFinite(yyyy) && dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12) {
          return `${yyyy}-${pad2(mm)}-${pad2(dd)}`;
        }
      }
    }

    // "01 de mayo del 2026" / "1 de mayo de 2026" / "el dia 01 de mayo del 2026" / "01 mayo 2026"
    {
      const m = t.match(/\b(?:el\s+)?(?:dia\s+)?(\d{1,2})\s*(?:de\s+)?([a-zñ]+)\s*(?:de\s+|del\s+)?(\d{4})\b/);
      if (m) {
        const dd = safeNumber(m[1]);
        const mm = monthNameToNumber(m[2]);
        const yyyy = safeNumber(m[3]);
        if (Number.isFinite(dd) && Number.isFinite(yyyy) && mm && dd >= 1 && dd <= 31) {
          return `${yyyy}-${pad2(mm)}-${pad2(dd)}`;
        }
      }
    }

    // "mayo 2026" (sin día): NO inventar fecha
    return "";
  }

  function parseMonthYearKey(text) {
    const t = normForMatch(text);
    const m = t.match(/\b([a-zñ]+)\s+(\d{4})\b/);
    if (!m) return "";
    const mm = monthNameToNumber(m[1]);
    const yyyy = safeNumber(m[2]);
    if (!mm || !Number.isFinite(yyyy)) return "";
    return `${yyyy}-${pad2(mm)}`;
  }

  function detectTipo(text) {
    const t = normForMatch(text);
    if (/(gasto|egreso|pago|pague|pago\s|pagado|se pago|se pag[oó])/.test(t)) return "gasto";
    if (/(ingreso|aporte|deposito|deposito|inyeccion|inyeccion|capital|abono)/.test(t)) return "ingreso";
    return "";
  }

  function detectMetodoPago(text) {
    const t = normForMatch(text);
    if (t.includes("transferencia") || t.includes("transferir")) return "Transferencia";
    if (t.includes("tarjeta") || t.includes("credito") || t.includes("debito")) return "Pago con tarjeta";
    if (t.includes("efectivo") || t.includes("cash")) return "Efectivo";
    return "";
  }

  function detectEstadoExplicit(text) {
    const t = normForMatch(text);
    if (t.includes("pagado") || t.includes("pagada")) return "pagado";
    if (t.includes("pendiente")) return "pendiente";
    if (t.includes("reembolsado") || t.includes("reembolso")) return "reembolsado";
    if (t.includes("anulado") || t.includes("anulada")) return "anulado";
    return "";
  }

  function inferEstadoFromText(text, tipo) {
    const explicit = detectEstadoExplicit(text);
    if (explicit) return explicit;

    const t = normForMatch(text);
    const tt = String(tipo || "").toLowerCase();
    const isMov = tt === "gasto" || tt === "ingreso";
    if (!isMov) return "";

    // Señales de pago/ejecución => Pagado
    if (
      /(pago|pago que hizo|pago\s+que\s+hizo|pago\s+realizado|pague|pague|pago|se\s+realizo|fue\s+realizado|deposito|dep[oó]sito|transferido|transferencia\s+realizada)/.test(t)
    ) {
      return "pagado";
    }
    return "";
  }

  function detectReparto(text) {
    const t = normForMatch(text);
    if (t.includes("50/50") || t.includes("mitad") || t.includes("ambos") || t.includes("a medias")) return "ambos";
    if (t.includes("gabriel")) return "gabriel";
    if (t.includes("vania")) return "vania";
    // "100% gabriel/vania"
    if (/100\s*%\s*gabriel/.test(t)) return "gabriel";
    if (/100\s*%\s*vania/.test(t)) return "vania";
    return "";
  }

  function detectCuentaMedioSalida(text) {
    const t = normForMatch(text);
    if (t.includes("caja del proyecto") || t.includes("caja proyecto")) return "Caja del proyecto";
    if (t.includes("cuenta del proyecto") || t.includes("cuenta proyecto")) return "Caja del proyecto";
    if (t.includes("dinero de gabriel") || t.includes("cuenta de gabriel") || t.includes("cuenta gabriel") || t.includes("hizo gabriel") || t.includes("pago que hizo gabriel")) return "Cuenta Gabriel";
    if (t.includes("dinero de vania") || t.includes("cuenta de vania") || t.includes("cuenta vania") || t.includes("hizo vania") || t.includes("pago que hizo vania")) return "Cuenta Vania";

    // Efectivo sugerido (si no existe en el select, se ajusta al cargar en app.js)
    if (t.includes("efectivo de gabriel") || t.includes("efectivo gabriel")) return "Efectivo Gabriel";
    if (t.includes("efectivo de vania") || t.includes("efectivo vania")) return "Efectivo Vania";
    if (t.includes("otro")) return "Otro";
    return "";
  }

  function titleCaseName(s) {
    const clean = normalizeStr(s).replace(/\s+/g, " ");
    if (!clean) return "";
    return clean
      .split(" ")
      .map((w) => (w.length <= 2 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
      .join(" ");
  }

  function detectOrigenDestino(text) {
    const raw = String(text || "");
    const t = normForMatch(raw);

    // "desde X ... a Y"
    let origen = "";
    let destino = "";

    // Origen: reglas simples para evitar frases largas
    if (t.includes("dinero de gabriel") || t.includes("pago que hizo gabriel") || t.includes("hizo gabriel")) origen = "Gabriel";
    else if (t.includes("dinero de vania") || t.includes("pago que hizo vania") || t.includes("hizo vania")) origen = "Vania";
    else if (t.includes("desde caja del proyecto") || t.includes("desde cuenta del proyecto") || t.includes("desde cuenta proyecto")) origen = "Cuenta proyecto";
    else {
      const mDesde = raw.match(/(?:desde|de)\s+([^,\.]+?)(?=(\s+a\s+|\s+hacia\s+|,|\.|$))/i);
      if (mDesde && mDesde[1]) origen = normalizeStr(mDesde[1]).slice(0, 48);
    }

    // Destino: capturar "al arquitecto X"
    const mArq = raw.match(/al\s+arquitecto\s+([^,\.]+)(?:,|\.|$)/i);
    if (mArq && mArq[1]) {
      destino = `Arquitecto ${titleCaseName(mArq[1])}`;
    } else {
      const mA = raw.match(/(?:a|hacia|al|a la|a el)\s+([^,\.]+?)(?=(,|\.|$))/i);
      if (mA && mA[1]) destino = normalizeStr(mA[1]).slice(0, 64);
    }

    // Heurística: si menciona caja/cuenta proyecto, úsalo como origen si está vacío
    if (!origen) {
      if (t.includes("caja del proyecto") || t.includes("caja proyecto") || t.includes("cuenta del proyecto") || t.includes("cuenta proyecto")) {
        origen = "Caja del proyecto";
      }
      if (t.includes("cuenta gabriel")) origen = "Cuenta Gabriel";
      if (t.includes("cuenta vania")) origen = "Cuenta Vania";
      if (t.includes("efectivo gabriel")) origen = "Efectivo Gabriel";
      if (t.includes("efectivo vania")) origen = "Efectivo Vania";
    }

    // Si destino está vacío pero menciona "abogado / notaría / municipalidad", intenta un destino simple
    if (!destino) {
      if (t.includes("abogado")) destino = "Abogado";
      else if (t.includes("notaria") || t.includes("notaría")) destino = "Notaría";
      else if (t.includes("municipal") || t.includes("municipalidad")) destino = "Municipalidad";
      else if (t.includes("arquitecto")) destino = "Arquitecto";
      else if (t.includes("calculista")) destino = "Calculista";
      else if (t.includes("ingeniero")) destino = "Ingeniero";
    }

    return { origen, destino };
  }

  function guessCategoriaSubcategoria(text) {
    const t = normForMatch(text);

    const candidates = [
      {
        test: /(abogado|notaria|notaría|municipal|municipalidad|permiso|permisos|conservador|recepcion final|recepción final)/,
        categoria: "Permisos y Legal",
        subMap: [
          { re: /abogado/, sub: "Abogado" },
          { re: /(notaria|notaría)/, sub: "Notaría" },
          { re: /conservador/, sub: "Conservador de bienes raíces" },
          { re: /(derechos municipales|municipal)/, sub: "Derechos municipales" },
          { re: /(permiso municipal|permiso|permisos)/, sub: "Permiso municipal" },
          { re: /(recepcion final|recepción final)/, sub: "Recepción final" },
          { re: /(certificado|certificados)/, sub: "Certificados legales" },
        ],
      },
      {
        test: /(arquitecto|calculista|ingeniero|topografo|topógrafo|mecanica de suelos|mecánica de suelos|estudios tecnicos|estudios técnicos)/,
        categoria: "Profesionales y Proyectos",
        subMap: [
          { re: /arquitecto/, sub: "Arquitecto" },
          { re: /calculista/, sub: "Calculista" },
          { re: /ingeniero electrico|ingeniero eléctrico/, sub: "Ingeniero eléctrico" },
          { re: /ingeniero sanitario/, sub: "Ingeniero sanitario" },
          { re: /ingeniero estructural/, sub: "Ingeniero estructural" },
          { re: /(topografo|topógrafo)/, sub: "Topógrafo" },
          { re: /(mecanica de suelos|mecánica de suelos)/, sub: "Mecánica de suelos" },
          { re: /(estudios tecnicos|estudios técnicos)/, sub: "Estudios técnicos" },
        ],
      },
      {
        test: /(materiales|hormigon|hormigón|fierro|madera|cemento|aridos|áridos|radier|fundaciones|muros|pilares|vigas|techumbre|obra gruesa)/,
        categoria: "Construcción Obra Gruesa",
        subMap: [
          { re: /hormigon|hormigón/, sub: "Hormigón" },
          { re: /cemento/, sub: "Cemento" },
          { re: /aridos|áridos/, sub: "Áridos" },
          { re: /fierro/, sub: "Fierro" },
          { re: /acero/, sub: "Acero" },
          { re: /madera/, sub: "Madera estructural" },
          { re: /radier/, sub: "Radier" },
          { re: /fundaciones/, sub: "Fundaciones" },
          { re: /techumbre/, sub: "Techumbre" },
          { re: /materiales/, sub: "Materiales obra gruesa" },
        ],
      },
      {
        test: /(pintura|ventanas|puertas|terminaciones|revestimientos|pisos|ceramicas|cerámicas|quincalleria|quincallería|muebles|artefactos)/,
        categoria: "Construcción Terminaciones",
        subMap: [
          { re: /pintura/, sub: "Pintura" },
          { re: /ventanas/, sub: "Ventanas" },
          { re: /puertas/, sub: "Puertas" },
          { re: /terminaciones/, sub: "Terminaciones generales" },
          { re: /revestimientos/, sub: "Revestimientos" },
          { re: /pisos/, sub: "Pisos" },
          { re: /ceramicas|cerámicas/, sub: "Cerámicas" },
          { re: /quincalleria|quincallería/, sub: "Quincallería" },
          { re: /muebles/, sub: "Muebles" },
          { re: /artefactos/, sub: "Artefactos" },
        ],
      },
      {
        test: /(flete|transporte|combustible|logistica|logística|envio|envío)/,
        categoria: "Logística y Transporte",
        subMap: [
          { re: /flete|fletes/, sub: "Fletes" },
          { re: /combustible/, sub: "Combustible" },
          { re: /transporte/, sub: "Transporte" },
          { re: /envio|envío/, sub: "Envíos" },
        ],
      },
      {
        test: /(deposito|depósito|aporte|capital|inyeccion|inyección)/,
        categoria: "Aportes / Capital",
        subMap: [
          { re: /gabriel/, sub: "Depósito Gabriel" },
          { re: /vania/, sub: "Depósito Vania" },
          { re: /50\/50|ambos|a medias|mitad/, sub: "Aporte 50/50" },
          { re: /inyeccion|inyección/, sub: "Inyección de capital" },
          { re: /prestamo|préstamo/, sub: "Préstamo socio" },
        ],
      },
    ];

    for (const c of candidates) {
      if (!c.test.test(t)) continue;
      let sub = "";
      for (const sm of c.subMap) {
        if (sm.re.test(t)) {
          sub = sm.sub;
          break;
        }
      }
      return { categoria: c.categoria, subcategoria: sub };
    }

    return { categoria: "", subcategoria: "" };
  }

  function normalizeCategoriaAgainstCatalog(categoria, subcategoria) {
    const cat = normalizeStr(categoria);
    const sub = normalizeStr(subcategoria);
    const api = global.ISD && global.ISD.categories ? global.ISD.categories : null;
    if (!api || !api.getCategoryGroups || !api.getSubcategoriesForGroup) return { categoria: cat, subcategoria: sub };

    if (cat) {
      const groups = api.getCategoryGroups();
      if (groups.indexOf(cat) === -1) return { categoria: "", subcategoria: "" };
      if (sub) {
        const subs = api.getSubcategoriesForGroup(cat);
        if (subs.indexOf(sub) === -1) return { categoria: cat, subcategoria: "" };
      }
      return { categoria: cat, subcategoria: sub };
    }
    return { categoria: "", subcategoria: "" };
  }

  function buildMovementDraftFromText(text) {
    const raw = String(text || "");
    const tipo = detectTipo(raw);
    const monto = parseAmountCLP(raw);
    const fechaISO = parseDateISO(raw);
    const reparto = detectReparto(raw);
    const metodoPago = detectMetodoPago(raw);
    const estado = inferEstadoFromText(raw, tipo);
    const cuentaMedioSalida = detectCuentaMedioSalida(raw);
    const od = detectOrigenDestino(raw);
    const catGuess = guessCategoriaSubcategoria(raw);
    const catNorm = normalizeCategoriaAgainstCatalog(catGuess.categoria, catGuess.subcategoria);

    // Opcionales: proveedor y descripción acotada
    let proveedor = "";
    const mProvArq = raw.match(/al\s+arquitecto\s+([^,\.]+)(?:,|\.|$)/i);
    if (mProvArq && mProvArq[1]) proveedor = titleCaseName(mProvArq[1]);

    // Si mencionan "a la cuenta del arquitecto" sin nombre
    if (!proveedor && normForMatch(raw).includes("cuenta del arquitecto")) {
      proveedor = "";
    }

    let descripcion = "";
    if (proveedor && String(tipo).toLowerCase() === "gasto") {
      if (metodoPago === "Efectivo") descripcion = `Pago al arquitecto ${proveedor} mediante depósito en efectivo.`;
      else if (metodoPago === "Transferencia") descripcion = `Pago al arquitecto ${proveedor} por transferencia.`;
      else descripcion = `Pago al arquitecto ${proveedor}.`;
    }

    // Si la categoría es aportes, usa destino/origen más estándar si el texto lo sugiere
    let origen = od.origen;
    let destino = od.destino;
    if (catNorm.categoria === "Aportes / Capital") {
      if (!destino) destino = "Caja del proyecto";
      if (!origen && reparto === "gabriel") origen = "Cuenta Gabriel";
      if (!origen && reparto === "vania") origen = "Cuenta Vania";
      if (!origen && reparto === "ambos") origen = "Socios";
    }

    // Ajuste de tipo si la categoría es Aportes/Capital
    const finalTipo = catNorm.categoria === "Aportes / Capital" ? "ingreso" : tipo;

    return {
      tipo: finalTipo,
      fecha: fechaISO, // YYYY-MM-DD
      categoria: catNorm.categoria,
      subcategoria: catNorm.subcategoria,
      montoTotal: Number.isFinite(monto) ? monto : NaN,
      reparto: reparto,
      cuentaMedioSalida: cuentaMedioSalida,
      origen: origen,
      destino: destino,
      estado: estado,
      metodoPago: metodoPago,
      descripcion: descripcion,
      proveedor: proveedor,
      numeroDocumento: "",
      notas: descripcion ? "" : normalizeStr(raw),
    };
  }

  const REQUIRED_FIELDS = [
    "tipo",
    "fecha",
    "categoria",
    "subcategoria",
    "montoTotal",
    "reparto",
    "cuentaMedioSalida",
    "origen",
    "destino",
    "estado",
    "metodoPago",
  ];

  const OPTIONAL_FIELDS = ["descripcion", "proveedor", "numeroDocumento", "notas", "comprobante"];

  function validateMovementDraftForAI(draft) {
    const d = draft || {};
    const missingRequired = [];
    const missingOptional = [];

    for (const k of REQUIRED_FIELDS) {
      const v = d[k];
      if (k === "montoTotal") {
        if (!Number.isFinite(Number(v)) || Number(v) <= 0) missingRequired.push(k);
        continue;
      }
      if (!normalizeStr(v)) missingRequired.push(k);
    }

    for (const k of OPTIONAL_FIELDS) {
      const v = d[k];
      if (!normalizeStr(v)) missingOptional.push(k);
    }

    return {
      isValid: missingRequired.length === 0,
      missingRequired,
      missingOptional,
      draft: { ...d, montoTotal: Number.isFinite(Number(d.montoTotal)) ? Number(d.montoTotal) : d.montoTotal },
    };
  }

  function classifyIntent(text) {
    const t = normForMatch(text);
    if (!t) return "UNKNOWN";

    const looksCreate = /(registra|registrar|ingresa|ingresar|crea|crear|anota|anotar|pague|pague|pago|pagu[oé]|se pago|se pag[oó]|deposito|dep[oó]sito|aporte|aporto|inyecta|inyeccion|inyecci[oó]n|abono)/.test(t);
    const looksQuery = /(lista|listado|hazme|mu[eé]strame|cuanto|cu[aá]nto|balance|resumen|caja actual|por categor[ií]a|sin comprobante|filtra|buscar)/.test(t);

    if (looksCreate && !looksQuery) return "CREATE_MOVEMENT";
    if (looksQuery && !looksCreate) return "QUERY_DATA";
    if (looksCreate && looksQuery) {
      // Preferir consulta si pregunta explícita
      if (t.includes("?") || t.includes("cuanto") || t.includes("balance") || t.includes("lista")) return "QUERY_DATA";
      return "CREATE_MOVEMENT";
    }
    return "UNKNOWN";
  }

  function fmtMoney(value) {
    if (global.ISD && global.ISD.format && global.ISD.format.formatCurrency) return global.ISD.format.formatCurrency(value);
    const n = Number(value);
    const safe = Number.isFinite(n) ? n : 0;
    return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(safe);
  }

  function monthKeyFromDate(fechaISO) {
    const s = String(fechaISO || "");
    if (s.length >= 7) return s.slice(0, 7);
    return "";
  }

  function answerLocalQuestion(text, movements) {
    const t = normForMatch(text);
    const list = movements || [];
    const reports = global.ISD && global.ISD.reports ? global.ISD.reports : null;

    function isGasto(m) {
      return normForMatch(m && m.tipo).indexOf("gasto") !== -1;
    }

    function linesForMovements(items, whoKey) {
      const out = [];
      for (const m of items) {
        const fecha = m.fecha || "—";
        const cat = normalizeStr(m.categoria) || "Sin categoría";
        const sub = normalizeStr(m.subcategoria) || "Sin subcategoría";
        const total = Number(m.montoTotal) || 0;
        const asig = whoKey === "gabriel" ? Number(m.aporteGabriel) || 0 : Number(m.aporteVania) || 0;
        out.push(`- ${fecha} — ${cat} / ${sub} — Asignado ${whoKey === "gabriel" ? "Gabriel" : "Vania"}: ${fmtMoney(asig)} (Total: ${fmtMoney(total)})`);
      }
      return out;
    }

    // 1) Gastos de Gabriel / Vania
    if (t.includes("gastos de gabriel") || (t.includes("gastos") && t.includes("gabriel"))) {
      const gastos = list.filter((m) => isGasto(m) && Number(m.aporteGabriel || 0) > 0);
      if (!gastos.length) return "No encontré gastos asignados a Gabriel en los movimientos locales.";
      const head = `Gastos de Gabriel (${gastos.length}):`;
      return [head, ...linesForMovements(gastos, "gabriel")].join("\n");
    }

    if (t.includes("gastos de vania") || (t.includes("gastos") && t.includes("vania"))) {
      const gastos = list.filter((m) => isGasto(m) && Number(m.aporteVania || 0) > 0);
      if (!gastos.length) return "No encontré gastos asignados a Vania en los movimientos locales.";
      const head = `Gastos de Vania (${gastos.length}):`;
      return [head, ...linesForMovements(gastos, "vania")].join("\n");
    }

    // 2) Caja actual
    if (t.includes("caja actual") || (t.includes("caja") && t.includes("actual"))) {
      if (reports && reports.getCajaActual) {
        const caja = reports.getCajaActual(list);
        return `Caja actual del proyecto: ${fmtMoney(caja)}.`;
      }
      return "No pude calcular la caja actual (reports.js no está disponible).";
    }

    // 3) Movimientos sin comprobante
    if (t.includes("sin comprobante") || (t.includes("movimientos") && t.includes("comprobante") && (t.includes("sin") || t.includes("faltan")))) {
      if (reports && reports.getMovimientosSinComprobante) {
        const sin = reports.getMovimientosSinComprobante(list) || [];
        if (!sin.length) return "No hay movimientos sin comprobante (según los datos locales).";
        const lines = sin.map((m) => `- ${m.fecha || "—"} — ${normalizeStr(m.categoria) || "Sin categoría"} / ${normalizeStr(m.subcategoria) || "Sin subcategoría"} — ${fmtMoney(Number(m.montoTotal) || 0)}`);
        return [`Movimientos sin comprobante (${sin.length}):`, ...lines].join("\n");
      }
      return "No pude obtener movimientos sin comprobante (reports.js no está disponible).";
    }

    // 4) Gastos por categoría
    if (t.includes("gastos por categoria") || t.includes("gastos por categoría") || (t.includes("por categoria") && t.includes("gasto"))) {
      if (reports && reports.getGastoPorCategoria) {
        const rows = reports.getGastoPorCategoria(list) || [];
        if (!rows.length) return "No hay datos suficientes para gastos por categoría.";
        const top = rows.slice(0, 12).map((r) => `- ${normalizeStr(r.categoria) || "Sin categoría"}: ${fmtMoney(r.total || 0)}`);
        return ["Gastos por categoría:", ...top].join("\n");
      }
      return "No pude calcular gastos por categoría (reports.js no está disponible).";
    }

    // 5) Balance mes/año (mayo 2026)
    if (t.includes("balance") || t.includes("saldo del mes") || (t.includes("mes") && t.includes("202"))) {
      const key = parseMonthYearKey(text);
      if (!key) {
        return "Para el balance mensual indica el mes y año (ej: “Balance de mayo 2026”).";
      }
      const monthMovs = list.filter((m) => monthKeyFromDate(m.fecha) === key);
      const ingresos = monthMovs.filter((m) => normForMatch(m.tipo) === "ingreso").reduce((acc, m) => acc + (Number(m.montoTotal) || 0), 0);
      const gastos = monthMovs.filter((m) => normForMatch(m.tipo) === "gasto").reduce((acc, m) => acc + (Number(m.montoTotal) || 0), 0);
      const saldo = ingresos - gastos;

      const detalle = monthMovs
        .slice()
        .sort((a, b) => String(a.fecha || "").localeCompare(String(b.fecha || "")))
        .map((m) => `- ${m.fecha || "—"} — ${normalizeStr(m.tipo) || "—"} — ${normalizeStr(m.categoria) || "Sin categoría"} / ${normalizeStr(m.subcategoria) || "Sin subcategoría"} — ${fmtMoney(Number(m.montoTotal) || 0)}`);

      return [
        `Balance ${key}:`,
        `- Ingresos: ${fmtMoney(ingresos)}`,
        `- Gastos: ${fmtMoney(gastos)}`,
        `- Saldo del mes: ${fmtMoney(saldo)}`,
        `Movimientos del mes (${monthMovs.length}):`,
        ...(detalle.length ? detalle : ["- (sin movimientos)"]),
      ].join("\n");
    }

    return [
      "Por ahora puedo ayudarte con:",
      "- crear un borrador de movimiento desde texto (sin guardar automáticamente)",
      "- gastos de Gabriel / gastos de Vania",
      "- balance mensual (ej: “balance de mayo 2026”)",
      "- gastos por categoría",
      "- movimientos sin comprobante",
      "- caja actual",
    ].join("\n");
  }

  function analyzeUserMessage(text, movements) {
    const intent = classifyIntent(text);
    if (intent === "CREATE_MOVEMENT") {
      const draft = buildMovementDraftFromText(text);
      const validation = validateMovementDraftForAI(draft);
      return { intent, ...validation };
    }
    if (intent === "QUERY_DATA") {
      const answer = answerLocalQuestion(text, movements || []);
      return { intent, answer };
    }
    return {
      intent: "UNKNOWN",
      answer:
        "No pude entender claramente tu intención. Prueba con:\n" +
        "- “Registra un gasto de 1.000.000 el 10 de mayo 2026 ...”\n" +
        "- “Gastos de Gabriel” / “Balance de mayo 2026” / “Caja actual”",
    };
  }

  global.ISD.aiAssistant = {
    analyzeUserMessage,
    buildMovementDraftFromText,
    validateMovementDraftForAI,
    answerLocalQuestion,
    classifyIntent,
  };
})();

