## 02 - Roadmap por etapas

### ETAPA 1 (actual)
- Estructura del proyecto.
- Documentación base.
- UI base: header, dashboard vacío, formulario, tabla.
- Registro simple de movimiento.
- Persistencia local con `localStorage`.

### ETAPA 2
- Dashboard con métricas:
  - caja actual
  - ingresos/capital total
  - gastos totales
  - aportes de capital por socio
  - gastos asignados por socio
  - resumen rápido (top categoría, mes con mayor gasto, último movimiento)
- Reportes agregados en `reports.js`.
- Gráficos con Chart.js en `charts.js` (gasto mensual y gasto por categoría).

### ETAPA 3
- Comprobantes:
  - adjuntar imagen/PDF
  - indicador “sin comprobante”
  - estrategia de almacenamiento (limitaciones `localStorage`)

### ETAPA 4
- Exportación Excel (SheetJS):
  - resumen general
  - movimientos
  - por categoría
  - por mes
  - por socio

### ETAPA 5
- Respaldo/Importación JSON.
- Exportar dataset a `data/`.
- Importación con validación de esquema y deduplicación.

### ETAPA 6
- Preparación backend:
  - contratos de envío y formatos
  - módulo `email-placeholder.js`
  - estrategia de autenticación y almacenamiento (definición)

