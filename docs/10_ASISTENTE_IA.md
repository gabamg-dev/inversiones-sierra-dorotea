# 10 - Asistente IA (local + OpenAI server-side)

## Objetivo
El panel **Asistente IA** ayuda a:
- Responder **preguntas** sobre el proyecto (caja, gastos, categorías, auditoría, etc.).
- Proponer **borradores** de movimientos (ingreso/gasto) a partir de texto natural.
- **Nunca** guarda movimientos automáticamente: el flujo es **borrador → revisar en formulario → guardar con PIN**.

---

## Modo 1: IA local (determinística)
**Archivo:** `js/ai-assistant.js`

- Sin llamadas de red. Usa el array `currentMovements` en el navegador.
- Intents: `CREATE_MOVEMENT`, `QUERY_DATA`, `UNKNOWN`.
- Validación: `validateMovementDraftForAI`, listas de `missingRequired` / `missingOptional`.
- Se usa **siempre** como respaldo si falla el endpoint remoto, o si no hay sesión Firebase.

**Limitaciones:** heurísticas fijas, sin razonamiento profundo.

---

## Modo 2: IA real (OpenAI + Firestore en servidor)
**Endpoint:** `POST /api/ai-assistant`  
**Archivos:** `api/ai-assistant.js`, `api/_firebaseAdmin.js`, `api/_aiContext.js`

### Flujo
1. El frontend (solo con `dataMode === "firebase"` y usuario autenticado) obtiene un **ID token** con `ISD.firebaseService.getIdToken()`.
2. `fetch("/api/ai-assistant", { headers: { Authorization: "Bearer <token>" }, body: { message, timezone, currentDate } })`.
3. El servidor:
   - Verifica el token con **Firebase Admin** (`verifyIdToken`).
   - Lee `projectMembers/{uid}`; exige `active === true` o responde **403**.
   - Lee **hasta 500** movimientos y **100** logs de auditoría (resumen y filas compactas, sin blobs).
   - Construye contexto numérico (caja, totales, top categorías/meses/proveedores, etc.).
   - Llama a **OpenAI** con `OPENAI_API_KEY` y `AI_MODEL` (por defecto razonable si falta).
4. Responde **JSON estructurado** (ver abajo). El frontend lo muestra y, si aplica, rellena el preview del borrador.

### Seguridad
- **No** `OPENAI_API_KEY` en el cliente.
- **No** `FIREBASE_PRIVATE_KEY` en el cliente.
- No se envían a OpenAI: tokens completos, PIN, contraseñas, ni blobs de comprobantes.
- Errores internos no se filtran con stack al usuario; se devuelve mensaje genérico o código `error`.

### Estructura de respuesta (éxito)
```json
{
  "ok": true,
  "mode": "answer | draft | needs_more_info",
  "message": "texto en español",
  "draft": { } | null,
  "missingRequired": [],
  "missingOptional": [],
  "warnings": []
}
```

### Fallback local
Si el endpoint falla (red, 401, 502, OpenAI, etc.), `js/app.js` muestra: *"No se pudo usar IA real. Se usó asistente local."* y ejecuta `ISD.aiAssistant.analyzeUserMessage` con los movimientos actuales en memoria.

---

## Variables de entorno (Vercel)
- `OPENAI_API_KEY` — obligatoria para IA real.
- `AI_MODEL` — ej. `gpt-4o-mini`, `gpt-4.1-mini` (o el que tenga tu cuenta).
- `AI_PROVIDER=openai` — informativo; el código usa OpenAI SDK.
- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` — **service account** para Admin (ver `docs/13_FIREBASE_ONLINE_IMPLEMENTACION.md`).

---

## Criterios de producto
- Preguntas de negocio y borradores usan **datos reales** de Firestore cuando el modo remoto funciona.
- Comprobantes: solo **metadata** (`hasComprobante` en agregados); archivos siguen en IndexedDB por dispositivo.
- Proyecciones: el modelo debe marcar **estimación** y basarse en histórico; si hay pocos datos, decirlo.

---

## Pruebas sugeridas
1. Con sesión Firebase: *"Hazme un resumen general del proyecto"*.
2. *"En qué se ha gastado más dinero"*.
3. *"Quién ha hecho cambios en el sistema"* (auditoría).
4. *"Qué movimientos no tienen comprobante"*.
5. Borrador: *"Ayer deposité 200mil desde mi cuenta Gabriel a la cuenta del proyecto, transferencia, pagado"*.
