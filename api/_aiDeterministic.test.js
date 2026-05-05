/**
 * Pruebas locales de la capa determinística (sin OpenAI).
 * Ejecutar: node api/_aiDeterministic.test.js
 */

const assert = require("assert");
const {
  resolveRelativeDateFromText,
  resolveAmountFromText,
  postProcessRemoteAiPayload,
} = require("./_aiDeterministic");

const REF_ISO = "2026-05-04T15:00:00.000Z";
const TZ_PA = "America/Punta_Arenas";

assert.strictEqual(
  resolveRelativeDateFromText(
    "Ayer Gabriel depositó 200 lucas…",
    REF_ISO,
    TZ_PA
  ).resolvedYmd,
  "2026-05-03"
);

assert.strictEqual(
  resolveRelativeDateFromText("El viernes pasado Vania pagó…", REF_ISO, TZ_PA).resolvedYmd,
  "2026-05-01"
);

assert.strictEqual(resolveAmountFromText("200 lucas").amount, 200000);
assert.strictEqual(resolveAmountFromText("1 palo").amount, 1000000);
assert.strictEqual(resolveAmountFromText("1 millón 900").amount, 1900000);

const draftGabriel = postProcessRemoteAiPayload(
  {
    mode: "draft",
    message: "",
    draft: {
      tipo: "ingreso",
      fecha: "2026-05-04",
      montoTotal: 200,
      cuentaMedioSalida: "Cuenta personal Gabriel",
      origen: "Cuenta personal Gabriel",
      destino: "cuenta corriente del proyecto",
      metodoPago: "transferencia",
    },
    missingRequired: ["fecha"],
    warnings: [],
  },
  "Ayer Gabriel depositó 200 lucas desde su cuenta personal a la cuenta corriente del proyecto. Fue transferencia bancaria y quedó pagado.",
  REF_ISO,
  TZ_PA
);

assert.strictEqual(draftGabriel.draft.fecha, "2026-05-03");
assert.strictEqual(draftGabriel.draft.montoTotal, 200000);
assert.strictEqual(draftGabriel.draft.cuentaMedioSalida, "Cuenta Gabriel");
assert.strictEqual(draftGabriel.draft.origen, "Cuenta Gabriel");
assert.strictEqual(draftGabriel.draft.destino, "Cuenta corriente del proyecto");
assert.ok(!draftGabriel.missingRequired.includes("fecha"));

const draftVania = postProcessRemoteAiPayload(
  {
    mode: "draft",
    message: "",
    draft: {
      tipo: "gasto",
      fecha: "2026-05-04",
      montoTotal: 750,
      reparto: "vania",
      proveedor: "Marko Matulic",
    },
    missingRequired: [],
    warnings: [],
  },
  "El viernes pasado Vania pagó 1 palo al arquitecto Marko Matulic por transferencia y quedó pagado.",
  REF_ISO,
  TZ_PA
);

assert.strictEqual(draftVania.draft.fecha, "2026-05-01");
assert.strictEqual(draftVania.draft.montoTotal, 1000000);

console.log("api/_aiDeterministic.test.js: OK");
