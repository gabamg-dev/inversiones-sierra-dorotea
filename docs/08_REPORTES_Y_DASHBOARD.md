## 08 - Reportes y dashboard (ETAPA 2)

### Principio
- `reports.js` **calcula** métricas y agregaciones (sin tocar DOM).
- `charts.js` **renderiza** gráficos (Chart.js) y destruye instancias previas.
- `app.js` **coordina**: carga movimientos, pide métricas, actualiza DOM y re-renderiza.

### Métricas base
- **Ingresos totales**: suma `montoTotal` donde `tipo === "ingreso"`.
- **Gastos totales**: suma `montoTotal` donde `tipo === "gasto"`.
- **Caja actual**: ingresos − gastos.

### Métricas por socio
Se usa el reparto del movimiento (`aporteGabriel` / `aporteVania`):
- **Aporte de capital**: suma de aportes **solo en ingresos**.
- **Gasto asignado**: suma de aportes **solo en gastos**.

### Agregaciones
- **Gasto por categoría**: agrupación de gastos por `categoria`, orden desc.
- **Gasto por subcategoría**: agrupación de gastos por `subcategoria`, orden desc.
- **Gasto por mes**: agrupación de gastos por `YYYY-MM`.
- **Ingresos por mes**: agrupación de ingresos por `YYYY-MM`.
- **Flujo de caja mensual**: por mes, ingresos, gastos, saldo mes y saldo acumulado.

### Gráficos (Chart.js)
- **Gasto mensual**: bar (gastos por mes).
- **Gasto por categoría**: doughnut (top categorías por gasto).
- **Flujo de caja mensual**: combinado (barras de ingresos/gastos + línea de saldo acumulado) usando `getFlujoCajaMensual()`.

### Actualización automática
Cada acción que modifica movimientos (crear/editar/eliminar/reset) dispara un refresh que actualiza:
- dashboard
- resumen rápido
- gráficos
- tabla
- auditoría (si corresponde)

### Filtros de movimientos (ETAPA 2.5)
Se incorpora una sección **“Filtros de movimientos”** para consultar la **tabla**:
- rango de fechas, tipo, categoría/subcategoría, reparto, estado, método de pago y búsqueda libre.

Importante:
- En esta etapa, los filtros afectan **solo la tabla de movimientos**.
- No modifican el **dashboard global**, **gráficos** ni la **caja actual**.

Esto prepara una futura “vista filtrada” y exportación Excel filtrada.

