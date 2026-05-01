## 12 - Roadmap migración online (Vercel + Supabase) — ETAPA 6

### Objetivo
Migrar desde app local-first (HTML/JS + localStorage + IndexedDB) a una versión online privada con:
- Next.js en Vercel,
- Supabase Auth,
- Supabase Postgres,
- Supabase Storage (bucket privado),
- endpoint server-side para Asistente IA real.

---

## Fase 6A — Preparación documental y schema (esta etapa)
- Definir arquitectura objetivo (Vercel + Supabase + GitHub).
- Crear `supabase/schema.sql` (propuesta inicial).
- Crear `.env.example` con variables requeridas.
- Documentar flujo Git → GitHub → Vercel.
- Documentar estrategia de sitio privado (capa 1 y capa 2).
- Documentar estrategia de migración de datos locales.

## Fase 6B — Crear app Next.js base
- Crear proyecto Next.js (App Router).
- TypeScript recomendado.
- Primera pantalla privada (placeholder).
- Deploy inicial en Vercel.

## Fase 6C — Configurar Supabase Auth
- Crear proyecto Supabase.
- Configurar Auth (usuarios Gabriel/Vania).
- Implementar login y sesión en Next.js.
- Definir y aplicar RLS base.

## Fase 6D — Migrar movimientos (localStorage → Postgres)
- Crear API routes / server actions para CRUD de movimientos.
- Migrar reportes/dashboards para leer desde Postgres.
- Script/flujo de importación (desde export JSON local).

## Fase 6E — Migrar comprobantes (IndexedDB → Supabase Storage)
- Bucket privado `comprobantes`.
- Subida/descarga con Signed URLs o server-side streaming.
- Metadata en `attachment_metadata` y/o `movements.comprobante`.

## Fase 6F — Auditoría server-side
- Registrar CREATE/UPDATE/DELETE desde backend.
- UI de auditoría leyendo desde `audit_logs`.

## Fase 6G — Asistente IA real (endpoint seguro)
- `POST /api/ai-assistant`
- Provider configurable: `AI_PROVIDER=openai|gemini`
- Keys solo en variables de entorno.

## Fase 6H — Despliegue privado en Vercel
- Capa 1: `SITE_ACCESS_PASSWORD` (opcional, temporal).
- Capa 2: Supabase Auth + RLS (obligatoria para producción).
- Middleware Next.js para rutas privadas.

## Fase 6I — Pruebas finales (Gabriel y Vania)
- Validar consistencia de métricas vs versión local.
- Pruebas de carga/descarga de comprobantes.
- Pruebas de exportación Excel.
- Checklist de seguridad.

