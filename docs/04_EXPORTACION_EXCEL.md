## 04 - Exportación a Excel

### Objetivo
Generar un archivo Excel (ETAPA 4) con múltiples hojas para análisis, respaldo y revisión (socios/contador).

### Librería
Se usa **SheetJS** (`xlsx`) vía CDN:
- `https://cdn.jsdelivr.net/npm/xlsx/dist/xlsx.full.min.js`

### Archivo exportado
- Nombre: `Inversiones_Sierra_Dorotea_YYYY-MM-DD.xlsx`
- Se exporta **todo** (no la vista filtrada) en esta etapa.

### Importante sobre comprobantes
- **No** se exportan PDFs/imágenes dentro del Excel.
- En Excel solo se exporta **metadata** del comprobante:
  - tiene comprobante, nombre, tipo, tamaño y `id` local (IndexedDB).

### Hojas incluidas (ETAPA 4)
1. **Resumen General**
2. **Movimientos**
3. **Gastos por Categoría**
4. **Gastos por Mes**
5. **Flujo de Caja**
6. **Aportes por Socio**
7. **Comprobantes** (solo metadata)
8. **Auditoría**

### Contenido por hoja (resumen)
- **Resumen General**: fecha exportación, ingresos/capital, gastos totales, caja actual, aportes/gastos asignados por socio, total movimientos, con/sin comprobante.
- **Movimientos**: 1 fila por movimiento, incluyendo campos operativos y metadata de comprobante (sin blobs).
- **Gastos por Categoría**: `reports.getGastoPorCategoria(movements)`.
- **Gastos por Mes**: `reports.getGastoPorMes(movements)`.
- **Flujo de Caja**: `reports.getFlujoCajaMensual(movements)`.
- **Aportes por Socio**: resumen Gabriel/Vania (capital y gasto asignado) calculado desde `reports.buildDashboardMetrics`.
- **Comprobantes**: listado para revisión de adjuntos (solo metadata; indica “almacenado en IndexedDB”).
- **Auditoría**: `audit.getAuditLogs()` con detalle básico (acción, usuario, resumen, monto, comprobante).

### Formato/visual
- Encabezados simples y anchos de columnas razonables.
- Montos exportados como **número** (no texto).
- Se agrega autofiltro en hojas tabulares.

### Limitaciones (local)
- La exportación no incluye adjuntos reales (blobs).
- Los datos exportados provienen de `localStorage` (movimientos) y `localStorage` (auditoría).

### Mejoras futuras sugeridas
- Exportar “vista filtrada”.
- Generar ZIP con Excel + comprobantes (en una etapa posterior).

