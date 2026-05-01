## Inversiones Sierra Dorotea

Aplicación web local (HTML + CSS + JS) para controlar el flujo financiero de un proyecto inmobiliario (construcción de vivienda).

### Objetivo
- Registrar **ingresos** y **gastos** con trazabilidad (origen/destino, pagador, método, documento, proveedor).
- Controlar **aportes de socios** (Gabriel / Vania) incluyendo repartos 100/0, 0/100 y 50/50.
- Clasificar movimientos con **categorías y subcategorías dinámicas** (grupo principal + detalle).
- Controlar la **caja disponible del proyecto** (ingresos - gastos).
- Dashboard principal con métricas operativas (caja, ingresos totales, gastos totales y reparto por socio). La **comparación entre socios** (quién aportó más, equilibrios, compensaciones) se prevé en una futura sección **“Resumen entre socios”**, no como tarjetas aisladas de “diferencia” arriba.
- Separar **reparto contable** (Gabriel/Vania en el movimiento) de **cuenta / medio de salida** (origen físico del dinero).
- Preparar una arquitectura modular y escalable para:
  - gráficos (Chart.js)
  - exportación Excel (SheetJS)
  - respaldos/importación JSON
  - futura integración backend + envío de reportes por correo

### Cómo ejecutar (modo local)
1. Abrir `index.html` en el navegador (doble clic).
2. Registrar un movimiento desde el formulario.
3. Ver el movimiento en la tabla. La información queda persistida en el navegador vía `localStorage`.

### Deploy (Vercel, sitio estático)
El proyecto puede desplegarse como sitio estático en Vercel (GitHub → Vercel).
- Hoy la app sigue siendo **local-first**: los datos se guardan en el navegador del visitante (`localStorage` + IndexedDB para comprobantes).
- La sincronización multi-dispositivo llegará cuando se implemente **Firebase** (Firestore + Storage) y login real.

Variables:
- Usa `.env.example` como plantilla.
- Crea `.env.local` en tu Mac para valores reales (Firebase) y **no lo subas** (está ignorado por `.gitignore`).

El campo **monto** se escribe con **separador de miles** (puntos) en pantalla; al guardar se almacena como **número** sin formato.

Las validaciones del formulario están centralizadas en `movements.js` (`validateMovementDraft`): campos obligatorios incluyen origen, destino y **método de pago** (lista desplegable). La **descripción** es opcional y puede guardarse vacía.

**PIN local (por defecto `112233`):** registrar un movimiento nuevo, guardar una edición o eliminar un registro requiere introducir el PIN en el modal de confirmación. La única comprobación debe hacerse vía `ISD.security.validatePin()` para poder cambiar luego por autenticación real. Los datos sensibles finales irán en backend; hoy el PIN es sólo una barrera básica en el navegador.

**Auditoría (local):** el sistema registra un historial de acciones (CREATE/UPDATE/DELETE) en `localStorage` para trazabilidad. Se consulta bajo demanda con el botón **“Ver historial de acciones”** (abre un modal con los últimos eventos).

### UX: secciones colapsables
Las secciones principales (Dashboard, Resumen rápido, Gráficos, Registro de movimientos y Movimientos) se pueden **colapsar/desplegar** desde su cabecera. El estado se persiste en `localStorage` para mantener la preferencia al recargar.

### Dashboard y análisis
- Dashboard financiero con caja, ingresos, gastos y métricas por socio.
- Reportes/agregaciones por mes y por categoría.
- “Resumen rápido” con top categoría, mes con mayor gasto, último movimiento y contador.
- Gráficos con Chart.js: gasto mensual, gasto por categoría y **flujo de caja mensual** (ingresos, gastos y saldo acumulado).

### Filtros de movimientos
- Sección **“Filtros de movimientos”** para consultar la **tabla** por:
  - fechas, tipo, categoría/subcategoría, reparto, estado, método de pago y texto libre.
- En esta etapa, los filtros **no** cambian el dashboard ni los gráficos (prepara futura “vista filtrada” y exportación filtrada).

### Asistente local del proyecto
- Panel **“Asistente IA”** con parser determinístico para:
  - crear **borradores** de movimientos desde texto,
  - listar **campos obligatorios faltantes**,
  - responder **consultas locales** (caja actual, gastos por socio, balance mensual, gastos por categoría, sin comprobante).
- No usa OpenAI/Gemini todavía (sin llamadas externas, sin API keys en frontend).

### Exportación a Excel
- Botón **“Exportar Excel”** genera un `.xlsx` con hojas de resumen, movimientos y agregaciones.
- **No** incluye PDFs/imágenes: solo exporta metadata de comprobantes (id local, nombre, tipo y tamaño).

### Preparación migración online (Vercel + GitHub + Firebase)
Camino elegido para la versión online (en progreso; aún sin CRUD remoto completo):
- **Git/GitHub** como repositorio fuente.
- **Vercel** para despliegue (push a `main` → producción; PR/branches → preview).
- **Firebase** para **Auth + Firestore + Storage**.
- Sitio privado por capas:
  - Capa 1 (temporal): barrera simple (`js/access-gate.js`) / `SITE_ACCESS_PASSWORD` (cuando aplique)
  - Capa 2 (real): **Firebase Auth** + reglas Firestore/Storage

Guías:
- `docs/13_FIREBASE_ONLINE_IMPLEMENTACION.md`
- Reglas: `firebase/firestore.rules`, `firebase/storage.rules`

### Comprobantes (estrategia técnica)
El proyecto contempla soporte para comprobantes **PDF/imagen**:
- **Versión local**: metadata del comprobante en el movimiento (`localStorage`) y archivo real en **IndexedDB** (Blob/File).
- **Versión futura online**: metadata similar, pero archivo real en **Firebase Storage**.

La versión local implementa el guardado/visualización/reemplazo/eliminación de comprobantes en IndexedDB.

Limitaciones local:
- Los comprobantes viven en **IndexedDB del navegador** (no en una carpeta del Mac) y no se sincronizan entre dispositivos.
- Si el navegador borra datos del sitio, los adjuntos pueden perderse.

> Nota: el roadmap histórico por etapas está en `docs/02_ROADMAP_ETAPAS.md`. El roadmap online actual (Firebase) está en `docs/12_ROADMAP_MIGRACION_ONLINE.md`.

