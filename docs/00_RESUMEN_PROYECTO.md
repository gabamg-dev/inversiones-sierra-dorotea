## 00 - Resumen del proyecto

### Nombre
**Inversiones Sierra Dorotea**

### Propósito
Sistema web local para el **control financiero** de un proyecto inmobiliario (construcción de vivienda). Permite registrar movimientos (ingresos/gastos), controlar aportes por socio (Gabriel y Vania), y generar reportes/exportaciones.

### Principios
- **Local-first**: funcionamiento sin servidor en etapas iniciales.
- **Modularidad**: cada módulo cumple una responsabilidad concreta.
- **Escalabilidad**: estructura preparada para migrar a backend sin reescribir la app.
- **Trazabilidad financiera**: cada movimiento tiene campos de soporte (documento, proveedor, método, etc.).

### Flujo general de uso (ETAPA 1)
1. Abrir `index.html`.
2. Completar formulario de movimiento (gasto/ingreso).
3. Guardar y visualizar en tabla.
4. Persistencia automática en `localStorage`.

