## 06 - Futura integración email (backend)

### Objetivo
Preparar la app para que, al existir un backend, se puedan enviar reportes por correo:
- resumen mensual,
- Excel completo,
- y/o comprobantes asociados.

### Enfoque de diseño
- El frontend generará **datasets y archivos** (Excel/JSON) de manera reproducible.
- El backend se encargará de:
  - autenticación,
  - envío de correo,
  - almacenamiento de adjuntos,
  - auditoría (quién envió qué y cuándo).

### Contratos previstos (ETAPA 6)
Módulo `js/email-placeholder.js` define funciones sin implementación real:
- `enviarResumenMensual(periodo)`
- `enviarExcel(periodo)`
- `enviarComprobantes(movementIds)`

En la migración a backend, estas funciones se conectarán a endpoints HTTP (ej: `/api/reports/send`).

