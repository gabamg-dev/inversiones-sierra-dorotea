/**
 * POST /api/ai-assistant — OpenAI + Firestore (solo miembros activos).
 * Variables: OPENAI_API_KEY, AI_MODEL, FIREBASE_* (Admin)
 */

const OpenAI = require("openai");
const {
  normalizeMovementDoc,
  normalizeAuditDoc,
  normalizeMemberDoc,
  computeStats,
  compactMovementLine,
  buildContextBlock,
  CATEGORY_GROUPS_HINT,
} = require("./_aiContext");

const { postProcessRemoteAiPayload } = require("./_aiDeterministic");

const SYSTEM_PROMPT = `Eres el asistente financiero del proyecto Inversiones Sierra Dorotea (construcción de una vivienda).
Tienes acceso a datos resumidos de movimientos financieros, auditoría y miembros del proyecto (solo metadata).
Debes responder en español, ser claro y NO inventar cifras: usa únicamente los datos del contexto para números y listados.
Si falta información en el contexto, dilo explícitamente.
NO guardas movimientos en base de datos. Solo propones borradores en JSON para que el usuario los revise y confirme en la app (con PIN).

Montos Chile (CLP): entiende expresiones como "200mil", "200 lucas", "1 palo" (= 1.000.000), "1.5 millones", etc.
En el texto de "message" puedes formatear montos como $200.000 (pesos chilenos).
En draft.montoTotal SIEMPRE número entero en pesos (sin puntos ni símbolo).

Fechas relativas: usa la fecha/hora de referencia y zona horaria del usuario que vienen en el contexto.
Para registrar un movimiento con día exacto, si el usuario no dio día, usa mode "needs_more_info" y pide la fecha exacta.
Para consultas de un mes completo (ej. "mayo 2026") puedes usar agregados mensuales del contexto.

Categorías principales válidas (subcategoría debe ser coherente): ${CATEGORY_GROUPS_HINT.join(", ")}.

Para borradores de movimiento, reparto debe ser uno de: "gabriel" | "vania" | "ambos" (minúsculas).
tipo: "ingreso" | "gasto" | "ajuste" cuando aplique.
estado: "pagado" | "pendiente" | "anulado" | "reembolsado" si aplica.

Responde SIEMPRE con un único objeto JSON (sin markdown) con esta forma exacta:
{
  "mode": "answer" | "draft" | "needs_more_info",
  "message": "texto para el usuario",
  "draft": null o objeto con campos del borrador,
  "missingRequired": [],
  "missingOptional": [],
  "warnings": []
}

Campos obligatorios del borrador cuando mode es draft o needs_more_info (rellena los que puedas):
tipo, fecha (YYYY-MM-DD), categoria, subcategoria, montoTotal (number),
reparto, cuentaMedioSalida, origen, destino, estado, metodoPago,
descripcion, proveedor, numeroDocumento, notas (opcionales últimos salvo que el usuario los pida).

Si mode es "answer", draft debe ser null y missingRequired vacío salvo que quieras sugerir algo opcional en warnings.`;

function jsonError(res, status, message, errorCode) {
  return res.status(status).json({
    ok: false,
    message: message || "No se pudo completar la solicitud.",
    error: errorCode || "ERROR",
  });
}

function parseBearer(req) {
  const h = req.headers.authorization || req.headers.Authorization || "";
  const m = String(h).match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : "";
}

async function fetchMovementsOrdered(db) {
  try {
    const snap = await db.collection("movements").orderBy("fecha", "desc").limit(500).get();
    return snap.docs.map((doc) => normalizeMovementDoc(doc));
  } catch {
    const snap = await db.collection("movements").limit(500).get();
    const rows = snap.docs.map((doc) => normalizeMovementDoc(doc));
    rows.sort((a, b) => String(b.fecha || "").localeCompare(String(a.fecha || "")));
    return rows;
  }
}

async function fetchAuditOrdered(db) {
  try {
    const snap = await db.collection("auditLogs").orderBy("createdAt", "desc").limit(100).get();
    return snap.docs.map((doc) => normalizeAuditDoc(doc));
  } catch {
    const snap = await db.collection("auditLogs").limit(100).get();
    const rows = snap.docs.map((doc) => normalizeAuditDoc(doc));
    rows.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    return rows.slice(0, 100);
  }
}

async function fetchMembers(db) {
  const snap = await db.collection("projectMembers").get();
  return snap.docs.map((doc) => normalizeMemberDoc(doc));
}

function validateAiPayload(obj) {
  if (!obj || typeof obj !== "object") return false;
  const mode = obj.mode;
  if (!["answer", "draft", "needs_more_info"].includes(mode)) return false;
  if (typeof obj.message !== "string") return false;
  return true;
}

function normalizeDraftFromModel(d) {
  if (!d || typeof d !== "object") return null;
  const out = { ...d };
  if (out.montoTotal != null) out.montoTotal = Number(out.montoTotal);
  const r = String(out.reparto || "").toLowerCase();
  if (r.includes("gabriel")) out.reparto = "gabriel";
  else if (r.includes("vania")) out.reparto = "vania";
  else if (r.includes("ambos") || r.includes("50")) out.reparto = "ambos";
  const t = String(out.tipo || "").toLowerCase();
  if (t.includes("ingreso")) out.tipo = "ingreso";
  else if (t.includes("gasto")) out.tipo = "gasto";
  else if (t.includes("ajuste")) out.tipo = "ajuste";
  return out;
}

