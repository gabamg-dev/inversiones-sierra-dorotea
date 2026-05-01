## 09 - Estrategia de migración a nube (futuro)

### Objetivo
Evolucionar desde una app local-first (HTML/JS + `localStorage` + `IndexedDB`) hacia una versión online con:
- autenticación real,
- base de datos,
- almacenamiento de comprobantes en nube,
- auditoría y trazabilidad multiusuario.

### Arquitectura futura (alto nivel)
- **Frontend**: Next.js (UI moderna, rutas, SSR opcional).
- **Router**: App Router (recomendado).
- **Lenguaje**: TypeScript (recomendado).
- **Auth**: Supabase Auth (login de socios, recuperación, MFA opcional).
- **DB**: Supabase Postgres (movimientos, categorías, auditoría).
- **Storage**: Supabase Storage (comprobantes PDF/imagen).
- **Hosting**: Vercel.
-
- **Deploy**: GitHub conectado a Vercel (push a `main` → producción; PR/branches → preview).

### Sitio privado (recomendación)
- En producción, el sitio debe estar **protegido**:
  - **Capa 1 (temporal)**: clave general de acceso (variable `SITE_ACCESS_PASSWORD`) o
  - **Capa 2 (real)**: **login** con Supabase Auth (Gabriel/Vania) + RLS.
- Opcional: agregar **middleware de Next.js** para bloquear rutas sin sesión válida.

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
1. Definir API/contratos: movimientos, auditoría, adjuntos.
2. Migrar persistencia de movimientos:
   - de `localStorage` → Postgres (con sync/backup).
3. Migrar comprobantes:
   - de IndexedDB → Storage remoto.
4. Mantener compatibilidad:
   - permitir importación JSON desde versión local.
5. Endurecer seguridad:
   - signed URLs para descarga,
   - reglas RLS (Row Level Security) en Postgres,
   - políticas de Storage por usuario/proyecto.

### Storage (bucket recomendado)
- Bucket privado: `comprobantes`
- Estructura sugerida:
  - `comprobantes/movements/{movement_id}/{attachment_id}-{safe_filename}`
- Acceso:
  - Signed URLs o descarga server-side (evitar URLs públicas).

### Asistente IA (futuro)
Para habilitar IA real sin exponer secretos:
- Crear endpoint server-side en Vercel (ej. `POST /api/ai-assistant`).
- El frontend **nunca** debe contener `OPENAI_API_KEY` o `GEMINI_API_KEY`.
- Las API keys deben vivir en **Vercel Environment Variables**.
- El endpoint puede:
  - consultar Supabase (Postgres) para contexto,
  - generar respuestas/borradores con OpenAI o Gemini,
  - devolver un resultado estructurado (para que el usuario confirme antes de guardar).

