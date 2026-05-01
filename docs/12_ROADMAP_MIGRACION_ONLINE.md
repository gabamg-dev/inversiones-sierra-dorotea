## 12 - Roadmap migración online (Vercel + GitHub + Firebase)

### Objetivo
Migrar desde app local-first (HTML/JS + `localStorage` + IndexedDB) a una versión online con:
- **Vercel** (hosting/deploy desde GitHub),
- **Firebase Auth** (Gabriel/Vania),
- **Cloud Firestore** (movimientos + auditoría + metadata),
- **Firebase Storage** (comprobantes),
- **ChatGPT/OpenAI** en fase posterior vía endpoint server-side (sin keys en frontend).

---

## Fase F1 — Preparación Firebase (fundaciones)
- Variables `NEXT_PUBLIC_FIREBASE_*` en `.env.example` + `.env.local` (local, ignorado) + Vercel.
- Reglas base: `firebase/firestore.rules` y `firebase/storage.rules`.
- Documentación: `docs/13_FIREBASE_ONLINE_IMPLEMENTACION.md`.
- Placeholders: `js/firebase-config.js`, `js/firebase-service.js` (sin romper app estática).

## Fase F2 — Login con Firebase Auth
- UI de login (Email/Password).
- Sesión persistente y manejo de errores básico.
- Sustituir/evolucionar la barrera temporal `js/access-gate.js` cuando corresponda.

## Fase F3 — Movimientos online en Firestore
- CRUD detrás de una capa de servicio (ideal: un solo módulo “data layer”).
- Índices Firestore si aplica (consultas por fecha/tipo/categoría).

## Fase F4 — Auditoría online
- Colección `auditLogs` con trazabilidad multiusuario.
- Ideal: escritura server-side (Cloud Functions) en fase posterior.

## Fase F5 — Comprobantes en Firebase Storage
- Paths `comprobantes/{movementId}/{fileName}`.
- Metadata en `attachments` y/o campo `comprobante` en `movements`.

## Fase F6 — Migración local → Firebase
- Export/import JSON (movimientos) + estrategia para blobs (manual o ZIP futuro).

## Fase F7 — ChatGPT API server-side
- Endpoint seguro (Vercel serverless / Cloud Functions) con `OPENAI_API_KEY` solo en servidor.

## Fase F8 — Pruebas Gabriel/Vania
- Validación de permisos, reglas, consistencia de métricas vs local, y flujos de adjuntos.

---

## Apéndice — Supabase (legado / alternativa)
El archivo `supabase/schema.sql` y variables `SUPABASE_*` en `.env.example` se mantienen como referencia histórica.
La decisión actual del proyecto para backend online es **Firebase**.

