# 10 - Asistente IA (Fase IA 1 local + Fase futura online)

## Objetivo
Agregar un panel **“Asistente IA”** que ayude a:
- **Crear borradores** de movimientos desde texto natural (sin guardar automáticamente).
- **Validar** campos obligatorios y listar faltantes.
- **Responder consultas locales** (caja actual, gastos por socio, balance mensual, etc.).

Esta etapa es **local-first** (HTML/CSS/JS) y **no realiza llamadas a APIs externas**.

---

## Fase IA 1 (actual) — Local / determinística
### Qué hace
- **Parser local** en `js/ai-assistant.js` (sin IA real).
- **Clasificación de intención**:
  - `CREATE_MOVEMENT`
  - `QUERY_DATA`
  - `UNKNOWN`
- **Creación de borrador**: intenta extraer y sugerir:
  - tipo, monto, fecha (ISO), reparto, método de pago, estado,
  - categoría/subcategoría (con mapeo básico a `categories.js`),
  - cuenta/medio de salida, origen, destino, proveedor y descripción corta.
- **Validación IA**: `validateMovementDraftForAI(draft)` devuelve:
  - `missingRequired` (bloquea borrador válido)
  - `missingOptional` (no bloquea)
- **Carga al formulario**: botón “Cargar borrador al formulario” rellena el formulario principal sin guardar.

### Mejora de fechas en español
El parser reconoce formatos como:
- `01 de mayo del 2026`
- `1 de mayo de 2026`
- `el dia 01 de mayo del 2026`
- `01 mayo 2026`
- `01/05/2026`, `01-05-2026`

Si detecta **mes+año** sin día (ej. `mayo 2026`), **no inventa** la fecha y la deja como faltante.

### Inferencia de estado
Si el texto contiene señales de ejecución/pago (ej. `pago`, `depósito`, `transferido`, `se realizó`, `fue realizado`) y el tipo es `Gasto` o `Ingreso`, se infiere:
- `estado = pagado`

Si aparecen palabras explícitas:
- `pendiente` → `pendiente`
- `anulado` → `anulado`
- `reembolsado` → `reembolsado`

### Cuenta / medio de salida, origen y destino
Reglas locales simples:
- “dinero de gabriel / pago que hizo gabriel …” → sugiere `Cuenta Gabriel` y `origen: Gabriel`
- “dinero de vania …” → `Cuenta Vania` y `origen: Vania`
- “caja/cuenta del proyecto …” → `Caja del proyecto`
- “al arquitecto X …” → `destino: Arquitecto X` y `proveedor: X`

### Limitaciones actuales
- No entiende contexto complejo ni ambigüedades como una IA real.
- Puede fallar con nombres muy largos, múltiples montos, o textos con varias operaciones a la vez.
- El mapeo categoría/subcategoría es **heurístico** (palabras clave), no semántico.

---

## Fase futura (online) — Vercel + Supabase + IA real (plan)
### Arquitectura propuesta
- **Frontend**: Next.js (en Vercel)
- **DB**: Supabase Postgres
- **Storage**: Supabase Storage (comprobantes)
- **Endpoint IA**: función server-side tipo `POST /api/ai-assistant`
  - Llama a OpenAI o Gemini desde el servidor
  - Consulta base de datos para contexto del proyecto

### Seguridad
- **Nunca** poner `OPENAI_API_KEY` / `GEMINI_API_KEY` en el frontend.
- Keys solo en **Environment Variables** (Vercel).
- Sitio protegido con login (Supabase Auth) y/o middleware de Next.js.

### Flujo futuro esperado
1. Usuario escribe instrucción/pregunta en el panel.
2. Frontend envía al endpoint server-side (`/api/ai-assistant`) junto con contexto permitido.
3. Endpoint consulta Supabase (movimientos, categorías, etc.).
4. Endpoint llama IA (OpenAI/Gemini) con API key segura.
5. Devuelve respuesta estructurada (borrador + explicación).
6. Acciones sensibles siguen requiriendo confirmación explícita del usuario (y/o permisos).

