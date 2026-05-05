## Inversiones Sierra Dorotea

Aplicación web local (HTML + CSS + JS) para controlar el flujo financiero de un proyecto inmobiliario (construcción de vivienda).

### Identidad visual y layout
- Paleta institucional y tokens en `css/styles.css` (`:root`): fondos midnight navy, acentos dorados, texto cálido / grises.
- Tipografías: **Cormorant Garamond** (títulos) y **DM Sans** (interfaz), cargadas vía Google Fonts en `index.html`.
- **Logo:** el encabezado usa `assets/logo-sierra-dorotea.jpg` (imagen oficial en esa ruta).
- La cabecera principal solo muestra marca (logo + nombre); **Bloquear sesión**, **Cerrar sesión** y **Limpiar datos locales** están en la sección **Cuenta** / **Configuración avanzada**.
- **Móvil (≤768px):** formulario a una columna, cabecera y acciones flexibles, lista de movimientos en **tarjetas** (`#movementsCardList`); la tabla ancha permanece en escritorio con scroll horizontal contenido en `.table-wrap`.

### Interfaz y mensajes (usuarios finales)
La pantalla principal prioriza textos claros para gestión del proyecto: no muestra detalles de implementación (servicios en la nube, almacenamiento del navegador, endpoints, etc.). Esa información queda en este README y en `docs/`. Los **comprobantes** (archivos adjuntos) siguen sin sincronización entre dispositivos hasta una futura fase en la nube.

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
3. Ver el movimiento en la tabla. Sin Firebase, la información queda en el navegador vía `localStorage` (+ IndexedDB para archivos de comprobantes).

### Firebase (Firestore + Auth)
Con **inicio de sesión email/contraseña** y un documento válido `projectMembers/{uid}` en Firestore (`active: true`), los **movimientos** y la **auditoría** se leen y escriben en **Firestore**. Así la misma cuenta ve los mismos datos en PC y celular.

Los **comprobantes** (PDF/imagen) siguen guardándose en **IndexedDB** del dispositivo; **no** se sincronizan en la nube todavía (Firebase Storage pendiente).

### Deploy (Vercel, sitio estático)
El proyecto puede desplegarse como sitio estático en Vercel (GitHub → Vercel).
- **Sin Firebase**: datos **local-first** (`localStorage` + IndexedDB para comprobantes).
- **Con Firebase**: movimientos y auditoría online en Firestore; comprobantes siguen locales hasta la fase Storage.

Variables (Vercel / servidor):
- **Cliente (públicas):** `NEXT_PUBLIC_FIREBASE_*` si las inyectas en build (opcional; la app actual también lleva config en `js/firebase-config.js`).
- **OpenAI (solo servidor):** `OPENAI_API_KEY`, `AI_PROVIDER=openai`, `AI_MODEL` (ej. `gpt-4o-mini` o el que soporte tu cuenta).
- **Firebase Admin (solo servidor):** `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` — para `/api/ai-assistant` y verificación de tokens; ver `docs/13_FIREBASE_ONLINE_IMPLEMENTACION.md`.

Archivos locales:
- Usa `.env.example` como plantilla.
- Crea `.env.local` en tu Mac para pruebas y **no lo subas** (ignorado por `.gitignore`).

El campo **monto** se escribe con **separador de miles** (puntos) en pantalla; al guardar se almacena como **número** sin formato.

Las validaciones del formulario están centralizadas en `movements.js` (`validateMovementDraft`): campos obligatorios incluyen origen, destino y **método de pago** (lista desplegable). La **descripción** es opcional y puede guardarse vacía.

**PIN local (por defecto `112233`):** registrar un movimiento nuevo, guardar una edición o eliminar un registro requiere introducir el PIN en el modal de confirmación. La única comprobación debe hacerse vía `ISD.security.validatePin()` para poder cambiar luego por autenticación real. Los datos sensibles finales irán en backend; hoy el PIN es sólo una barrera básica en el navegador.

**Auditoría:** en modo local el historial vive en `localStorage`. En modo Firestore, las últimas entradas se leen desde la colección `auditLogs`. Consulta con **“Ver historial de acciones”**.

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

### Asistente IA del proyecto
- **Con Firebase + variables en Vercel:** panel **“Asistente IA”** llama a **`POST /api/ai-assistant`** con el token de Firebase; OpenAI analiza datos reales de Firestore (ver `docs/10_ASISTENTE_IA.md`).
- **Sin servidor o si falla la petición:** se usa el **parser local** en `js/ai-assistant.js` (sin API keys en el navegador).
- Flujo siempre: **borrador → revisar → guardar con PIN** (no guardado automático desde IA).

### Exportación a Excel
- Botón **“Exportar Excel”** genera un `.xlsx` con hojas de resumen, movimientos y agregaciones.
- **No** incluye PDFs/imágenes: solo exporta metadata de comprobantes (id local, nombre, tipo y tamaño).

### Preparación migración online (Vercel + GitHub + Firebase)
Camino elegido para la versión online:
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
- **IndexedDB (local por dispositivo)**: archivo real; metadata referenciada desde el movimiento.
- **Firestore**: puede guardar metadata del comprobante cuando existe en ese dispositivo; el archivo **no** viaja a la nube hasta implementar **Firebase Storage**.

La app implementa guardado/visualización/reemplazo/eliminación en IndexedDB.

Limitaciones actuales:
- Los archivos viven en **IndexedDB del navegador** y **no** se sincronizan entre PC y celular hasta la fase Storage.
- Si el navegador borra datos del sitio, los adjuntos pueden perderse.

> Nota: el roadmap histórico por etapas está en `docs/02_ROADMAP_ETAPAS.md`. El roadmap online actual (Firebase) está en `docs/12_ROADMAP_MIGRACION_ONLINE.md`.

