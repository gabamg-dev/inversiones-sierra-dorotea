## 01 - Arquitectura de software

### Objetivo de la arquitectura
Mantener una base **profesional, escalable y modular**, separando UI, dominio y persistencia para facilitar:
- evolución por etapas,
- pruebas manuales consistentes,
- futura migración a backend/API,
- exportaciones y reportes.

### Estructura de carpetas (alto nivel)
- `index.html`: layout y contenedores de UI.
- `css/styles.css`: estilos globales.
- `js/`
  - `app.js`: inicialización, wiring UI ↔ dominio (sin lógica de persistencia interna).
  - `storage.js`: abstracción de persistencia (hoy `localStorage`, futuro API/IndexedDB).
  - `movements.js`: lógica de dominio para movimientos (crear/listar/validar/normalizar).
  - `categories.js`: catálogo de categorías/subcategorías base.
  - `format.js`: helpers únicos de formato (moneda CLP y etiquetas de mes/fecha).
  - `ui-sections.js`: controla secciones colapsables de la UI (Dashboard/Resumen/Gráficos/Formulario/Movimientos) y persiste estado abierto/cerrado en `localStorage`.
  - `attachments.js`: contrato para comprobantes/adjuntos. En local, metadata va en `localStorage` y el archivo real se guardará en `IndexedDB`. En nube futura se reemplaza por Storage remoto.
  - `security.js`: validación local del **PIN** (`validatePin`) para confirmar alta, edición y baja de movimientos; sustituible más adelante por autenticación real / backend.
  - `audit.js`: auditoría local (historial de acciones CREATE/UPDATE/DELETE) persistida en `localStorage` con clave separada.
  - `reports.js`: cálculos agregados para dashboard (**caja**, **total ingresos/capital**, **gastos totales**, **aportes de capital por socio**, **gastos asignados por socio**). Métricas de **comparación o diferencia entre socios** no se muestran en el dashboard principal; quedarán para una futura sección **“Resumen entre socios”** (donde también podrá usarse `getDiferenciaAportesCapital` u otras agregaciones con texto explicativo).
  - `charts.js`: render de gráficos (Chart.js) y ciclo de vida (destroy/re-render).
  - `export-excel.js`: exportación Excel (ETAPA 4).
  - `email-placeholder.js`: contratos/funciones para integración futura (ETAPA 6).
- `docs/`: documentación obligatoria del proyecto.
- `assets/`: recursos estáticos y comprobantes.
- `data/`: espacio reservado para respaldos/importaciones (ETAPA 5).

### Flujo de datos (ETAPA 1)
UI (formulario) → `app.js` → `movements.createMovement()` → `storage.saveMovements()` → persistencia.

Para listar:
`app.js` → `storage.loadMovements()` → `movements.sortMovements()` → render tabla.

### Decisiones clave
- **Persistencia desacoplada**: toda lectura/escritura pasa por `storage.js`.
- **Dominio centrado en `movements.js`**: normalización y reglas de movimiento viven fuera de la UI.
- **Evolución incremental**: módulos futuros existen como archivo (o placeholder) para mantener consistencia y evitar “código improvisado”.

### Exportación Excel (ETAPA 4)
- La exportación se implementa en `js/export-excel.js` como `window.ISD.exportExcel.exportWorkbook({ movements, auditLogs, reports })`.
- Se genera un `.xlsx` con varias hojas (resumen, movimientos, agregaciones y auditoría).
- Los **comprobantes** no se incrustan: solo se exporta metadata (el blob real vive en IndexedDB).

### Preparación migración online (ETAPA 6A)
- Arquitectura objetivo:
  - **Frontend**: Next.js (App Router) en Vercel, TypeScript recomendado.
  - **Backend**: API routes / server actions (server-side) + Supabase server client.
  - **Auth**: Supabase Auth (usuarios Gabriel/Vania).
  - **DB**: Supabase Postgres (movimientos + auditoría).
  - **Storage**: Supabase Storage (bucket privado `comprobantes`).
  - **IA**: endpoint server-side `POST /api/ai-assistant` (OpenAI/Gemini) con keys solo en env del servidor.
- Archivos guía (ETAPA 6A):
  - `supabase/schema.sql` (propuesta inicial de tablas y sección RLS futura)
  - `.env.example` (variables de entorno)
  - `docs/11_FLUJO_GIT_VERCEL_SUPABASE.md`
  - `docs/12_ROADMAP_MIGRACION_ONLINE.md`

