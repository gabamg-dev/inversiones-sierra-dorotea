## 09 - Estrategia de migración a nube (futuro)

### Objetivo
Evolucionar desde una app local-first (HTML/JS + `localStorage` + `IndexedDB`) hacia una versión online con:
- autenticación real,
- base de datos,
- almacenamiento de comprobantes en nube,
- auditoría y trazabilidad multiusuario.

### Arquitectura online (decisión actual): Vercel + GitHub + Firebase
- **Hosting/Deploy**: Vercel (conectado a GitHub).
- **Auth**: **Firebase Auth** (Gabriel/Vania).
- **DB**: **Cloud Firestore** (movimientos, auditoría, metadata).
- **Storage**: **Firebase Storage** (comprobantes PDF/imagen).
- **IA (futuro)**: endpoint server-side (OpenAI/Gemini) sin API keys en frontend.

### Supabase (alternativa / legado)
- `supabase/schema.sql` y variables `SUPABASE_*` pueden mantenerse como referencia histórica.
- **No** es el backend elegido en esta etapa del proyecto.

### Sitio privado (recomendación)
- En producción, el sitio debe estar **protegido**:
  - **Capa 1 (temporal)**: clave general de acceso (variable `SITE_ACCESS_PASSWORD`) o barrera en `js/access-gate.js` (sitio estático)
  - **Capa 2 (real)**: **Firebase Auth** + reglas de seguridad (Firestore/Storage)

### Barrera temporal (sitio estático en Vercel)
Mientras la app aún sea estática (antes de Firebase Auth completo), se puede usar una barrera simple de acceso:
- módulo local: `js/access-gate.js`
- clave por defecto: `112233` (solo temporal)
- estado: `sessionStorage` (no sincroniza entre dispositivos)

Esto **no reemplaza** Auth real. Debe migrarse a **Firebase Auth** + reglas.

### Modelo de datos (online)
En online, el movimiento seguirá teniendo metadata del comprobante:
- `comprobante.storage.mode = "cloud"`
- `bucket`, `path`, `publicUrl` (opcional), `signedUrlAvailable` (recomendado para privacidad)

Los blobs dejan de vivir en IndexedDB y pasan a Storage remoto.

### Login / roles (sugerido)
Roles simples:
- Socio (Gabriel/Vania): CRUD de movimientos + subida/borrado de comprobantes + exportaciones.
- Auditoría: lectura completa para trazabilidad.

### Auditoría real
En nube, toda acción CREATE/UPDATE/DELETE debe registrar:
- usuario autenticado (`userId`, `email` o `displayName`)
- IP/agent (opcional)
- snapshot de cambios (diff o before/after si se requiere)

La auditoría local actual (`audit.js`) es un placeholder útil para UI/UX, pero no reemplaza auditoría server-side.

### Estrategia de migración (pasos recomendados)
1. Definir contratos: movimientos, auditoría, adjuntos (Firestore + Storage).
2. Migrar persistencia de movimientos:
   - de `localStorage` → **Firestore** (con sync/backup e importación JSON).
3. Migrar comprobantes:
   - de IndexedDB → **Firebase Storage**.
4. Mantener compatibilidad:
   - permitir importación JSON desde versión local.
5. Endurecer seguridad:
   - reglas **Firestore** (`firebase/firestore.rules`),
   - reglas **Storage** (`firebase/storage.rules`),
   - membresía explícita (`projectMembers/{uid}`) para acceso.

### Storage (Firebase)
- Bucket: usar el bucket del proyecto (ver `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`).
- Estructura sugerida:
  - `comprobantes/{movementId}/{fileName}`
- Acceso:
  - Reglas privadas (ver `firebase/storage.rules`).

### Asistente IA (futuro)
Para habilitar IA real sin exponer secretos:
- Crear endpoint server-side en Vercel (ej. `POST /api/ai-assistant`).
- El frontend **nunca** debe contener `OPENAI_API_KEY` o `GEMINI_API_KEY`.
- Las API keys deben vivir en **Vercel Environment Variables**.
- El endpoint puede:
  - consultar **Firestore** para contexto (según permisos),
  - generar respuestas/borradores con OpenAI o Gemini,
  - devolver un resultado estructurado (para que el usuario confirme antes de guardar).

