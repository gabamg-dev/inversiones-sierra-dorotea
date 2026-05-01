## 07 - Auditoría y trazabilidad

### Objetivo
Registrar un historial persistente de acciones para mejorar trazabilidad:
- creación de movimientos
- edición de movimientos
- eliminación de movimientos

### Usuario actual (temporal)
Como aún no existe login real, el sistema usa:
- `CURRENT_USER = "Usuario local"`

En una futura integración online, este valor se reemplazará por el usuario autenticado.

### Qué acciones se registran
Cada evento genera un log con:
- `actionType`: `"CREATE"` | `"UPDATE"` | `"DELETE"`
- `movementId`: id del movimiento afectado
- `user`: usuario que ejecutó la acción (temporal por ahora)
- `createdAt`: fecha/hora ISO
- `summary`: texto breve (ej: "Movimiento editado")
- `details`: snapshot mínimo (tipo, monto, categoría, subcategoría, descripción)

### Persistencia (localStorage)
La auditoría se guarda en una clave separada:
- `isd.audit.logs.v1`

Esto evita mezclar auditoría con movimientos.

### Importante sobre eliminaciones
Cuando un movimiento se elimina:
- el movimiento desaparece de la tabla principal
- **pero el evento DELETE queda en el historial** (con los datos principales del movimiento antes de borrar)

### Relación con PIN
Las acciones CREATE/UPDATE/DELETE requieren confirmación con PIN.
La validación del PIN se centraliza en `security.js` para futura migración a autenticación real.

### Visualización en la UI
Para mantener la pantalla principal liviana, el historial se consulta **bajo demanda**:
- Botón: **“Ver historial de acciones”**
- Se abre un **modal** con los últimos eventos (por defecto muestra los últimos 20, orden descendente).

