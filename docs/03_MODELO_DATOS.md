## 03 - Modelo de datos

### Entidad principal: Movimiento
Cada movimiento representa un **ingreso** o **gasto** dentro del proyecto.

Cada registro tiene un **`id` único** generado al crearlo; permite **editar** (actualizar campos manteniendo el mismo `id` y `fechaCreacion`) y **eliminar** el movimiento desde la tabla. Las operaciones de **crear, guardar edición y eliminar** exigen confirmación con **PIN** en la interfaz (ver `security.js`).

#### Validación al crear/editar desde el formulario (reglas actuales)

**Campos obligatorios** (si falta alguno, no se guarda el movimiento):
- `tipo`
- `fecha`
- `categoria`
- `subcategoria`
- `montoTotal` (número > 0)
- `reparto` (clave válida: `gabriel` | `vania` | `ambos`; se aceptan alias legacy en datos antiguos)
- `cuentaMedioSalida` (en registros nuevos; datos antiguos pueden tener sólo `pagadoPor`)
- `origen`
- `destino`
- `estado`
- `metodoPago` (lista cerrada en UI: Transferencia, Pago con tarjeta, Efectivo)

**Campos opcionales**:
- `descripcion` (puede ir vacía → se guarda `""`)
- `proveedor`
- `numeroDocumento`
- `notas`
- `comprobante`
- `bancoOrigen` y demás campos no listados como obligatorios

#### Campos
- `id` (string): identificador único.
- `fecha` (string ISO `YYYY-MM-DD`): fecha contable del movimiento.
- `tipo` (`"gasto"` | `"ingreso"` | `"ajuste"`).
- `categoria` (string): **grupo principal** de clasificación del movimiento (ej: `"Construcción Obra Gruesa"`).
- `subcategoria` (string): **detalle específico** dentro de la categoría (ej: `"Cemento"`).
- `descripcion` (string, opcional en formulario; puede ser `""`).
- `montoTotal` (number).
- `aporteGabriel` (number).
- `aporteVania` (number).
- `cuentaMedioSalida` (string): **desde qué cuenta o medio salió físicamente el dinero** al registrar el movimiento (ej: `"Caja del proyecto"`, `"Cuenta Gabriel"`).
- `pagadoPor` (string): **campo legacy** mantenido por compatibilidad; en nuevos registros replica `cuentaMedioSalida`. En datos antiguos puede existir sólo `pagadoPor` y debe mostrarse como medio de salida.
- `origen` (string): origen de fondos (ej: caja, banco, efectivo, etc.) — **obligatorio** en nuevos registros desde el formulario.
- `destino` (string): destino/uso (ej: proveedor, servicio, obra) — **obligatorio** en nuevos registros desde el formulario.
- `metodoPago` (string): valores típicos en UI — `"Transferencia"` | `"Pago con tarjeta"` | `"Efectivo"` (**obligatorio** en nuevos registros). Movimientos antiguos pueden tener texto libre previo.
- `bancoOrigen` (string).
- `proveedor` (string).
- `numeroDocumento` (string): folio/boleta/factura.
- `estado` (`"pendiente"` | `"pagado"` | `"anulado"`).
- `comprobante` (object | null): **metadata** del adjunto (el archivo real vive en IndexedDB en modo local).
  - `id` (string, ej: `att_...`)
  - `fileName` (string)
  - `fileType` (string MIME)
  - `fileSize` (number)
  - `createdAt` (string ISO)
  - `storage` (object):
    - `mode`: `"local-indexeddb"` (futuro: `"cloud"`)
    - `dbName`: `"isd_attachments_db"`
    - `storeName`: `"attachments"`
- `notas` (string).
- `fechaCreacion` (string ISO datetime).
- `fechaModificacion` (string ISO datetime).
- `editadoPor` (string, opcional): usuario que editó por última vez (temporal por ahora).
- `fechaEdicion` (string ISO datetime, opcional): fecha/hora de la última edición.

### Reparto contable vs. medio de salida
- El **reparto** (UI: *Reparto del gasto/ingreso*) define la **distribución contable** entre Gabriel y Vania (`aporteGabriel` / `aporteVania`). Aplica a **ingresos** (cuánto capital aporta cada uno) y a **gastos** (cómo se asigna el gasto entre socios).
- **Cuenta / medio de salida** (`cuentaMedioSalida`) indica **de dónde salió el dinero en la práctica** (caja del proyecto, cuenta personal, efectivo, etc.). No reemplaza al reparto.

Claves de reparto en UI/código: `gabriel` | `vania` | `ambos` (50/50). Se aceptan por compatibilidad lecturas antiguas: `gabriel_100`, `vania_100`, `mitad_mitad`.

### Reglas de aporte (socios)
Se mantiene `montoTotal` y su reparto en:
- `aporteGabriel`
- `aporteVania`

Regla base: \(aporteGabriel + aporteVania = montoTotal\).

Casos soportados:
- 100% Gabriel: `aporteGabriel = montoTotal`, `aporteVania = 0`
- 100% Vania: `aporteVania = montoTotal`, `aporteGabriel = 0`
- 50/50 (`ambos`): reparto equilibrado con suma exacta (con montos impares se ajusta un peso para que la suma sea `montoTotal`)

> En ETAPA 1 se implementa la creación simple con estos campos completos, aunque algunos queden vacíos por UI. En etapas siguientes se amplía el formulario y validaciones.

### Reglas de clasificación (categorías)
- Para **nuevos movimientos**, `categoria` y `subcategoria` son **obligatorias**.
- En movimientos antiguos (previos a esta regla), si faltan, se mostrará:
  - `Sin categoría`
  - `Sin subcategoría`
  Sólo para visualización, sin borrar datos existentes.

### Flujo de caja (Caja del Proyecto)
- Un movimiento de tipo **`ingreso`** **aumenta** la caja disponible del proyecto.
- Un movimiento de tipo **`gasto`** **disminuye** la caja disponible del proyecto.
- Un movimiento de tipo **`ajuste`** se mantiene **neutral** para el cálculo de caja por ahora (puede definirse en una etapa posterior).

Definición:
\[
\text{Caja actual} = \sum(\text{ingresos}) - \sum(\text{gastos})
\]

### Métricas de dashboard (interpretación)
- **Gastos totales del proyecto**: suma de `montoTotal` donde `tipo === "gasto"` (no incluye ingresos).
- **Aporte capital Gabriel / Vania**: suma de `aporteGabriel` / `aporteVania` **solo en movimientos `tipo === "ingreso"`**.
- **Gasto asignado Gabriel / Vania**: suma de `aporteGabriel` / `aporteVania` **solo en movimientos `tipo === "gasto"`**.
- La **diferencia de aportes de capital** entre socios puede calcularse en `reports.js` (`getDiferenciaAportesCapital`) para uso futuro; **no forma parte del dashboard principal** para evitar confusiones sin contexto. En una etapa posterior, una sección **“Resumen entre socios”** explicará con texto quién aportó más, equilibrios y compensaciones.

`montoTotal` se persiste siempre como **number** (sin separadores de miles en JSON/`localStorage`).