module.exports = async function aiAssistantHandler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
    res.setHeader("Access-Control-Max-Age", "86400");
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return jsonError(res, 405, "Método no permitido.", "METHOD_NOT_ALLOWED");
  }

  let adminAuth;
  let adminDb;
  try {
    const mod = require("./_firebaseAdmin");
    adminAuth = mod.adminAuth;
    adminDb = mod.adminDb;
  } catch (e) {
    return jsonError(res, 500, "Servidor sin configuración Firebase Admin.", "ADMIN_CONFIG");
  }

  const token = parseBearer(req);
  if (!token) {
    return jsonError(res, 401, "Falta token de autorización.", "NO_TOKEN");
  }

  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(token);
  } catch {
    return jsonError(res, 401, "Token inválido o expirado.", "INVALID_TOKEN");
  }

  const uid = decoded.uid;
  const memberSnap = await adminDb.collection("projectMembers").doc(uid).get();
  if (!memberSnap.exists) {
    return jsonError(res, 403, "Usuario no autorizado para este proyecto.", "NOT_MEMBER");
  }
  const mem = memberSnap.data() || {};
  if (mem.active !== true) {
    return jsonError(res, 403, "Miembro inactivo.", "INACTIVE_MEMBER");
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return jsonError(res, 400, "JSON inválido.", "BAD_JSON");
    }
  }

  const message = String((body && body.message) || "").trim().slice(0, 12000);
  if (!message) {
    return jsonError(res, 400, "Campo message requerido.", "NO_MESSAGE");
  }

  const timezone = String((body && body.timezone) || "").slice(0, 120);
  const currentDate = String((body && body.currentDate) || new Date().toISOString()).slice(0, 80);

  if (!process.env.OPENAI_API_KEY) {
    return jsonError(res, 503, "OpenAI no configurado en el servidor.", "NO_OPENAI");
  }

  let movements;
  let audits;
  let members;
  try {
    [movements, audits, members] = await Promise.all([
      fetchMovementsOrdered(adminDb),
      fetchAuditOrdered(adminDb),
      fetchMembers(adminDb),
    ]);
  } catch (e) {
    console.error("Firestore read error:", e && e.message);
    return jsonError(res, 500, "No se pudieron leer los datos del proyecto.", "FIRESTORE_READ");
  }

  const stats = computeStats(movements);
  const movementsCompactLines = movements.slice(0, 120).map(compactMovementLine);
  const auditCompactLines = audits.slice(0, 80).map((a) =>
    [a.actionType, a.userEmail, a.movementId, a.createdAt || "", (a.summary || "").slice(0, 120)].join("|")
  );

  const contextText = buildContextBlock({
    stats,
    movementsCompactLines,
    auditCompactLines,
    members,
    timezone,
    currentDateIso: currentDate,
  });

  const userContent = `${contextText}

=== Instrucciones operativas ===
- Si la petición es una consulta sobre datos existentes, usa mode "answer".
- Si la petición es crear/registrar un movimiento y tienes todos los obligatorios, usa mode "draft".
- Si faltan obligatorios para dar de alta, usa mode "needs_more_info" y lista missingRequired con nombres de campo en inglés como en el borrador: tipo, fecha, categoria, subcategoria, montoTotal, reparto, cuentaMedioSalida, origen, destino, estado, metodoPago.

=== Pregunta o instrucción del usuario ===
${message}`;

  const model = process.env.AI_MODEL || "gpt-4o-mini";

  let client;
  try {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  } catch (e) {
    return jsonError(res, 500, "Cliente OpenAI no disponible.", "OPENAI_INIT");
  }

  let completion;
  try {
    completion = await client.chat.completions.create({
      model,
      temperature: 0.2,
      max_tokens: 4096,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
    });
  } catch (e) {
    console.error("OpenAI error:", e && e.message);
    const hint =
      "El modelo configurado en AI_MODEL podría no estar disponible para tu cuenta. Prueba con gpt-4o-mini o gpt-4.1-mini en variables de entorno.";
    return jsonError(res, 502, hint, "OPENAI_CALL_FAILED");
  }

  const raw = completion.choices && completion.choices[0] && completion.choices[0].message
    ? completion.choices[0].message.content
    : "";
  let parsed;
  try {
    parsed = JSON.parse(raw || "{}");
  } catch {
    return jsonError(res, 502, "La IA devolvió un formato no válido. Intenta de nuevo o cambia de modelo.", "BAD_AI_JSON");
  }

  if (!validateAiPayload(parsed)) {
    return jsonError(res, 502, "Respuesta de IA incompleta.", "INVALID_AI_SHAPE");
  }

  const draftNorm = normalizeDraftFromModel(parsed.draft);

  const finalPayload = postProcessRemoteAiPayload(
    {
      mode: parsed.mode,
      message: String(parsed.message || ""),
      draft: draftNorm,
      missingRequired: Array.isArray(parsed.missingRequired) ? parsed.missingRequired : [],
      missingOptional: Array.isArray(parsed.missingOptional) ? parsed.missingOptional : [],
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
    },
    message,
    currentDate,
    timezone
  );

  return res.status(200).json({
    ok: true,
    mode: finalPayload.mode,
    message: finalPayload.message,
    draft: finalPayload.draft,
    missingRequired: finalPayload.missingRequired,
    missingOptional: finalPayload.missingOptional,
    warnings: finalPayload.warnings,
  });
};
